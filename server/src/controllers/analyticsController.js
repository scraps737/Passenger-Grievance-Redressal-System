import { Grievance } from '../models/Grievance.js';
import { Feedback } from '../models/Feedback.js';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Message } from '../models/Message.js';
import { asyncHandler } from '../utils/ApiError.js';
import { ACTIVE_STATUSES, ROLES, STATUS_LABELS, CATEGORY_MAP } from '../config/constants.js';
import { engineStatus } from '../services/aiTriage.js';
import { msRemaining, slaStateLabel } from '../utils/sla.js';

function rangeFromQuery(query) {
  const daysByRange = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 };
  const days = daysByRange[query.range] || 30;
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return { from, days };
}

/**
 * Unauthenticated platform statistics for the public landing page.
 * Aggregates only — no personal data is exposed.
 */
export const publicStats = asyncHandler(async (_req, res) => {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const [total, resolved, breached, active, departments, mttr, feedback, categoryAgg] = await Promise.all([
    Grievance.countDocuments({}),
    Grievance.countDocuments({ status: { $in: ['resolved', 'closed'] } }),
    Grievance.countDocuments({ 'sla.breached': true }),
    Grievance.countDocuments({ status: { $in: ACTIVE_STATUSES } }),
    Department.countDocuments({ active: true }),
    Grievance.aggregate([
      { $match: { 'resolution.resolvedAt': { $ne: null } } },
      { $project: { minutes: { $divide: [{ $subtract: ['$resolution.resolvedAt', '$createdAt'] }, 60000] } } },
      { $group: { _id: null, avg: { $avg: '$minutes' } } },
    ]),
    Feedback.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }]),
    Grievance.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
  ]);

  res.json({
    success: true,
    stats: {
      totalGrievances: total,
      resolved,
      active,
      slaCompliance: total ? Number((((total - breached) / total) * 100).toFixed(1)) : 100,
      avgResolutionMinutes: mttr[0]?.avg ? Number(mttr[0].avg.toFixed(1)) : 0,
      avgRating: feedback[0]?.avg ? Number(feedback[0].avg.toFixed(2)) : 0,
      feedbackCount: feedback[0]?.count || 0,
      departments,
    },
    topCategories: categoryAgg.map((c) => ({
      category: c._id,
      label: CATEGORY_MAP[c._id]?.label || c._id,
      count: c.count,
    })),
    engine: engineStatus(),
  });
});

/** Admin executive dashboard: all figures derived from stored records. */
export const overview = asyncHandler(async (req, res) => {
  const { from, days } = rangeFromQuery(req.query);

  const [
    total,
    inRange,
    active,
    resolved,
    breached,
    escalated,
    byStatusAgg,
    byCategoryAgg,
    byDepartmentAgg,
    byPriorityAgg,
  ] = await Promise.all([
    Grievance.countDocuments({}),
    Grievance.countDocuments({ createdAt: { $gte: from } }),
    Grievance.countDocuments({ status: { $in: ACTIVE_STATUSES } }),
    Grievance.countDocuments({ status: { $in: ['resolved', 'closed'] } }),
    Grievance.countDocuments({ 'sla.breached': true }),
    Grievance.countDocuments({ 'escalation.level': { $gt: 0 } }),
    Grievance.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Grievance.aggregate([
      { $match: { createdAt: { $gte: from } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Grievance.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    Grievance.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
  ]);

  const resolutionRate = total ? Number(((resolved / total) * 100).toFixed(1)) : 0;
  const slaCompliance = total ? Number((((total - breached) / total) * 100).toFixed(2)) : 100;

  // Mean time to resolve, derived from actual resolvedAt timestamps.
  const mttr = await Grievance.aggregate([
    { $match: { 'resolution.resolvedAt': { $ne: null } } },
    {
      $project: {
        minutes: { $divide: [{ $subtract: ['$resolution.resolvedAt', '$createdAt'] }, 60000] },
      },
    },
    { $group: { _id: null, avg: { $avg: '$minutes' }, count: { $sum: 1 } } },
  ]);

  const feedbackAgg = await Feedback.aggregate([
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  // Daily intake / resolution trend for the chart.
  const trend = await Grievance.aggregate([
    { $match: { createdAt: { $gte: from } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        intake: { $sum: 1 },
        resolved: { $sum: { $cond: [{ $ne: ['$resolution.resolvedAt', null] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const departments = await Department.find({}).select('name code').lean();
  const deptName = Object.fromEntries(departments.map((d) => [String(d._id), d.name]));

  const [staffCount, passengerCount] = await Promise.all([
    User.countDocuments({ role: { $ne: ROLES.PASSENGER } }),
    User.countDocuments({ role: ROLES.PASSENGER }),
  ]);

  res.json({
    success: true,
    range: { days, from },
    kpis: {
      total,
      inRange,
      active,
      resolved,
      breached,
      escalated,
      resolutionRate,
      slaCompliance,
      mttrMinutes: mttr[0]?.avg ? Number(mttr[0].avg.toFixed(1)) : 0,
      mttrSamples: mttr[0]?.count || 0,
      avgRating: feedbackAgg[0]?.avg ? Number(feedbackAgg[0].avg.toFixed(2)) : 0,
      feedbackCount: feedbackAgg[0]?.count || 0,
      staffCount,
      passengerCount,
    },
    byStatus: byStatusAgg.map((s) => ({
      status: s._id,
      label: STATUS_LABELS[s._id] || s._id,
      count: s.count,
    })),
    byCategory: byCategoryAgg.map((c) => ({
      category: c._id,
      label: CATEGORY_MAP[c._id]?.label || c._id,
      count: c.count,
    })),
    byPriority: byPriorityAgg.map((p) => ({ priority: p._id, count: p.count })),
    byDepartment: byDepartmentAgg.map((d) => ({
      departmentId: d._id,
      name: deptName[String(d._id)] || 'Unassigned',
      count: d.count,
    })),
    trend: trend.map((t) => ({ date: t._id, intake: t.intake, resolved: t.resolved })),
  });
});

/** Officer operations dashboard. */
export const officerOverview = asyncHandler(async (req, res) => {
  const scope =
    req.user.role === ROLES.ADMIN
      ? {}
      : { $or: [{ assignedOfficer: req.user._id }, { department: req.user.department }] };

  const [active, mine, breached, resolvedToday, escalated, pendingTriage] = await Promise.all([
    Grievance.countDocuments({ ...scope, status: { $in: ACTIVE_STATUSES } }),
    Grievance.countDocuments({ assignedOfficer: req.user._id, status: { $in: ACTIVE_STATUSES } }),
    Grievance.countDocuments({ ...scope, 'sla.breached': true, status: { $in: ACTIVE_STATUSES } }),
    Grievance.countDocuments({
      assignedOfficer: req.user._id,
      'resolution.resolvedAt': { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    }),
    Grievance.countDocuments({ ...scope, 'escalation.level': { $gt: 0 } }),
    Grievance.countDocuments({ ...scope, status: 'triaged' }),
  ]);

  const queue = await Grievance.find({ ...scope, status: { $in: ACTIVE_STATUSES } })
    .sort({ severity: -1, 'sla.dueAt': 1 })
    .limit(8)
    .populate('department', 'name code')
    .populate('assignedOfficer', 'name designation')
    .populate('passenger', 'name pnr')
    .lean();

  res.json({
    success: true,
    kpis: { active, mine, breached, resolvedToday, escalated, pendingTriage },
    queue: queue.map((g) => ({
      ...g,
      slaRemainingMs: msRemaining(g.sla?.dueAt),
      slaBreached: Boolean(g.sla?.breached) || msRemaining(g.sla?.dueAt) < 0,
      slaRemainingLabel: slaStateLabel({
        status: g.status,
        breached: Boolean(g.sla?.breached) || msRemaining(g.sla?.dueAt) < 0,
        dueAt: g.sla?.dueAt,
      }),
    })),
  });
});

/** Passenger dashboard: personal statistics derived from their own records. */
export const passengerOverview = asyncHandler(async (req, res) => {
  const passenger = req.user._id;
  const [total, active, resolved, escalated, recent, feedbackAgg] = await Promise.all([
    Grievance.countDocuments({ passenger }),
    Grievance.countDocuments({ passenger, status: { $in: ACTIVE_STATUSES } }),
    Grievance.countDocuments({ passenger, status: { $in: ['resolved', 'closed'] } }),
    Grievance.countDocuments({ passenger, 'escalation.level': { $gt: 0 } }),
    Grievance.find({ passenger })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('department', 'name code')
      .populate('assignedOfficer', 'name designation')
      .lean(),
    Feedback.aggregate([
      { $match: { passenger } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]),
  ]);

  res.json({
    success: true,
    kpis: {
      total,
      active,
      resolved,
      escalated,
      avgRatingGiven: feedbackAgg[0]?.avg ? Number(feedbackAgg[0].avg.toFixed(1)) : 0,
      feedbackCount: feedbackAgg[0]?.count || 0,
    },
    recent,
  });
});

/** AI insights: engine transparency + systemic pattern detection from real data. */
export const aiInsights = asyncHandler(async (req, res) => {
  const { from, days } = rangeFromQuery(req.query);

  const [categoryAgg, recurring, duplicateAgg, confidenceAgg, escalatedPatterns, unresolved] = await Promise.all([
    Grievance.aggregate([
      { $match: { createdAt: { $gte: from } } },
      { $group: { _id: '$category', count: { $sum: 1 }, breached: { $sum: { $cond: ['$sla.breached', 1, 0] } } } },
      { $sort: { count: -1 } },
    ]),
    Grievance.aggregate([
      { $match: { createdAt: { $gte: from }, subCategory: { $ne: '' } } },
      { $group: { _id: { category: '$category', sub: '$subCategory' }, count: { $sum: 1 } } },
      { $match: { count: { $gte: 2 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    Grievance.countDocuments({ duplicateOf: { $ne: null } }),
    Grievance.aggregate([
      { $match: { 'aiTriage.confidence': { $ne: null } } },
      { $group: { _id: '$aiTriage.engine', avgConfidence: { $avg: '$aiTriage.confidence' }, count: { $sum: 1 } } },
    ]),
    Grievance.aggregate([
      { $match: { 'escalation.level': { $gt: 0 }, createdAt: { $gte: from } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    Grievance.countDocuments({ status: { $in: ACTIVE_STATUSES } }),
  ]);

  const totalInRange = categoryAgg.reduce((sum, c) => sum + c.count, 0);

  res.json({
    success: true,
    range: { days },
    engine: engineStatus(),
    totals: {
      analyzed: totalInRange,
      duplicatesClustered: duplicateAgg,
      unresolved,
    },
    categories: categoryAgg.map((c) => ({
      category: c._id,
      label: CATEGORY_MAP[c._id]?.label || c._id,
      count: c.count,
      share: totalInRange ? Number(((c.count / totalInRange) * 100).toFixed(1)) : 0,
      breached: c.breached,
    })),
    recurringPatterns: recurring.map((r) => ({
      category: r._id.category,
      label: CATEGORY_MAP[r._id.category]?.label || r._id.category,
      pattern: r._id.sub,
      count: r.count,
    })),
    escalationHotspots: escalatedPatterns.map((e) => ({
      category: e._id,
      label: CATEGORY_MAP[e._id]?.label || e._id,
      count: e.count,
    })),
    engineConfidence: confidenceAgg.map((c) => ({
      engine: c._id,
      avgConfidence: Number((c.avgConfidence || 0).toFixed(2)),
      samples: c.count,
    })),
  });
});

/** Reports console aggregates. */
export const reportSummary = asyncHandler(async (req, res) => {
  const { from, days } = rangeFromQuery(req.query);

  const [monthly, byDivision, slaByPriority, topSubjects, messageVolume] = await Promise.all([
    Grievance.aggregate([
      { $match: { createdAt: { $gte: from } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          intake: { $sum: 1 },
          resolved: { $sum: { $cond: [{ $ne: ['$resolution.resolvedAt', null] }, 1, 0] } },
          breached: { $sum: { $cond: ['$sla.breached', 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Grievance.aggregate([
      { $match: { createdAt: { $gte: from } } },
      { $group: { _id: '$station', count: { $sum: 1 } } },
      { $match: { _id: { $ne: '' } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    Grievance.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 }, breached: { $sum: { $cond: ['$sla.breached', 1, 0] } } } },
    ]),
    Grievance.aggregate([
      { $group: { _id: '$subject', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    Message.countDocuments({ createdAt: { $gte: from } }),
  ]);

  res.json({
    success: true,
    range: { days },
    monthly: monthly.map((m) => ({
      month: m._id,
      intake: m.intake,
      resolved: m.resolved,
      breached: m.breached,
    })),
    byStation: byDivision.map((d) => ({ station: d._id, count: d.count })),
    slaByPriority: slaByPriority.map((p) => ({
      priority: p._id,
      count: p.count,
      breached: p.breached,
      compliance: p.count ? Number((((p.count - p.breached) / p.count) * 100).toFixed(1)) : 100,
    })),
    topSubjects: topSubjects.map((s) => ({ subject: s._id, count: s.count })),
    messageVolume,
  });
});
