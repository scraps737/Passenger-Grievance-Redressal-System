import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true, index: true },
    description: { type: String, trim: true, default: '' },
    icon: { type: String, default: 'corporate_fare' },
    categories: { type: [String], default: [] },
    head: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    escalationUnit: { type: String, trim: true, default: '' },
    zone: { type: String, trim: true, default: 'Western Railway' },
    division: { type: String, trim: true, default: '' },
    slaHours: {
      tier1: { type: Number, default: 6, min: 1 },
      tier2: { type: Number, default: 24, min: 1 },
      tier3: { type: Number, default: 72, min: 1 },
    },
    capacity: { type: Number, default: 100, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Department = mongoose.model('Department', departmentSchema);
