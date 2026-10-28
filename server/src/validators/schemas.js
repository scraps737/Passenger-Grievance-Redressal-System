import { z } from 'zod';
import {
  ACTIVE_STATUSES,
  CATEGORY_KEYS,
  PRIORITY_TIERS,
  ROLE_VALUES,
  STATUS_VALUES,
  TRANSPORT_MODES,
  USER_STATUS,
} from '../config/constants.js';

export const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid identifier');

/**
 * Accepts a real boolean or the strings "true"/"false". Multipart form
 * submissions (grievance creation with evidence files) stringify every field,
 * so booleans arrive as text there.
 */
const booleanish = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (lowered === 'true') return true;
    if (lowered === 'false') return false;
  }
  return value;
}, z.boolean());

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  phone: z.string().trim().max(20).optional().default(''),
  pnr: z.string().trim().max(20).optional().default(''),
  // `role` is deliberately absent: any client-supplied role is stripped and
  // self-registration always creates a passenger account.
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  alternateEmail: z.string().trim().email().optional().or(z.literal('')),
  pnr: z.string().trim().max(20).optional(),
  language: z.string().trim().max(8).optional(),
  zone: z.string().trim().max(80).optional(),
  division: z.string().trim().max(80).optional(),
  emergencyContact: z
    .object({ name: z.string().trim().max(80).optional(), phone: z.string().trim().max(20).optional() })
    .optional(),
  preferences: z
    .object({
      emailAlerts: z.boolean().optional(),
      smsAlerts: z.boolean().optional(),
      pushAlerts: z.boolean().optional(),
      language: z.string().max(8).optional(),
      defaultTransportMode: z.enum(TRANSPORT_MODES).optional(),
    })
    .optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});

export const createGrievanceSchema = z.object({
  subject: z.string().trim().min(5).max(160),
  description: z.string().trim().min(20, 'Please describe the issue in at least 20 characters').max(8000),
  categoryHint: z.enum(CATEGORY_KEYS).optional(),
  transportMode: z.enum(TRANSPORT_MODES).default('rail'),
  trainNumber: z.string().trim().max(20).optional().default(''),
  trainName: z.string().trim().max(120).optional().default(''),
  coach: z.string().trim().max(20).optional().default(''),
  berth: z.string().trim().max(20).optional().default(''),
  pnr: z.string().trim().max(20).optional().default(''),
  station: z.string().trim().max(120).optional().default(''),
  route: z.string().trim().max(160).optional().default(''),
  incidentLocation: z.string().trim().max(200).optional().default(''),
  incidentAt: z.coerce.date().optional(),
  runAiTriage: booleanish.optional().default(true),
});

export const updateStatusSchema = z.object({
  status: z.enum(STATUS_VALUES),
  note: z.string().trim().max(2000).optional().default(''),
});

export const assignSchema = z.object({
  officerId: objectId.optional(),
  departmentId: objectId.optional(),
  reason: z.string().trim().max(500).optional().default(''),
});

export const escalateSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
  escalatedToId: objectId.optional(),
});

export const triageOverrideSchema = z.object({
  category: z.enum(CATEGORY_KEYS).optional(),
  subCategory: z.string().trim().max(120).optional(),
  severity: z.number().int().min(1).max(4).optional(),
  priority: z.enum(Object.values(PRIORITY_TIERS)).optional(),
  departmentCode: z.string().trim().max(24).optional(),
  slaHours: z.number().min(1).max(720).optional(),
  summary: z.string().trim().max(600).optional(),
  reason: z.string().trim().min(3).max(500),
});

export const resolveSchema = z.object({
  notes: z.string().trim().min(5).max(4000),
  otp: z.string().trim().regex(/^\d{4,6}$/, 'OTP must be 4-6 digits').optional(),
});

export const messageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  kind: z.enum(['message', 'clarification_request', 'clarification_response', 'system_note']).default('message'),
});

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional().default(''),
  tags: z.array(z.string().max(40)).max(10).optional().default([]),
});

export const listGrievanceQuerySchema = z.object({
  status: z.union([z.enum(STATUS_VALUES), z.literal('active')]).optional(),
  category: z.enum(CATEGORY_KEYS).optional(),
  priority: z.enum(Object.values(PRIORITY_TIERS)).optional(),
  department: objectId.optional(),
  assignedOfficer: objectId.optional(),
  search: z.string().trim().max(160).optional(),
  slaBreached: z.enum(['true', 'false']).optional(),
  escalated: z.enum(['true', 'false']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(['latest', 'oldest', 'priority', 'sla']).optional().default('latest'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  role: z.enum([ROLE_VALUES[1], ROLE_VALUES[2]]),
  phone: z.string().trim().max(20).optional().default(''),
  employeeId: z.string().trim().max(40).optional().default(''),
  designation: z.string().trim().max(80).optional().default(''),
  department: objectId.optional().nullable(),
  zone: z.string().trim().max(80).optional().default(''),
  division: z.string().trim().max(80).optional().default(''),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  role: z.enum(ROLE_VALUES).optional(),
  status: z.enum(Object.values(USER_STATUS)).optional(),
  employeeId: z.string().trim().max(40).optional(),
  designation: z.string().trim().max(80).optional(),
  department: objectId.optional().nullable(),
  zone: z.string().trim().max(80).optional(),
  division: z.string().trim().max(80).optional(),
});

export const departmentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(24),
  description: z.string().trim().max(1000).optional().default(''),
  icon: z.string().trim().max(48).optional().default('corporate_fare'),
  categories: z.array(z.enum(CATEGORY_KEYS)).optional().default([]),
  head: objectId.optional().nullable(),
  escalationUnit: z.string().trim().max(120).optional().default(''),
  zone: z.string().trim().max(80).optional().default('Western Railway'),
  division: z.string().trim().max(80).optional().default(''),
  slaHours: z
    .object({
      tier1: z.number().min(1).max(720),
      tier2: z.number().min(1).max(720),
      tier3: z.number().min(1).max(720),
    })
    .optional(),
  capacity: z.number().min(0).max(100000).optional().default(100),
  active: z.boolean().optional().default(true),
});

export const settingsUpdateSchema = z.object({
  slaRules: z
    .object({
      tier1: z.number().min(1).max(720),
      tier2: z.number().min(1).max(720),
      tier3: z.number().min(1).max(720),
    })
    .optional(),
  aiConfig: z
    .object({
      autoTriage: z.boolean().optional(),
      officerOverrideAllowed: z.boolean().optional(),
      duplicateDetection: z.boolean().optional(),
      confidenceThreshold: z.number().min(0).max(1).optional(),
    })
    .optional(),
  notificationRules: z
    .object({
      onStatusChange: z.boolean().optional(),
      onAssignment: z.boolean().optional(),
      onMessage: z.boolean().optional(),
      onSlaBreach: z.boolean().optional(),
      slaWarningMinutes: z.number().min(0).max(1440).optional(),
    })
    .optional(),
  general: z
    .object({
      organisation: z.string().trim().max(160).optional(),
      timezone: z.string().trim().max(64).optional(),
      defaultLanguage: z.string().trim().max(8).optional(),
      dualOtpEnforced: z.boolean().optional(),
    })
    .optional(),
});

export { ACTIVE_STATUSES };
