import mongoose from 'mongoose';
import { ROLE_VALUES, ROLES } from '../config/constants.js';

const messageSchema = new mongoose.Schema(
  {
    grievance: { type: mongoose.Schema.Types.ObjectId, ref: 'Grievance', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ROLE_VALUES, default: ROLES.PASSENGER },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    kind: {
      type: String,
      enum: ['message', 'clarification_request', 'clarification_response', 'system_note'],
      default: 'message',
    },
    attachments: {
      type: [
        {
          filename: String,
          originalName: String,
          mimetype: String,
          size: Number,
        },
      ],
      default: [],
    },
    readBy: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
  },
  { timestamps: true }
);

messageSchema.index({ grievance: 1, createdAt: 1 });

export const Message = mongoose.model('Message', messageSchema);
