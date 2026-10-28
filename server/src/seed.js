import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { User } from './models/User.js';
import { Department } from './models/Department.js';
import { Grievance } from './models/Grievance.js';
import { Message } from './models/Message.js';
import { TimelineEvent } from './models/TimelineEvent.js';
import { Notification } from './models/Notification.js';
import { Feedback } from './models/Feedback.js';
import { AuditLog } from './models/AuditLog.js';
import { Setting } from './models/Setting.js';
import { triageGrievance } from './services/aiTriage.js';
import { generateReferenceId } from './utils/referenceId.js';
import { computeDueAt } from './utils/sla.js';
import { DEFAULT_SETTINGS } from './services/settingsService.js';
import {
  CATEGORIES,
  CATEGORY_MAP,
  GRIEVANCE_STATUS,
  NOTIFICATION_TYPES,
  PRIORITY_TIERS,
  ROLES,
  TIMELINE_EVENT_TYPES,
  USER_STATUS,
} from './config/constants.js';

const DEPARTMENTS = [
  { name: 'Electrical & HVAC Systems', code: 'ELEC', icon: 'ac_unit', escalationUnit: 'SSE (Coaching)', division: 'Ratlam', categories: ['electrical_hvac'], slaHours: { tier1: 4, tier2: 12, tier3: 48 }, capacity: 120 },
  { name: 'OBHS Sanitation & Housekeeping', code: 'OBHS', icon: 'cleaning_services', escalationUnit: 'EnHM Depot Incharge', division: 'Ratlam', categories: ['cleanliness'], slaHours: { tier1: 6, tier2: 24, tier3: 72 }, capacity: 100 },
  { name: 'Mechanical & Traction (C&W)', code: 'MECH', icon: 'build', escalationUnit: 'SSE Rolling Stock', division: 'Vadodara', categories: ['mechanical'], slaHours: { tier1: 4, tier2: 18, tier3: 60 }, capacity: 90 },
  { name: 'Commercial & Ticketing', code: 'COMM', icon: 'confirmation_number', escalationUnit: 'Chief Commercial Inspector', division: 'Mumbai Central', categories: ['ticketing_refund', 'accessibility', 'staff_behavior'], slaHours: { tier1: 8, tier2: 48, tier3: 120 }, capacity: 140 },
  { name: 'RPF Security & Quick Response', code: 'SEC', icon: 'shield', escalationUnit: 'Inspector RPF', division: 'Mumbai Central', categories: ['safety', 'lost_property'], slaHours: { tier1: 2, tier2: 8, tier3: 48 }, capacity: 80 },
  { name: 'Transit Medical & Safety', code: 'MED', icon: 'medical_services', escalationUnit: 'Chief Medical Superintendent', division: 'Ratlam', categories: ['medical'], slaHours: { tier1: 1, tier2: 4, tier3: 24 }, capacity: 40 },
  { name: 'Operations & Punctuality', code: 'OPS', icon: 'schedule', escalationUnit: 'Divisional Operations Manager', division: 'Ahmedabad', categories: ['delay', 'overcrowding', 'other'], slaHours: { tier1: 6, tier2: 24, tier3: 72 }, capacity: 150 },
];

const SAMPLE = [
  { subject: 'AC thermostat failure – excessive cooling in Coach B-4', description: 'The air conditioner vent above berths 28 and 29 is blowing sub-15°C freezing air without regulation since departure from Surat. We requested the coach attendant twice but no technician attended. Elderly passengers in berth 31 are shivering and have no extra blankets available. Please recalibrate the thermostat or dispatch the electrical maintenance engineer before the next station.', category: 'electrical_hvac', coach: 'B-4', berth: '28', station: 'Surat', priority: 'tier2', mode: 'rail', trainNumber: '12952', trainName: 'Mumbai Central Tejas Rajdhani Express' },
  { subject: 'Severe overcrowding in general coach', description: 'The general compartment is packed far beyond capacity, with passengers standing in the vestibule and even the doorway. It is unsafe and highly uncomfortable for the two hours travelled so far. Requesting additional coaches or an unreserved capacity check at the next major junction.', category: 'overcrowding', coach: 'S-6', berth: '', station: 'Vadodara', priority: 'tier2', mode: 'rail', trainNumber: '12009', trainName: 'Shatabdi Express' },
  { subject: 'Coach attendant misbehaviour and unresponsiveness', description: 'The coach attendant was extremely rude when requested for bedroll and refused to provide blankets despite repeated requests. He also ignored a request to clean a spill in the aisle. This behaviour is unacceptable on a premium service and needs disciplinary review.', category: 'staff_behavior', coach: 'A-1', berth: '12', station: 'Kota', priority: 'tier2', mode: 'rail', trainNumber: '12951', trainName: 'Mumbai Rajdhani Express' },
  { subject: 'Lost laptop bag between Ratlam and Vadodara', description: 'I left a black laptop bag containing a laptop and important documents in the overhead rack of coach B-2 when I alighted at Vadodara. I realised within twenty minutes and reported to the station master but have had no update. Requesting a thorough search of the coach before it returns to the yard.', category: 'lost_property', coach: 'B-2', berth: '44', station: 'Vadodara', priority: 'tier3', mode: 'rail', trainNumber: '12952', trainName: 'Mumbai Central Tejas Rajdhani Express' },
  { subject: 'Refund not credited after online cancellation', description: 'I cancelled my ticket eleven days ago through the official app and the booking shows cancelled, yet the refund has not been credited to my account. The amount is 2,480 rupees. I have raised two complaints with the helpline with no resolution. Requesting immediate processing and compensation for the delay.', category: 'ticketing_refund', coach: '', berth: '', station: 'Mumbai Central', priority: 'tier2', mode: 'rail', trainNumber: '12952', trainName: 'Tejas Rajdhani Express' },
  { subject: 'Bio-toilet flush malfunction and unclean washroom', description: 'The bio-toilet in coach B-4 has not been flushing since the journey began and the washroom floor is soiled with no water available. There is a strong odour spreading into the adjacent bay. Sanitation staff have not visited the coach at all in the last six hours.', category: 'cleanliness', coach: 'B-4', berth: '31', station: 'Nagda', priority: 'tier3', mode: 'rail', trainNumber: '12952', trainName: 'Tejas Rajdhani Express' },
  { subject: 'Baggage theft reported while passenger was asleep', description: 'My handbag was stolen while I was asleep during the night journey. It contained a mobile phone, identity documents and cash. The chain of the bag was cut. There was no security presence in the coach throughout the night. Requesting an FIR be registered and an urgent security review.', category: 'safety', coach: 'S-3', berth: '9', station: 'Godhra', priority: 'tier1', mode: 'rail', trainNumber: '12903', trainName: 'Golden Temple Mail' },
  { subject: 'Wheelchair assistance not provided at station', description: 'I had pre-booked wheelchair assistance for my elderly father at the boarding station but no staff member or wheelchair was available at the platform. He had to walk the entire footbridge, which caused significant distress. This is a serious accessibility failure that must be corrected before another passenger is affected.', category: 'accessibility', coach: 'C-2', berth: '18', station: 'Ahmedabad', priority: 'tier2', mode: 'rail', trainNumber: '12009', trainName: 'Shatabdi Express' },
  { subject: 'Medical emergency – no doctor available onboard', description: 'A co-passenger suffered severe chest pain and breathlessness about an hour after departure. The attendant had no emergency medical kit and no doctor could be located on the train. We urgently need ambulance pre-positioning at the next station and a mandatory medical kit audit on long-distance trains.', category: 'medical', coach: 'C-1', berth: '22', station: 'Surat', priority: 'tier1', mode: 'rail', trainNumber: '12009', trainName: 'Shatabdi Express' },
  { subject: 'Train delayed by three hours without information', description: 'The train departed the origin station three hours behind schedule with no announcement or explanation at the platform. Connecting passengers missed their onward reservations and no alternative arrangement was offered. Requesting an explanation and compensation under the applicable refund rules.', category: 'delay', coach: 'S-2', berth: '5', station: 'Ratlam', priority: 'tier3', mode: 'rail', trainNumber: '12952', trainName: 'Tejas Rajdhani Express' },
  { subject: 'Metro escalator out of service at central interchange', description: 'The escalator at the central interchange has been out of service for over a week, forcing all passengers including elderly and disabled commuters to climb four flights of stairs. The lift is also frequently broken. Requesting urgent maintenance and a published timeline.', category: 'accessibility', coach: '', berth: '', station: 'Central Interchange', priority: 'tier2', mode: 'metro', trainNumber: '', trainName: 'Metro Line 3' },
  { subject: 'Charging socket at berth sparks when plugged in', description: 'The mobile charging socket beside berth 18 emitted sparks when I connected my charger and the phone screen flickered. I immediately disconnected but the socket remains live and could cause a fire. Please isolate the circuit and inspect the whole coach urgently.', category: 'electrical_hvac', coach: 'C-2', berth: '18', station: 'Vadodara', priority: 'tier1', mode: 'rail', trainNumber: '12952', trainName: 'Tejas Rajdhani Express' },
];

const PASSENGERS = [
  { name: 'Priya Sharma', email: 'priya.sharma@example.com', pnr: '4829103810', zone: 'Western Railway', division: 'Mumbai Central' },
  { name: 'Arjun Mehta', email: 'arjun.mehta@example.com', pnr: '7712903845', zone: 'Western Railway', division: 'Vadodara' },
  { name: 'Fatima Khan', email: 'fatima.khan@example.com', pnr: '3320984711', zone: 'Western Railway', division: 'Ratlam' },
  { name: 'Rakesh Iyer', email: 'rakesh.iyer@example.com', pnr: '9982310047', zone: 'Western Railway', division: 'Ahmedabad' },
];

const OFFICERS = [
  { name: 'Er. R. S. Murthy', email: 'r.murthy@grievanceai.gov', dept: 'ELEC', designation: 'SSE Electrical', employeeId: 'HH-4091' },
  { name: 'Dinesh K. Sharma', email: 'd.sharma@grievanceai.gov', dept: 'OBHS', designation: 'EnHM Depot Incharge', employeeId: 'HH-2201' },
  { name: 'Er. Vandana Rao', email: 'v.rao@grievanceai.gov', dept: 'MECH', designation: 'SSE Rolling Stock', employeeId: 'HH-3310' },
  { name: 'Sanjay Bhatt', email: 's.bhatt@grievanceai.gov', dept: 'COMM', designation: 'Chief Commercial Inspector', employeeId: 'CC-1180' },
  { name: 'Insp. Meera Nair', email: 'm.nair@grievanceai.gov', dept: 'SEC', designation: 'Inspector RPF', employeeId: 'RPF-0904' },
  { name: 'Dr. A. Verma', email: 'a.verma@grievanceai.gov', dept: 'MED', designation: 'Divisional Medical Officer', employeeId: 'MED-0061' },
  { name: 'R. Sen', email: 'r.sen@grievanceai.gov', dept: 'OPS', designation: 'Divisional Operations Officer', employeeId: 'IO-WR-4091' },
];

const statusSequence = [
  GRIEVANCE_STATUS.RESOLVED,
  GRIEVANCE_STATUS.IN_PROGRESS,
  GRIEVANCE_STATUS.TRIAGED,
  GRIEVANCE_STATUS.ASSIGNED,
  GRIEVANCE_STATUS.AWAITING_CLARIFICATION,
  GRIEVANCE_STATUS.ESCALATED,
  GRIEVANCE_STATUS.CLOSED,
];

async function clearDatabase() {
  await Promise.all([
    User.deleteMany({}),
    Department.deleteMany({}),
    Grievance.deleteMany({}),
    Message.deleteMany({}),
    TimelineEvent.deleteMany({}),
    Notification.deleteMany({}),
    Feedback.deleteMany({}),
    AuditLog.deleteMany({}),
    Setting.deleteMany({}),
  ]);
}

async function seed() {
  await connectDatabase();
  console.log('[seed] clearing existing data…');
  await clearDatabase();

  console.log('[seed] creating settings…');
  await Setting.create(
    Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value }))
  );

  console.log('[seed] creating departments…');
  const departments = {};
  for (const dept of DEPARTMENTS) {
    departments[dept.code] = await Department.create({
      ...dept,
      categories: dept.categories.filter((c) => CATEGORY_MAP[c]),
      zone: 'Western Railway',
    });
  }

  console.log('[seed] creating users…');
  const admin = await User.create({
    name: 'Priya Sharma (Admin)',
    email: env.seed.adminEmail,
    password: env.seed.adminPassword,
    role: ROLES.ADMIN,
    employeeId: 'ADM-0001',
    designation: 'DRM Controller (Super Admin)',
    zone: 'Western Railway',
    division: 'Mumbai Central',
    status: USER_STATUS.ACTIVE,
  });

  const officers = [];
  for (const o of OFFICERS) {
    officers.push(
      await User.create({
        name: o.name,
        email: o.email,
        password: 'Officer@12345',
        role: ROLES.OFFICER,
        employeeId: o.employeeId,
        designation: o.designation,
        department: departments[o.dept]._id,
        zone: 'Western Railway',
        division: departments[o.dept].division,
        status: USER_STATUS.ACTIVE,
      })
    );
  }
  for (const dept of Object.values(departments)) {
    const head = officers.find((o) => String(o.department) === String(dept._id));
    if (head) {
      dept.head = head._id;
      await dept.save();
    }
  }

  const passengers = [];
  for (const p of PASSENGERS) {
    passengers.push(
      await User.create({
        name: p.name,
        email: p.email,
        password: 'Passenger@123',
        role: ROLES.PASSENGER,
        pnr: p.pnr,
        zone: p.zone,
        division: p.division,
        status: USER_STATUS.ACTIVE,
      })
    );
  }

  console.log('[seed] creating grievances with AI triage…');
  const created = [];
  for (let i = 0; i < SAMPLE.length; i += 1) {
    const item = SAMPLE[i];
    const passenger = passengers[i % passengers.length];
    const daysAgo = Math.floor((i / SAMPLE.length) * 80);
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 - i * 3600 * 1000);

    const triage = await triageGrievance({
      subject: item.subject,
      description: item.description,
      meta: { categoryHint: item.category, trainNumber: item.trainNumber, coach: item.coach },
    });

    const dept =
      departments[triage.departmentCode] ||
      Object.values(departments).find((d) => d.categories.includes(item.category)) ||
      departments.OPS;

    const status = statusSequence[i % statusSequence.length];
    const assignedOfficer = officers.find((o) => String(o.department) === String(dept._id));
    const slaHours = dept.slaHours[triage.priority] || triage.slaHours;
    const dueAt = computeDueAt(createdAt, slaHours);
    const breached = dueAt < new Date() && ![GRIEVANCE_STATUS.RESOLVED, GRIEVANCE_STATUS.CLOSED].includes(status);
    const resolvedAt = [GRIEVANCE_STATUS.RESOLVED, GRIEVANCE_STATUS.CLOSED].includes(status)
      ? new Date(createdAt.getTime() + slaHours * 0.7 * 3600 * 1000)
      : null;

    const grievance = await Grievance.create({
      referenceId: await generateReferenceId(),
      passenger: passenger._id,
      subject: item.subject,
      description: item.description,
      category: triage.category,
      subCategory: triage.subCategory,
      severity: triage.severity,
      priority: triage.priority,
      department: dept._id,
      assignedOfficer: status === GRIEVANCE_STATUS.TRIAGED ? null : assignedOfficer?._id || null,
      status,
      transportMode: item.mode,
      trainNumber: item.trainNumber,
      trainName: item.trainName,
      coach: item.coach,
      berth: item.berth,
      pnr: passenger.pnr,
      station: item.station,
      incidentAt: createdAt,
      aiTriage: {
        engine: triage.engine,
        provider: triage.provider,
        model: triage.model,
        category: triage.category,
        subCategory: triage.subCategory,
        severity: triage.severity,
        priority: triage.priority,
        departmentCode: dept.code,
        slaHours,
        summary: triage.summary,
        nextSteps: triage.nextSteps,
        sentiment: triage.sentiment,
        confidence: triage.confidence,
        notes: triage.notes,
        duplicateCandidates: triage.duplicateCandidates || [],
      },
      sla: { hours: slaHours, dueAt, breached, breachedAt: breached ? dueAt : null },
      escalation:
        status === GRIEVANCE_STATUS.ESCALATED
          ? { level: 1, reason: 'SLA at risk; escalated to DRM office', escalatedAt: createdAt }
          : { level: 0 },
      clarification:
        status === GRIEVANCE_STATUS.AWAITING_CLARIFICATION
          ? { requested: true, requestedAt: createdAt }
          : { requested: false },
      resolution: resolvedAt
        ? {
            notes: 'Field rectification completed and verified with the passenger before closure.',
            resolvedBy: assignedOfficer?._id || admin._id,
            resolvedAt,
            otpVerified: true,
          }
        : {},
      createdAt,
      updatedAt: resolvedAt || createdAt,
    });
    grievance.createdAt = createdAt;
    await grievance.save({ timestamps: false });
    created.push(grievance);

    await TimelineEvent.create([
      {
        grievance: grievance._id,
        type: TIMELINE_EVENT_TYPES.CREATED,
        title: 'Grievance lodged',
        description: `Reference ${grievance.referenceId} created by ${passenger.name}.`,
        actor: passenger._id,
        actorRole: ROLES.PASSENGER,
        createdAt,
      },
      {
        grievance: grievance._id,
        type: TIMELINE_EVENT_TYPES.AI_TRIAGE,
        title: `AI triage (${triage.engine})`,
        description: `${triage.summary} · ${triage.priority} · SLA ${slaHours}h`,
        actor: passenger._id,
        actorRole: 'ai',
        meta: { engine: triage.engine, confidence: triage.confidence },
        createdAt: new Date(createdAt.getTime() + 60000),
      },
    ]);

    if (assignedOfficer && status !== GRIEVANCE_STATUS.TRIAGED) {
      await TimelineEvent.create({
        grievance: grievance._id,
        type: TIMELINE_EVENT_TYPES.ASSIGNED,
        title: 'Case assigned',
        description: `Assigned to ${assignedOfficer.name} (${dept.name}).`,
        actor: admin._id,
        actorRole: ROLES.ADMIN,
        createdAt: new Date(createdAt.getTime() + 5 * 60000),
      });
    }

    if (status === GRIEVANCE_STATUS.AWAITING_CLARIFICATION) {
      await Message.create({
        grievance: grievance._id,
        sender: assignedOfficer?._id || admin._id,
        senderRole: ROLES.OFFICER,
        kind: 'clarification_request',
        body: 'Could you confirm whether the issue is present at the berth itself or near the gangway? A photograph would help us dispatch the correct squad.',
        createdAt: new Date(createdAt.getTime() + 20 * 60000),
      });
      await TimelineEvent.create({
        grievance: grievance._id,
        type: TIMELINE_EVENT_TYPES.CLARIFICATION_REQUESTED,
        title: 'Clarification requested',
        description: 'Officer requested additional detail from the passenger.',
        actor: assignedOfficer?._id || admin._id,
        actorRole: ROLES.OFFICER,
        createdAt: new Date(createdAt.getTime() + 20 * 60000),
      });
    }

    if (status === GRIEVANCE_STATUS.IN_PROGRESS) {
      await Message.create({
        grievance: grievance._id,
        sender: assignedOfficer?._id || admin._id,
        senderRole: ROLES.OFFICER,
        kind: 'message',
        body: 'Our squad has been dispatched and is en route to your coach. We will update you as soon as the rectification is verified.',
        createdAt: new Date(createdAt.getTime() + 30 * 60000),
      });
    }

    if (resolvedAt) {
      await TimelineEvent.create({
        grievance: grievance._id,
        type: TIMELINE_EVENT_TYPES.RESOLVED,
        title: 'Grievance resolved',
        description: 'Rectification completed and verified on ground.',
        actor: assignedOfficer?._id || admin._id,
        actorRole: ROLES.OFFICER,
        createdAt: resolvedAt,
      });
      if (i % 2 === 0) {
        await Feedback.create({
          grievance: grievance._id,
          passenger: passenger._id,
          rating: [5, 5, 4, 5, 4][i % 5],
          comment: 'Issue was attended to quickly and the staff followed up on the same day.',
          resolvedWithinSla: !breached,
          createdAt: new Date(resolvedAt.getTime() + 3600 * 1000),
        });
      }
    }

    await Notification.create({
      user: passenger._id,
      title: `Grievance ${grievance.referenceId} · ${status.replace(/_/g, ' ')}`,
      body: triage.summary,
      type: NOTIFICATION_TYPES.STATUS,
      grievance: grievance._id,
      referenceId: grievance.referenceId,
      link: `/passenger/grievances/${grievance._id}`,
      read: i % 3 === 0,
      createdAt,
    });

    if (breached) {
      await AuditLog.create({
        actor: admin._id,
        actorName: admin.name,
        actorRole: ROLES.ADMIN,
        action: 'grievance.sla_breached',
        entity: 'Grievance',
        entityId: String(grievance._id),
        description: `SLA breached for ${grievance.referenceId}`,
        severity: 'critical',
        createdAt: new Date(dueAt.getTime() + 60000),
      });
    }
  }

  // Unassigned intake so the officer dispatch queue always has work to claim.
  console.log('[seed] creating unassigned intake cases…');
  for (let i = 0; i < 4; i += 1) {
    const item = SAMPLE[(i + 3) % SAMPLE.length];
    const passenger = passengers[i % passengers.length];
    const triage = await triageGrievance({
      subject: item.subject,
      description: item.description,
      meta: { categoryHint: item.category },
    });
    const dept = departments[triage.departmentCode] || departments.OPS;
    const createdAt = new Date(Date.now() - (i + 2) * 3600 * 1000);
    const slaHours = dept.slaHours[triage.priority] || triage.slaHours;
    const g = await Grievance.create({
      referenceId: await generateReferenceId(),
      passenger: passenger._id,
      subject: item.subject,
      description: item.description,
      category: triage.category,
      severity: triage.severity,
      priority: triage.priority,
      department: dept._id,
      status: GRIEVANCE_STATUS.TRIAGED,
      transportMode: item.mode,
      trainNumber: item.trainNumber,
      trainName: item.trainName,
      coach: item.coach,
      berth: item.berth,
      pnr: passenger.pnr,
      station: item.station,
      aiTriage: {
        engine: triage.engine,
        provider: triage.provider,
        model: triage.model,
        category: triage.category,
        subCategory: triage.subCategory,
        severity: triage.severity,
        priority: triage.priority,
        departmentCode: dept.code,
        slaHours,
        summary: triage.summary,
        nextSteps: triage.nextSteps,
        sentiment: triage.sentiment,
        confidence: triage.confidence,
        notes: triage.notes,
      },
      sla: { hours: slaHours, dueAt: computeDueAt(createdAt, slaHours), breached: false },
      createdAt,
      updatedAt: createdAt,
    });
    g.createdAt = createdAt;
    await g.save({ timestamps: false });
    await TimelineEvent.create({
      grievance: g._id,
      type: TIMELINE_EVENT_TYPES.AI_TRIAGE,
      title: `AI triage (${triage.engine})`,
      description: triage.summary,
      actorRole: 'ai',
      createdAt,
    });
  }

  await AuditLog.create({
    actor: admin._id,
    actorName: admin.name,
    actorRole: ROLES.ADMIN,
    action: 'system.seeded',
    entity: 'System',
    description: `Database seeded with ${created.length} grievances`,
    severity: 'info',
  });

  const counts = {
    departments: await Department.countDocuments(),
    users: await User.countDocuments(),
    grievances: await Grievance.countDocuments(),
    timeline: await TimelineEvent.countDocuments(),
    messages: await Message.countDocuments(),
    feedback: await Feedback.countDocuments(),
    notifications: await Notification.countDocuments(),
    auditLogs: await AuditLog.countDocuments(),
  };

  console.log('\n[seed] complete:', counts);
  console.log('\n[seed] login credentials');
  console.log(`  admin      ${env.seed.adminEmail} / ${env.seed.adminPassword}`);
  console.log('  officer    r.murthy@grievanceai.gov / Officer@12345');
  console.log('  passenger  priya.sharma@example.com / Passenger@123\n');

  await disconnectDatabase();
}

seed().catch(async (err) => {
  console.error('[seed] failed:', err);
  await disconnectDatabase();
  process.exit(1);
});
