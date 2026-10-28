import mongoose from 'mongoose';
import { GRIEVANCE_STATUS, PRIORITY_TIERS, STATUS_VALUES, TRANSPORT_MODES } from '../config/constants.js';

const attachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    originalName: { type: String, default: '' },
    mimetype: { type: String, default: '' },
    size: { type: Number, default: 0 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const aiTriageSchema = new mongoose.Schema(
  {
    engine: { type: String, required: true },
    provider: { type: String, default: 'rule-based' },
    model: { type: String, default: 'fallback-v1' },
    category: { type: String, required: true },
    subCategory: { type: String, default: '' },
    severity: { type: Number, min: 1, max: 4, default: 2 },
    priority: { type: String, enum: Object.values(PRIORITY_TIERS), default: PRIORITY_TIERS.TIER3 },
    departmentCode: { type: String, default: '' },
    slaHours: { type: Number, default: 72 },
    summary: { type: String, default: '' },
    nextSteps: { type: [String], default: [] },
    sentiment: { type: String, default: 'neutral' },
    confidence: { type: Number, min: 0, max: 1, default: 0.5 },
    duplicateCandidates: {
      type: [
        {
          grievance: { type: mongoose.Schema.Types.ObjectId, ref: 'Grievance' },
          referenceId: String,
          score: Number,
          reason: String,
        },
      ],
      default: [],
    },
    notes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    overriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    overriddenAt: { type: Date, default: null },
    overrideReason: { type: String, default: '' },
    original: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const slaSchema = new mongoose.Schema(
  {
    hours: { type: Number, default: 72 },
    dueAt: { type: Date, default: null },
    breached: { type: Boolean, default: false },
    breachedAt: { type: Date, default: null },
    pausedMs: { type: Number, default: 0 },
  },
  { _id: false }
);

const grievanceSchema = new mongoose.Schema(
  {
    referenceId: { type: String, required: true, unique: true, index: true },
    passenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 8000 },
    category: { type: String, required: true, index: true },
    subCategory: { type: String, default: '' },
    severity: { type: Number, min: 1, max: 4, default: 2 },
    priority: {
      type: String,
      enum: Object.values(PRIORITY_TIERS),
      default: PRIORITY_TIERS.TIER3,
      index: true,
    },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
    assignedOfficer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    status: {
      type: String,
      enum: STATUS_VALUES,
      default: GRIEVANCE_STATUS.SUBMITTED,
      index: true,
    },
    transportMode: { type: String, enum: TRANSPORT_MODES, default: 'rail' },
    trainNumber: { type: String, trim: true, default: '' },
    trainName: { type: String, trim: true, default: '' },
    coach: { type: String, trim: true, default: '' },
    berth: { type: String, trim: true, default: '' },
    pnr: { type: String, trim: true, default: '' },
    station: { type: String, trim: true, default: '' },
    route: { type: String, trim: true, default: '' },
    incidentLocation: { type: String, trim: true, default: '' },
    incidentAt: { type: Date, default: null },
    attachments: { type: [attachmentSchema], default: [] },
    aiTriage: { type: aiTriageSchema, default: null },
    sla: { type: slaSchema, default: () => ({}) },
    escalation: {
      level: { type: Number, default: 0 },
      escalatedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      reason: { type: String, default: '' },
      escalatedAt: { type: Date, default: null },
    },
    clarification: {
      requested: { type: Boolean, default: false },
      requestedAt: { type: Date, default: null },
      respondedAt: { type: Date, default: null },
    },
    duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Grievance', default: null },
    resolution: {
      notes: { type: String, default: '' },
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      resolvedAt: { type: Date, default: null },
      proof: { type: [attachmentSchema], default: [] },
      otpHash: { type: String, default: '', select: false },
      otpVerified: { type: Boolean, default: false },
      otpExpiresAt: { type: Date, default: null, select: false },
    },
    rejectionReason: { type: String, default: '' },
    tags: { type: [String], default: [] },
    views: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

grievanceSchema.index({ createdAt: -1 });
grievanceSchema.index({ subject: 'text', description: 'text', referenceId: 'text' });

grievanceSchema.virtual('isActive').get(function isActive() {
  return ![GRIEVANCE_STATUS.RESOLVED, GRIEVANCE_STATUS.CLOSED, GRIEVANCE_STATUS.REJECTED].includes(
    this.status
  );
});

export const Grievance = mongoose.model('Grievance', grievanceSchema);
