import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { signToken } from '../middleware/auth.js';
import { recordAudit } from '../services/auditService.js';
import { ROLES } from '../config/constants.js';

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, pnr } = req.body;
  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const user = await User.create({
    name,
    email,
    password,
    phone: phone || '',
    pnr: pnr || '',
    // Public self-registration can only ever create passengers.
    role: ROLES.PASSENGER,
  });

  await recordAudit({
    req,
    action: 'user.register',
    entity: 'User',
    entityId: user._id,
    description: `Passenger ${user.email} registered`,
    actor: user,
  });

  res.status(201).json({ success: true, token: signToken(user), user: user.toSafeJSON() });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  const ok = await user.comparePassword(password);
  if (!ok) {
    await recordAudit({
      req,
      action: 'auth.login_failed',
      entity: 'User',
      entityId: user._id,
      description: `Failed login for ${user.email}`,
      severity: 'warning',
      actor: user,
    });
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (user.status === 'suspended') throw ApiError.forbidden('Your account has been suspended');

  user.lastLoginAt = new Date();
  await user.save();

  await recordAudit({
    req,
    action: 'auth.login',
    entity: 'User',
    entityId: user._id,
    description: `${user.role} ${user.email} signed in`,
    actor: user,
  });

  res.json({ success: true, token: signToken(user), user: user.toSafeJSON() });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user.toSafeJSON() });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const updates = req.body;
  const user = await User.findById(req.user._id);
  if (!user) throw ApiError.notFound('Account not found');

  const simple = ['name', 'phone', 'alternateEmail', 'pnr', 'language', 'zone', 'division'];
  for (const key of simple) {
    if (updates[key] !== undefined) user[key] = updates[key];
  }
  if (updates.emergencyContact) {
    user.emergencyContact = { ...user.emergencyContact.toObject?.() ?? {}, ...updates.emergencyContact };
  }
  if (updates.preferences) {
    user.preferences = { ...user.preferences.toObject?.() ?? {}, ...updates.preferences };
  }
  await user.save();

  await recordAudit({
    req,
    action: 'user.profile_updated',
    entity: 'User',
    entityId: user._id,
    description: 'Profile updated',
  });

  res.json({ success: true, user: user.toSafeJSON() });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');
  const ok = await user.comparePassword(currentPassword);
  if (!ok) throw ApiError.badRequest('Current password is incorrect');

  user.password = newPassword;
  await user.save();

  await recordAudit({
    req,
    action: 'user.password_changed',
    entity: 'User',
    entityId: user._id,
    description: 'Password changed',
    severity: 'warning',
  });

  res.json({ success: true, message: 'Password updated successfully' });
});

export const hashPassword = (plain) => bcrypt.hash(plain, 12);
