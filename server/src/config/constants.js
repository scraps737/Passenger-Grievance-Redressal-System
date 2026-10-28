/**
 * Domain constants shared across models, services and controllers.
 * The category taxonomy covers every grievance type required by the
 * specification plus the operational wings present in the Stitch designs.
 */

export const ROLES = Object.freeze({
  PASSENGER: 'passenger',
  OFFICER: 'officer',
  ADMIN: 'admin',
});

export const ROLE_VALUES = Object.values(ROLES);

export const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  PENDING: 'pending',
  SUSPENDED: 'suspended',
});

export const PRIORITY_TIERS = Object.freeze({
  TIER1: 'tier1',
  TIER2: 'tier2',
  TIER3: 'tier3',
});

export const PRIORITY_LABELS = {
  tier1: 'Tier 1 · Critical',
  tier2: 'Tier 2 · High',
  tier3: 'Tier 3 · Standard',
};

/** Statutory SLA windows in hours per priority tier (defaults, overridable). */
export const DEFAULT_SLA_HOURS = {
  tier1: 6,
  tier2: 24,
  tier3: 72,
};

export const GRIEVANCE_STATUS = Object.freeze({
  SUBMITTED: 'submitted',
  TRIAGED: 'triaged',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  AWAITING_CLARIFICATION: 'awaiting_clarification',
  ESCALATED: 'escalated',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  REJECTED: 'rejected',
});

export const STATUS_VALUES = Object.values(GRIEVANCE_STATUS);

export const STATUS_LABELS = {
  submitted: 'Submitted',
  triaged: 'AI Triaged',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  awaiting_clarification: 'Awaiting Clarification',
  escalated: 'Escalated',
  resolved: 'Resolved',
  closed: 'Closed',
  rejected: 'Rejected',
};

export const ACTIVE_STATUSES = [
  GRIEVANCE_STATUS.SUBMITTED,
  GRIEVANCE_STATUS.TRIAGED,
  GRIEVANCE_STATUS.ASSIGNED,
  GRIEVANCE_STATUS.IN_PROGRESS,
  GRIEVANCE_STATUS.AWAITING_CLARIFICATION,
  GRIEVANCE_STATUS.ESCALATED,
];

/**
 * Master category taxonomy. `key` is the stable machine value stored on
 * grievances; `defaultDepartment` seeds the AI/rule-based routing decision.
 */
export const CATEGORIES = Object.freeze([
  {
    key: 'delay',
    label: 'Delays & Punctuality',
    icon: 'schedule',
    defaultTier: PRIORITY_TIERS.TIER3,
    defaultDepartment: 'OPS',
    description: 'Late running, missed connections and schedule deviation.',
  },
  {
    key: 'overcrowding',
    label: 'Overcrowding',
    icon: 'groups',
    defaultTier: PRIORITY_TIERS.TIER2,
    defaultDepartment: 'OPS',
    description: 'Excess passengers, unauthorised boarding and congestion.',
  },
  {
    key: 'staff_behavior',
    label: 'Staff Behaviour',
    icon: 'badge',
    defaultTier: PRIORITY_TIERS.TIER2,
    defaultDepartment: 'COMM',
    description: 'Misconduct, unresponsiveness or unprofessional conduct.',
  },
  {
    key: 'lost_property',
    label: 'Lost Property',
    icon: 'luggage',
    defaultTier: PRIORITY_TIERS.TIER3,
    defaultDepartment: 'SEC',
    description: 'Misplaced or left-behind belongings and retrieval requests.',
  },
  {
    key: 'ticketing_refund',
    label: 'Ticketing & Refunds',
    icon: 'confirmation_number',
    defaultTier: PRIORITY_TIERS.TIER2,
    defaultDepartment: 'COMM',
    description: 'Booking, cancellation, refund and fare disputes.',
  },
  {
    key: 'cleanliness',
    label: 'Cleanliness & Sanitation',
    icon: 'cleaning_services',
    defaultTier: PRIORITY_TIERS.TIER3,
    defaultDepartment: 'OBHS',
    description: 'Coach hygiene, bio-toilets, waste and pest control.',
  },
  {
    key: 'safety',
    label: 'Safety & Security',
    icon: 'shield',
    defaultTier: PRIORITY_TIERS.TIER1,
    defaultDepartment: 'SEC',
    description: 'Security threats, unsafe conditions and theft.',
  },
  {
    key: 'accessibility',
    label: 'Accessibility',
    icon: 'accessible',
    defaultTier: PRIORITY_TIERS.TIER2,
    defaultDepartment: 'COMM',
    description: 'Wheelchair access, ramps, signage and assisted travel.',
  },
  {
    key: 'electrical_hvac',
    label: 'Electrical & HVAC Systems',
    icon: 'ac_unit',
    defaultTier: PRIORITY_TIERS.TIER2,
    defaultDepartment: 'ELEC',
    description: 'AC, lighting, sockets, inverters and power systems.',
  },
  {
    key: 'mechanical',
    label: 'Coach Mechanical',
    icon: 'build',
    defaultTier: PRIORITY_TIERS.TIER2,
    defaultDepartment: 'MECH',
    description: 'Doors, brakes, suspension, couplers and undergear faults.',
  },
  {
    key: 'medical',
    label: 'Medical & Transit Safety',
    icon: 'medical_services',
    defaultTier: PRIORITY_TIERS.TIER1,
    defaultDepartment: 'MED',
    description: 'Onboard medical emergencies and health hazards.',
  },
  {
    key: 'other',
    label: 'Other',
    icon: 'more_horiz',
    defaultTier: PRIORITY_TIERS.TIER3,
    defaultDepartment: 'OPS',
    description: 'Anything not covered by another category.',
  },
]);

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

export const SEVERITY_LEVELS = Object.freeze({
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
});

export const TRANSPORT_MODES = ['rail', 'metro', 'intercity', 'bus', 'other'];

export const NOTIFICATION_TYPES = Object.freeze({
  STATUS: 'status',
  MESSAGE: 'message',
  CLARIFICATION: 'clarification',
  ASSIGNMENT: 'assignment',
  ESCALATION: 'escalation',
  SLA: 'sla',
  SYSTEM: 'system',
});

export const TIMELINE_EVENT_TYPES = Object.freeze({
  CREATED: 'created',
  AI_TRIAGE: 'ai_triage',
  ASSIGNED: 'assigned',
  REASSIGNED: 'reassigned',
  STATUS_CHANGE: 'status_change',
  MESSAGE: 'message',
  CLARIFICATION_REQUESTED: 'clarification_requested',
  CLARIFICATION_RESPONDED: 'clarification_responded',
  ESCALATED: 'escalated',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  REJECTED: 'rejected',
  FEEDBACK: 'feedback',
  SLA_BREACH: 'sla_breach',
});

/** Tokens used by the rule-based AI fallback for keyword→category routing. */
export const CATEGORY_KEYWORDS = Object.freeze({
  delay: ['delay', 'late', 'late running', 'missed connection', 'schedule', 'punctual', 'held up', 'waiting'],
  overcrowding: ['crowd', 'overcrowd', 'overcrowded', 'packed', 'rush', 'standing', 'no seat', 'unreserved', 'capacity'],
  staff_behavior: ['staff', 'attendant', 'rude', 'misbehav', 'behaviour', 'behavior', 'unhelpful', 'ignored', 'no response', 'ticket checker', 'tt'],
  lost_property: ['lost', 'left behind', 'misplaced', 'forgot', 'belongings', 'luggage missing', 'bag', 'mobile left', 'wallet'],
  ticketing_refund: ['refund', 'ticket', 'fare', 'booking', 'cancel', 'charge', 'overcharge', 'agent', 'pnr issue', 'double charge', 'money'],
  cleanliness: ['dirty', 'clean', 'toilet', 'bio-toilet', 'smell', 'garbage', 'waste', 'pest', 'cockroach', 'bedroll', 'dirty coach', 'hygiene'],
  safety: ['unsafe', 'safety', 'security', 'theft', 'stolen', 'chain', 'harass', 'threat', 'drunk', 'danger', 'fire', 'smoke', 'window broken'],
  accessibility: ['wheelchair', 'disabled', 'divyang', 'ramp', 'accessib', 'handicap', 'lift', 'escalator', 'assistance', 'blind', 'elderly board'],
  electrical_hvac: ['ac', 'air condition', 'air-condition', 'cooling', 'thermostat', 'heating', 'fan', 'light', 'socket', 'charging', 'inverter', 'hvac', 'temperature'],
  mechanical: ['brake', 'door', 'coupler', 'suspension', 'wheel', 'bogie', 'vibration', 'noise', 'seat broken', 'berth', 'window', 'jerk'],
  medical: ['medical', 'doctor', 'chest pain', 'breathless', 'breathing', 'injury', 'unconscious', 'ambulance', 'sick', 'fever', 'emergency', 'hospital'],
  other: [],
});

/** Phrases that push severity/priority upward. */
export const URGENCY_KEYWORDS = [
  'emergency', 'urgent', 'critical', 'immediately', 'sos', 'chest pain', 'breathless',
  'unconscious', 'bleeding', 'fire', 'smoke', 'harass', 'threat', 'assault', 'unsafe',
  'child', 'infant', 'elderly', 'senior citizen', 'wheelchair', 'stuck', 'trapped',
];

export const VULNERABILITY_KEYWORDS = [
  'elderly', 'senior citizen', 'child', 'infant', 'pregnant', 'disabled', 'divyang',
  'wheelchair', 'patient', 'sick',
];

export const SETTING_KEYS = Object.freeze({
  SLA_RULES: 'slaRules',
  CATEGORY_TAXONOMY: 'categoryTaxonomy',
  AI_CONFIG: 'aiConfig',
  NOTIFICATION_RULES: 'notificationRules',
  GENERAL: 'general',
});
