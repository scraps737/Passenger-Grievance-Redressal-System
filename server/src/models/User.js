import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLE_VALUES, ROLES, USER_STATUS } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, select: false, minlength: 8 },
    role: { type: String, enum: ROLE_VALUES, default: ROLES.PASSENGER, index: true },
    phone: { type: String, trim: true, default: '' },
    alternateEmail: { type: String, trim: true, lowercase: true, default: '' },
    emergencyContact: {
      name: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
      index: true,
    },
    employeeId: { type: String, trim: true, default: '' },
    designation: { type: String, trim: true, default: '' },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    zone: { type: String, trim: true, default: '' },
    division: { type: String, trim: true, default: '' },
    language: { type: String, default: 'en' },
    pnr: { type: String, trim: true, default: '' },
    trustScore: { type: Number, default: 100, min: 0, max: 100 },
    preferences: {
      emailAlerts: { type: Boolean, default: true },
      smsAlerts: { type: Boolean, default: true },
      pushAlerts: { type: Boolean, default: true },
      language: { type: String, default: 'en' },
      defaultTransportMode: { type: String, default: 'rail' },
    },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ name: 'text', email: 'text', employeeId: 'text' });

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    phone: this.phone,
    status: this.status,
    employeeId: this.employeeId,
    designation: this.designation,
    department: this.department,
    zone: this.zone,
    division: this.division,
    language: this.language,
    pnr: this.pnr,
    trustScore: this.trustScore,
    preferences: this.preferences,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model('User', userSchema);
