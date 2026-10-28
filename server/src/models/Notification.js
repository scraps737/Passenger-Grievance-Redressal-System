import mongoose from 'mongoose';
import { NOTIFICATION_TYPES } from '../config/constants.js';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: '' },
    type: { type: String, enum: Object.values(NOTIFICATION_TYPES), default: NOTIFICATION_TYPES.SYSTEM },
    grievance: { type: mongoose.Schema.Types.ObjectId, ref: 'Grievance', default: null },
    referenceId: { type: String, default: '' },
    link: { type: String, default: '' },
    priority: { type: String, enum: ['low', 'normal', 'high', 'critical'], default: 'normal' },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
