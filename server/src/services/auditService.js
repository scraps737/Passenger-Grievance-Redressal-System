import { AuditLog } from '../models/AuditLog.js';

export async function recordAudit({
  req,
  action,
  entity,
  entityId = '',
  description = '',
  meta = {},
  severity = 'info',
  actor = null,
}) {
  const user = actor || req?.user || null;
  try {
    return await AuditLog.create({
      actor: user?._id || null,
      actorName: user?.name || 'system',
      actorRole: user?.role || 'system',
      action,
      entity,
      entityId: String(entityId || ''),
      description,
      meta,
      ip: req?.ip || '',
      userAgent: req?.headers?.['user-agent'] || '',
      severity,
    });
  } catch (err) {
    // Audit failures must never break the request path.
    console.error('[audit] failed to record entry:', err.message);
    return null;
  }
}

export async function listAuditLogs({ page = 1, limit = 25, action, entity, actor, severity } = {}) {
  const filter = {};
  if (action) filter.action = action;
  if (entity) filter.entity = entity;
  if (actor) filter.actor = actor;
  if (severity) filter.severity = severity;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('actor', 'name email role')
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) || 1 };
}
