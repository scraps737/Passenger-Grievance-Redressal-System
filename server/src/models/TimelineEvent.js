import mongoose from 'mongoose';
import { TIMELINE_EVENT_TYPES } from '../config/constants.js';

const timelineEventSchema = new mongoose.Schema(
  {
    grievance: { type: mongoose.Schema.Types.ObjectId, ref: 'Grievance', required: true, index: true },
    type: { type: String, enum: Object.values(TIMELINE_EVENT_TYPES), required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, default: 'system' },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

timelineEventSchema.index({ grievance: 1, createdAt: 1 });

export const TimelineEvent = mongoose.model('TimelineEvent', timelineEventSchema);
