import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/User.js';
import { ROLE_VALUES, ROLES, USER_STATUS } from '../config/constants.js';

export function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.cookies?.token) return req.cookies.token;
  return null;
}

/** Populates req.user when a valid token is present; never throws. */
export async function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(decoded.sub);
    if (user && user.status !== USER_STATUS.SUSPENDED) req.user = user;
  } catch {
    // Invalid token on an optional route – continue as anonymous.
  }
  return next();
}

/** Requires a valid, active session. */
export async function requireAuth(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next(ApiError.unauthorized('Authentication token missing'));
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(decoded.sub);
    if (!user) return next(ApiError.unauthorized('Account no longer exists'));
    if (user.status === USER_STATUS.SUSPENDED)
      return next(ApiError.forbidden('Your account has been suspended'));
    req.user = user;
    return next();
  } catch (err) {
    return next(ApiError.unauthorized(err.name === 'TokenExpiredError' ? 'Session expired' : 'Invalid session token'));
  }
}

/**
 * Role gate. Usage: requireRole('admin') or requireRole('officer','admin').
 * Enforced server-side — the frontend never has the final say.
 */
export function requireRole(...roles) {
  const allowed = roles.flat().filter(Boolean);
  const valid = allowed.filter((r) => ROLE_VALUES.includes(r));
  if (!valid.length) throw new Error(`requireRole called with no valid roles: ${allowed.join(', ')}`);
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!valid.includes(req.user.role)) {
      return next(ApiError.forbidden(`Requires role: ${valid.join(' or ')}`));
    }
    return next();
  };
}

export const requireAdmin = requireRole(ROLES.ADMIN);
export const requireOfficer = requireRole(ROLES.OFFICER, ROLES.ADMIN);
