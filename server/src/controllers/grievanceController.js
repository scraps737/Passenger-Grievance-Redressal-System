import bcrypt from 'bcryptjs';
import { Grievance } from '../models/Grievance.js';
import { Department } from '../models/Department.js';
import { User } from '../models/User.js';
import { Message } from '../models/Message.js';
import { Feedback } from '../models/Feedback.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { generateReferenceId } from '../utils/referenceId.js';
import {
  computeDueAt,
  resolveSlaHours,
  msRemaining,
  slaStateLabel,
  syncSlaState,
} from '../utils/sla.js';
import { triageGrievance, findDuplicates, engineStatus } from '../services/aiTriage.js';
import { addTimelineEvent, getTimeline } from '../services/timelineService.js';
import { notify } from '../services/notificationService.js';
import { recordAudit } from '../services/auditService.js';
import { getSlaRules } from '../services/settingsService.js';
import {
  ACTIVE_STATUSES,
  CATEGORY_MAP,
  GRIEVANCE_STATUS,
  NOTIFICATION_TYPES,
  PRIORITY_TIERS,
  ROLES,
  STATUS_LABELS,
  TIMELINE_EVENT_TYPES,
} from '../config/constants.js';

/* ------------------------------- RBAC scoping ------------------------------ */

/** Restricts the list query to only the records the caller may see. */
export function visibilityFilter(user) {
  if (user.role === ROLES.ADMIN) return {};
  if (user.role === ROLES.OFFICER) {
    const clauses = [{ assignedOfficer: user._id }];
    if (user.department) clauses.push({ department: user.department });
    return { $or: clauses };
  }
  return { passenger: user._id };
}

const idOf = (value) => (value && value._id ? String(value._id) : value ? String(value) : null);

/** Single-record authorisation check. Throws 403/404 when not permitted. */
export function assertCanAccess(grievance, user) {
  if (!grievance) throw ApiError.notFound('Grievance not found');
  if (user.role === ROLES.ADMIN) return true;
  if (user.role === ROLES.OFFICER) {
    const assigned = idOf(grievance.assignedOfficer);
    const dept = idOf(grievance.department);
    if (assigned === String(user._id)) return true;
    if (user.department && dept === String(user.department)) return true;
    throw ApiError.forbidden('This case is not assigned to your wing');
  }
  if (idOf(grievance.passenger) !== String(user._id)) {
    throw ApiError.forbidden('You can only access your own grievances');
  }
  return true;
}

function assertOfficerOf(grievance, user) {
  if (user.role === ROLES.ADMIN) return true;
  const assigned = idOf(grievance.assignedOfficer);
  const dept = idOf(grievance.department);
  if (assigned === String(user._id)) return true;
  if (user.department && dept === String(user.department)) return true;
  throw ApiError.forbidden('Only the assigned officer or the owning wing may modify this case');
}

/* -------------------------------- Serialising ------------------------------ */

export function decorate(grievance) {
  const g = grievance.toObject ? grievance.toObject() : { ...grievance };
  const remaining = msRemaining(g.sla?.dueAt);
  const breached = Boolean(g.sla?.breached) || (remaining !== null && remaining < 0);
  return {
    ...g,
    statusLabel: STATUS_LABELS[g.status] || g.status,
    categoryLabel: CATEGORY_MAP[g.category]?.label || g.category,
    slaRemainingMs: remaining,
    slaRemainingLabel: slaStateLabel({ status: g.status, breached, dueAt: g.sla?.dueAt }),
    slaBreached: breached,
  };
}

/* --------------------------------- Queries -------------------------------- */

export const listGrievances = asyncHandler(async (req, res) => {
  const { status, category, priority, department, assignedOfficer, search, slaBreached, escalated, from, to, sort } =
    req.query;
  const { page, limit, skip } = req.pagination;

  const filter = { ...visibilityFilter(req.user) };
  if (status) filter.status = status === 'active' ? { $in: ACTIVE_STATUSES } : status;
  if (category) filter.category = category;
  if (priority) filter.priority = priority;
  if (department) filter.department = department;
  if (assignedOfficer) filter.assignedOfficer = assignedOfficer;
  if (slaBreached === 'true') filter['sla.breached'] = true;
  if (escalated === 'true') filter['escalation.level'] = { $gt: 0 };
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const searchClause = { $or: [{ subject: rx }, { description: rx }, { referenceId: rx }, { pnr: rx }] };
    if (filter.$or) {
      // Preserve the role-scope $or by nesting both inside $and.
      filter.$and = [{ $or: filter.$or }, searchClause];
      delete filter.$or;
    } else {
      filter.$or = searchClause.$or;
    }
  }

  const sortMap = {
    latest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    priority: { severity: -1, createdAt: -1 },
    sla: { 'sla.dueAt': 1 },
  };

  const [items, total] = await Promise.all([
    Grievance.find(filter)
      .sort(sortMap[sort] || sortMap.latest)
      .skip(skip)
      .limit(limit)
      .populate('department', 'name code icon')
      .populate('assignedOfficer', 'name designation employeeId')
      .populate('passenger', 'name email pnr')
      .lean(),
    Grievance.countDocuments(filter),
  ]);

  res.json({
    success: true,
    items: items.map((g) => {
      const remaining = msRemaining(g.sla?.dueAt);
      const breached = Boolean(g.sla?.breached) || (remaining !== null && remaining < 0);
      return {
        ...g,
        statusLabel: STATUS_LABELS[g.status] || g.status,
        categoryLabel: CATEGORY_MAP[g.category]?.label || g.category,
        slaRemainingMs: remaining,
        slaRemainingLabel: slaStateLabel({ status: g.status, breached, dueAt: g.sla?.dueAt }),
        slaBreached: breached,
      };
    }),
    pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
  });
});

export const getGrievance = asyncHandler(async (req, res) => {
  const grievance = await Grievance.findById(req.params.id)
    .populate('department', 'name code icon slaHours escalationUnit')
    .populate('assignedOfficer', 'name designation employeeId phone department')
    .populate('passenger', 'name email pnr phone zone division')
    .populate('escalation.escalatedTo', 'name designation')
    .populate('duplicateOf', 'referenceId subject status')
    .populate('resolution.resolvedBy', 'name designation');
  assertCanAccess(grievance, req.user);

  if (syncSlaState(grievance)) await grievance.save();

  const [timeline, messages, feedback, related] = await Promise.all([
    getTimeline(grievance._id),
    Message.find({ grievance: grievance._id })
      .sort({ createdAt: 1 })
      .populate('sender', 'name role designation employeeId')
      .lean(),
    Feedback.findOne({ grievance: grievance._id }).lean(),
    Grievance.find({
      _id: { $ne: grievance._id },
      $or: [{ duplicateOf: grievance._id }, { _id: grievance.duplicateOf }],
    })
      .select('referenceId subject status')
      .lean(),
  ]);

  res.json({
    success: true,
    grievance: decorate(grievance),
    timeline,
    messages,
    feedback,
    related,
    canOverride: req.user.role !== ROLES.PASSENGER,
  });
});

/** Public, privacy-preserving status lookup by reference id (home-page tracker). */
export const trackGrievance = asyncHandler(async (req, res) => {
  const referenceId = String(req.params.referenceId || '').trim().toUpperCase();
  const grievance = await Grievance.findOne({ referenceId })
    .populate('department', 'name code')
    .populate('assignedOfficer', 'designation')
    .lean();
  if (!grievance) throw ApiError.notFound('No grievance found for that reference');

  const remaining = msRemaining(grievance.sla?.dueAt);
  const breached = Boolean(grievance.sla?.breached) || (remaining !== null && remaining < 0);
  const events = await getTimeline(grievance._id);

  res.json({
    success: true,
    tracking: {
      referenceId: grievance.referenceId,
      subject: grievance.subject,
      status: grievance.status,
      statusLabel: STATUS_LABELS[grievance.status],
      category: grievance.category,
      categoryLabel: CATEGORY_MAP[grievance.category]?.label,
      priority: grievance.priority,
      department: grievance.department?.name || 'Unassigned',
      createdAt: grievance.createdAt,
      slaDueAt: grievance.sla?.dueAt,
      slaRemainingLabel: slaStateLabel({ status: grievance.status, breached, dueAt: grievance.sla?.dueAt }),
      slaBreached: breached,
      escalationLevel: grievance.escalation?.level || 0,
      steps: events.map((e) => ({ title: e.title, description: e.description, at: e.createdAt })),
    },
  });
});

/* -------------------------------- Creation -------------------------------- */

export const createGrievance = asyncHandler(async (req, res) => {
  const payload = req.body;
  const files = req.files || [];

  const slaRules = await getSlaRules();
  const duplicatePool = await Grievance.find({
    createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
  })
    .select('referenceId subject description category pnr trainNumber coach priority status')
    .limit(400)
    .lean();

  let triage = null;
  if (payload.runAiTriage !== false) {
    triage = await triageGrievance(
      {
        subject: payload.subject,
        description: payload.description,
        meta: {
          categoryHint: payload.categoryHint,
          trainNumber: payload.trainNumber,
          coach: payload.coach,
          pnr: payload.pnr,
        },
      },
      { duplicatePool }
    );
  } else if (payload.categoryHint) {
    const cat = CATEGORY_MAP[payload.categoryHint];
    triage = {
      category: payload.categoryHint,
      subCategory: '',
      severity: 2,
      priority: cat.defaultTier,
      departmentCode: cat.defaultDepartment,
      slaHours: slaRules[cat.defaultTier],
      summary: payload.subject,
      nextSteps: [],
      sentiment: 'neutral',
      confidence: 0.4,
      notes: 'Passenger selected the category manually; AI triage skipped.',
      engine: 'manual-selection',
      provider: 'none',
      model: 'n/a',
      duplicateCandidates: findDuplicates(
        { subject: payload.subject, description: payload.description, category: payload.categoryHint },
        duplicatePool
      ),
      degraded: false,
    };
  }

  const department = triage?.departmentCode
    ? await Department.findOne({ code: triage.departmentCode.toUpperCase(), active: true })
    : null;

  const slaHours = resolveSlaHours({
    priority: triage?.priority,
    department,
    slaRules,
  });
  const now = new Date();

  const grievance = await Grievance.create({
    referenceId: await generateReferenceId(),
    passenger: req.user._id,
    subject: payload.subject,
    description: payload.description,
    category: triage?.category || payload.categoryHint || 'other',
    subCategory: triage?.subCategory || '',
    severity: triage?.severity || 2,
    priority: triage?.priority || PRIORITY_TIERS.TIER3,
    department: department?._id || null,
    status: triage ? GRIEVANCE_STATUS.TRIAGED : GRIEVANCE_STATUS.SUBMITTED,
    transportMode: payload.transportMode,
    trainNumber: payload.trainNumber,
    trainName: payload.trainName,
    coach: payload.coach,
    berth: payload.berth,
    pnr: payload.pnr || req.user.pnr || '',
    station: payload.station,
    route: payload.route,
    incidentLocation: payload.incidentLocation,
    incidentAt: payload.incidentAt || now,
    attachments: files.map((f) => ({
      filename: f.filename,
      originalName: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      uploadedBy: req.user._id,
    })),
    aiTriage: triage
      ? {
          engine: triage.engine,
          provider: triage.provider,
          model: triage.model,
          category: triage.category,
          subCategory: triage.subCategory,
          severity: triage.severity,
          priority: triage.priority,
          departmentCode: triage.departmentCode,
          slaHours,
          summary: triage.summary,
          nextSteps: triage.nextSteps,
          sentiment: triage.sentiment,
          confidence: triage.confidence,
          notes: triage.notes,
          duplicateCandidates: triage.duplicateCandidates,
        }
      : null,
    sla: { hours: slaHours, dueAt: computeDueAt(now, slaHours), breached: false },
    duplicateOf: triage?.duplicateCandidates?.[0]?.grievance || null,
  });

  await addTimelineEvent({
    grievance: grievance._id,
    type: TIMELINE_EVENT_TYPES.CREATED,
    title: 'Grievance lodged',
    description: `Reference ${grievance.referenceId} created by ${req.user.name}.`,
    actor: req.user,
  });

  if (triage) {
    await addTimelineEvent({
      grievance: grievance._id,
      type: TIMELINE_EVENT_TYPES.AI_TRIAGE,
      title: `AI triage (${triage.engine})`,
      description: `${CATEGORY_MAP[triage.category]?.label} · ${triage.priority} · SLA ${slaHours}h`,
      actor: req.user,
      actorRole: 'ai',
      meta: { engine: triage.engine, confidence: triage.confidence, degraded: triage.degraded },
    });
  }

  await notify({
    user: req.user._id,
    title: `Grievance ${grievance.referenceId} registered`,
    body: `Your grievance has been logged and routed to ${department?.name || 'the central desk'}.`,
    type: NOTIFICATION_TYPES.STATUS,
    grievance: grievance._id,
    referenceId: grievance.referenceId,
    link: `/passenger/grievances/${grievance._id}`,
  });

  if (department) {
    const officers = await User.find({ role: ROLES.OFFICER, department: department._id, status: 'active' }).select('_id');
    await Promise.all(
      officers.map((o) =>
        notify({
          user: o._id,
          title: `New ${triage?.priority || 'tier3'} case in ${department.code}`,
          body: `${grievance.referenceId}: ${grievance.subject}`,
          type: NOTIFICATION_TYPES.ASSIGNMENT,
          grievance: grievance._id,
          referenceId: grievance.referenceId,
          priority: triage?.priority === PRIORITY_TIERS.TIER1 ? 'critical' : 'high',
          link: `/officer/cases/${grievance._id}`,
        })
      )
    );
  }

  await recordAudit({
    req,
    action: 'grievance.created',
    entity: 'Grievance',
    entityId: grievance._id,
    description: `${grievance.referenceId} lodged`,
    meta: { category: grievance.category, priority: grievance.priority, engine: triage?.engine },
  });

  const populated = await Grievance.findById(grievance._id)
    .populate('department', 'name code slaHours')
    .populate('assignedOfficer', 'name designation');

  res.status(201).json({
    success: true,
    grievance: decorate(populated),
    triage: triage
      ? {
          engine: triage.engine,
          provider: triage.provider,
          model: triage.model,
          category: triage.category,
          priority: triage.priority,
          severity: triage.severity,
          slaHours,
          summary: triage.summary,
          nextSteps: triage.nextSteps,
          confidence: triage.confidence,
          duplicateCandidates: triage.duplicateCandidates,
          degraded: triage.degraded,
          notes: triage.notes,
        }
      : null,
  });
});

/* ------------------------------ Officer actions ---------------------------- */

export const assignGrievance = asyncHandler(async (req, res) => {
  const { officerId, departmentId, reason } = req.body;
  const grievance = await Grievance.findById(req.params.id);
  if (!grievance) throw ApiError.notFound('Grievance not found');
  assertOfficerOf(grievance, req.user);

  const previousOfficer = grievance.assignedOfficer;
  let officer = null;
  if (officerId) {
    officer = await User.findOne({ _id: officerId, role: { $in: [ROLES.OFFICER, ROLES.ADMIN] } });
    if (!officer) throw ApiError.badRequest('Selected officer is not a valid officer account');
    grievance.assignedOfficer = officer._id;
    if (officer.department) grievance.department = officer.department;
  }
  if (departmentId) {
    const dept = await Department.findById(departmentId);
    if (!dept) throw ApiError.badRequest('Department not found');
    grievance.department = dept._id;
  }
  if (grievance.status === GRIEVANCE_STATUS.TRIAGED || grievance.status === GRIEVANCE_STATUS.SUBMITTED) {
    grievance.status = GRIEVANCE_STATUS.ASSIGNED;
  }
  await grievance.save();

  await addTimelineEvent({
    grievance: grievance._id,
    type: previousOfficer ? TIMELINE_EVENT_TYPES.REASSIGNED : TIMELINE_EVENT_TYPES.ASSIGNED,
    title: previousOfficer ? 'Case reassigned' : 'Case assigned',
    description: officer ? `Assigned to ${officer.name}${reason ? ` — ${reason}` : ''}` : reason || 'Assignment updated',
    actor: req.user,
  });

  if (officer) {
    await notify({
      user: officer._id,
      title: `Case ${grievance.referenceId} assigned to you`,
      body: grievance.subject,
      type: NOTIFICATION_TYPES.ASSIGNMENT,
      grievance: grievance._id,
      referenceId: grievance.referenceId,
      priority: 'high',
      link: `/officer/cases/${grievance._id}`,
    });
  }
  await notify({
    user: grievance.passenger,
    title: `Grievance ${grievance.referenceId} assigned`,
    body: officer ? `${officer.name} is now handling your case.` : 'Your case has been assigned to a wing.',
    type: NOTIFICATION_TYPES.STATUS,
    grievance: grievance._id,
    referenceId: grievance.referenceId,
    link: `/passenger/grievances/${grievance._id}`,
  });

  await recordAudit({
    req,
    action: 'grievance.assigned',
    entity: 'Grievance',
    entityId: grievance._id,
    description: `Assigned ${grievance.referenceId}`,
    meta: { officerId, departmentId, reason },
  });

  res.json({ success: true, grievance: decorate(grievance) });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const grievance = await Grievance.findById(req.params.id);
  if (!grievance) throw ApiError.notFound('Grievance not found');

  if (req.user.role === ROLES.PASSENGER) {
    // Passengers may only acknowledge closure of their own resolved case.
    if (idOf(grievance.passenger) !== String(req.user._id)) throw ApiError.forbidden();
    if (status !== GRIEVANCE_STATUS.CLOSED) {
      throw ApiError.forbidden('Passengers may only close their own resolved grievance');
    }
    if (grievance.status !== GRIEVANCE_STATUS.RESOLVED) {
      throw ApiError.badRequest('Only resolved grievances can be closed by the passenger');
    }
  } else {
    assertOfficerOf(grievance, req.user);
  }

  const previous = grievance.status;
  grievance.status = status;
  if (status === GRIEVANCE_STATUS.CLOSED) grievance.resolution.resolvedAt ||= new Date();
  if (status === GRIEVANCE_STATUS.REJECTED) grievance.rejectionReason = note || 'Rejected';
  await grievance.save();

  await addTimelineEvent({
    grievance: grievance._id,
    type: TIMELINE_EVENT_TYPES.STATUS_CHANGE,
    title: `Status changed to ${STATUS_LABELS[status] || status}`,
    description: note || `Previous status: ${STATUS_LABELS[previous] || previous}`,
    actor: req.user,
    meta: { from: previous, to: status },
  });

  await notify({
    user: grievance.passenger,
    title: `Grievance ${grievance.referenceId} · ${STATUS_LABELS[status] || status}`,
    body: note || `Your grievance status changed to ${STATUS_LABELS[status] || status}.`,
    type: NOTIFICATION_TYPES.STATUS,
    grievance: grievance._id,
    referenceId: grievance.referenceId,
    link: `/passenger/grievances/${grievance._id}`,
  });

  await recordAudit({
    req,
    action: 'grievance.status_changed',
    entity: 'Grievance',
    entityId: grievance._id,
    description: `${grievance.referenceId}: ${previous} → ${status}`,
  });

  res.json({ success: true, grievance: decorate(grievance) });
});

export const escalateGrievance = asyncHandler(async (req, res) => {
  const { reason, escalatedToId } = req.body;
  const grievance = await Grievance.findById(req.params.id);
  if (!grievance) throw ApiError.notFound('Grievance not found');
  assertOfficerOf(grievance, req.user);

  grievance.escalation = {
    level: (grievance.escalation?.level || 0) + 1,
    escalatedTo: escalatedToId || null,
    reason,
    escalatedAt: new Date(),
  };
  grievance.status = GRIEVANCE_STATUS.ESCALATED;
  grievance.sla.hours = Math.max(1, Math.round(grievance.sla.hours / 2));
  grievance.sla.dueAt = computeDueAt(new Date(), grievance.sla.hours);
  grievance.sla.breached = false;
  await grievance.save();

  await addTimelineEvent({
    grievance: grievance._id,
    type: TIMELINE_EVENT_TYPES.ESCALATED,
    title: `Escalated to level ${grievance.escalation.level}`,
    description: reason,
    actor: req.user,
  });

  const admins = await User.find({ role: ROLES.ADMIN, status: 'active' }).select('_id');
  const targets = escalatedToId ? [escalatedToId] : admins.map((a) => a._id);
  await Promise.all(
    targets.map((t) =>
      notify({
        user: t,
        title: `Escalation: ${grievance.referenceId} (Level ${grievance.escalation.level})`,
        body: reason,
        type: NOTIFICATION_TYPES.ESCALATION,
        grievance: grievance._id,
        referenceId: grievance.referenceId,
        priority: 'critical',
        link: `/admin/grievances`,
      })
    )
  );
  await notify({
    user: grievance.passenger,
    title: `Grievance ${grievance.referenceId} escalated`,
    body: reason,
    type: NOTIFICATION_TYPES.ESCALATION,
    grievance: grievance._id,
    referenceId: grievance.referenceId,
    priority: 'high',
    link: `/passenger/grievances/${grievance._id}`,
  });

  await recordAudit({
    req,
    action: 'grievance.escalated',
    entity: 'Grievance',
    entityId: grievance._id,
    description: `Escalated ${grievance.referenceId} to level ${grievance.escalation.level}`,
    severity: 'critical',
    meta: { reason },
  });

  res.json({ success: true, grievance: decorate(grievance) });
});

/** Officer override of the AI recommendation (explicitly authorised + audited). */
export const overrideTriage = asyncHandler(async (req, res) => {
  const grievance = await Grievance.findById(req.params.id);
  if (!grievance) throw ApiError.notFound('Grievance not found');
  assertOfficerOf(grievance, req.user);
  if (!grievance.aiTriage) throw ApiError.badRequest('This grievance has no AI triage record to override');

  const { reason, ...changes } = req.body;
  grievance.aiTriage.original = grievance.aiTriage.original || {
    category: grievance.aiTriage.category,
    severity: grievance.aiTriage.severity,
    priority: grievance.aiTriage.priority,
    departmentCode: grievance.aiTriage.departmentCode,
    slaHours: grievance.aiTriage.slaHours,
  };

  for (const key of ['category', 'subCategory', 'severity', 'priority', 'departmentCode', 'slaHours', 'summary']) {
    if (changes[key] !== undefined) {
      grievance.aiTriage[key] = changes[key];
      if (['category', 'priority', 'severity', 'subCategory'].includes(key)) grievance[key] = changes[key];
    }
  }
  if (changes.departmentCode) {
    const dept = await Department.findOne({ code: changes.departmentCode.toUpperCase() });
    if (dept) grievance.department = dept._id;
  }
  if (changes.slaHours) {
    grievance.sla.hours = changes.slaHours;
    grievance.sla.dueAt = computeDueAt(grievance.createdAt || new Date(), changes.slaHours);
    grievance.sla.breached = false;
  }
  grievance.aiTriage.overriddenBy = req.user._id;
  grievance.aiTriage.overriddenAt = new Date();
  grievance.aiTriage.overrideReason = reason;
  await grievance.save();

  await addTimelineEvent({
    grievance: grievance._id,
    type: TIMELINE_EVENT_TYPES.AI_TRIAGE,
    title: 'AI recommendation overridden',
    description: reason,
    actor: req.user,
    meta: { changes },
  });

  await recordAudit({
    req,
    action: 'grievance.triage_overridden',
    entity: 'Grievance',
    entityId: grievance._id,
    description: `Override on ${grievance.referenceId}: ${reason}`,
    severity: 'warning',
    meta: { changes },
  });

  res.json({ success: true, grievance: decorate(grievance) });
});

/* ------------------------------- Resolution -------------------------------- */

export const resolveGrievance = asyncHandler(async (req, res) => {
  const { notes, otp } = req.body;
  // otpHash is select:false, so it must be requested explicitly for verification.
  const grievance = await Grievance.findById(req.params.id).select('+resolution.otpHash +resolution.otpExpiresAt');
  if (!grievance) throw ApiError.notFound('Grievance not found');
  assertOfficerOf(grievance, req.user);

  let handshake = null;
  if (!grievance.resolution.otpHash) {
    throw ApiError.badRequest('Generate a resolution OTP before recording the resolution');
  }
  if (otp) {
    const valid = await bcrypt.compare(otp, grievance.resolution.otpHash);
    if (!valid) throw ApiError.badRequest('Resolution OTP is incorrect');
    if (grievance.resolution.otpExpiresAt && grievance.resolution.otpExpiresAt < new Date()) {
      throw ApiError.badRequest('Resolution OTP has expired');
    }
    grievance.resolution.otpVerified = true;
    handshake = 'OTP verified';
  }

  grievance.resolution.notes = notes;
  grievance.resolution.resolvedBy = req.user._id;
  grievance.resolution.resolvedAt = new Date();
  grievance.status = GRIEVANCE_STATUS.RESOLVED;
  await grievance.save();

  await addTimelineEvent({
    grievance: grievance._id,
    type: TIMELINE_EVENT_TYPES.RESOLVED,
    title: 'Grievance resolved',
    description: notes,
    actor: req.user,
    meta: { otpVerified: grievance.resolution.otpVerified, handshake },
  });

  await notify({
    user: grievance.passenger,
    title: `Grievance ${grievance.referenceId} resolved`,
    body: `${notes} Please verify and rate the resolution.`,
    type: NOTIFICATION_TYPES.STATUS,
    grievance: grievance._id,
    referenceId: grievance.referenceId,
    link: `/passenger/grievances/${grievance._id}`,
  });

  await recordAudit({
    req,
    action: 'grievance.resolved',
    entity: 'Grievance',
    entityId: grievance._id,
    description: `Resolved ${grievance.referenceId}`,
    meta: { otpVerified: grievance.resolution.otpVerified },
  });

  res.json({ success: true, grievance: decorate(grievance) });
});

export const generateResolutionOtp = asyncHandler(async (req, res) => {
  const grievance = await Grievance.findById(req.params.id);
  if (!grievance) throw ApiError.notFound('Grievance not found');
  assertOfficerOf(grievance, req.user);

  const otp = String(Math.floor(1000 + Math.random() * 9000));
  grievance.resolution.otpHash = await bcrypt.hash(otp, 10);
  grievance.resolution.otpExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await grievance.save();

  // Delivered to the passenger's own notification stream (no real SMS gateway
  // is configured, so this is stated plainly rather than implied).
  await notify({
    user: grievance.passenger,
    title: `Resolution verification code: ${otp}`,
    body: `Share this 4-digit code with the officer once the issue at ${grievance.referenceId} is fixed. Valid 30 minutes.`,
    type: NOTIFICATION_TYPES.STATUS,
    grievance: grievance._id,
    referenceId: grievance.referenceId,
    priority: 'high',
    link: `/passenger/grievances/${grievance._id}`,
  });

  await addTimelineEvent({
    grievance: grievance._id,
    type: TIMELINE_EVENT_TYPES.STATUS_CHANGE,
    title: 'Resolution OTP generated',
    description: 'A 4-digit verification code was dispatched to the passenger.',
    actor: req.user,
  });

  res.json({
    success: true,
    deliveryChannel: 'in-app notification (no SMS gateway configured)',
    expiresInMinutes: 30,
  });
});

/* -------------------------------- Feedback --------------------------------- */

export const submitFeedback = asyncHandler(async (req, res) => {
  const grievance = await Grievance.findById(req.params.id);
  if (!grievance) throw ApiError.notFound('Grievance not found');
  if (idOf(grievance.passenger) !== String(req.user._id)) {
    throw ApiError.forbidden('You can only rate your own grievances');
  }
  if (!['resolved', 'closed'].includes(grievance.status)) {
    throw ApiError.badRequest('Feedback can only be submitted for resolved grievances');
  }
  if (grievance.sla.breached) {
    // Resolution was late – recorded, not hidden.
    req.body.withinSla = false;
  }

  const existing = await Feedback.findOne({ grievance: grievance._id });
  if (existing) throw ApiError.conflict('Feedback already submitted for this grievance');

  const feedback = await Feedback.create({
    grievance: grievance._id,
    passenger: req.user._id,
    rating: req.body.rating,
    comment: req.body.comment,
    tags: req.body.tags,
    resolvedWithinSla: !grievance.sla.breached,
  });

  await addTimelineEvent({
    grievance: grievance._id,
    type: TIMELINE_EVENT_TYPES.FEEDBACK,
    title: `Passenger rated the resolution ${feedback.rating}/5`,
    description: feedback.comment || 'No comment provided.',
    actor: req.user,
  });

  res.status(201).json({ success: true, feedback });
});

/* ------------------------------- Attachments ------------------------------- */

export const uploadAttachments = asyncHandler(async (req, res) => {
  const grievance = await Grievance.findById(req.params.id);
  assertCanAccess(grievance, req.user);
  const files = req.files || [];
  if (!files.length) throw ApiError.badRequest('No files were uploaded');

  for (const f of files) {
    grievance.attachments.push({
      filename: f.filename,
      originalName: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      uploadedBy: req.user._id,
    });
  }
  await grievance.save();

  await addTimelineEvent({
    grievance: grievance._id,
    type: TIMELINE_EVENT_TYPES.MESSAGE,
    title: `${files.length} evidence file(s) attached`,
    description: files.map((f) => f.originalname).join(', '),
    actor: req.user,
  });

  res.status(201).json({ success: true, attachments: grievance.attachments });
});

/**
 * Serves an attachment only after an authorisation check — uploads are never
 * exposed as public static files.
 */
export const downloadAttachment = asyncHandler(async (req, res) => {
  const grievance = await Grievance.findById(req.params.id);
  assertCanAccess(grievance, req.user);
  const attachment =
    grievance.attachments.id(req.params.attachmentId) ||
    grievance.resolution.proof.id(req.params.attachmentId);
  if (!attachment) throw ApiError.notFound('Attachment not found');

  const path = await import('node:path');
  const fs = await import('node:fs');
  const { UPLOAD_ROOT } = await import('../middleware/upload.js');
  const resolved = path.join(UPLOAD_ROOT, path.basename(attachment.filename));
  if (!fs.existsSync(resolved)) throw ApiError.notFound('Stored file is no longer available');

  res.setHeader('Content-Type', attachment.mimetype || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${attachment.originalName || attachment.filename}"`);
  fs.createReadStream(resolved).pipe(res);
});

/* --------------------------------- Exports --------------------------------- */

export const exportGrievancesCsv = asyncHandler(async (req, res) => {
  const filter = { ...visibilityFilter(req.user) };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;

  const items = await Grievance.find(filter)
    .sort({ createdAt: -1 })
    .limit(5000)
    .populate('department', 'name code')
    .populate('assignedOfficer', 'name')
    .populate('passenger', 'name email')
    .lean();

  const headers = [
    'referenceId', 'subject', 'category', 'priority', 'severity', 'status',
    'department', 'officer', 'passenger', 'createdAt', 'slaDueAt', 'slaBreached',
  ];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = items.map((g) =>
    [
      g.referenceId, g.subject, g.category, g.priority, g.severity, g.status,
      g.department?.name, g.assignedOfficer?.name, g.passenger?.email,
      g.createdAt?.toISOString(), g.sla?.dueAt?.toISOString(), g.sla?.breached,
    ].map(escape).join(',')
  );

  await recordAudit({
    req,
    action: 'grievance.exported',
    entity: 'Grievance',
    description: `Exported ${items.length} grievance records`,
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="grievances-${Date.now()}.csv"`);
  res.send([headers.join(','), ...rows].join('\n'));
});

export const aiEngineInfo = asyncHandler(async (_req, res) => {
  res.json({ success: true, engine: engineStatus() });
});
