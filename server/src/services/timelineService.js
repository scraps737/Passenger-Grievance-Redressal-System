import { TimelineEvent } from '../models/TimelineEvent.js';

export async function addTimelineEvent({
  grievance,
  type,
  title,
  description = '',
  actor = null,
  actorRole,
  meta = {},
}) {
  return TimelineEvent.create({
    grievance,
    type,
    title,
    description,
    actor: actor?._id || actor || null,
    actorRole: actorRole || actor?.role || 'system',
    meta,
  });
}

export async function getTimeline(grievanceId) {
  return TimelineEvent.find({ grievance: grievanceId }).sort({ createdAt: 1 }).lean();
}
