export const CATEGORY_LABELS = {
  delay: 'Delays & Punctuality',
  overcrowding: 'Overcrowding',
  staff_behavior: 'Staff Behaviour',
  lost_property: 'Lost Property',
  ticketing_refund: 'Ticketing & Refunds',
  cleanliness: 'Cleanliness & Sanitation',
  safety: 'Safety & Security',
  accessibility: 'Accessibility',
  electrical_hvac: 'Electrical & HVAC Systems',
  mechanical: 'Coach Mechanical',
  medical: 'Medical & Transit Safety',
  other: 'Other',
};

export const CATEGORY_ICONS = {
  delay: 'schedule',
  overcrowding: 'groups',
  staff_behavior: 'badge',
  lost_property: 'luggage',
  ticketing_refund: 'confirmation_number',
  cleanliness: 'cleaning_services',
  safety: 'shield',
  accessibility: 'accessible',
  electrical_hvac: 'ac_unit',
  mechanical: 'build',
  medical: 'medical_services',
  other: 'more_horiz',
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

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

export const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

export const PRIORITY_LABELS = {
  tier1: 'Tier 1 · Critical',
  tier2: 'Tier 2 · High',
  tier3: 'Tier 3 · Standard',
};

export const TRANSPORT_MODE_LABELS = {
  rail: 'High-Speed Rail',
  metro: 'Metro Rapid Rail',
  intercity: 'Intercity Express',
  bus: 'City Bus Fleet',
  other: 'Other',
};

export function statusTone(status) {
  switch (status) {
    case 'escalated':
    case 'rejected':
      return 'urgent';
    case 'awaiting_clarification':
    case 'submitted':
      return 'pending';
    case 'resolved':
    case 'closed':
      return 'resolved';
    case 'triaged':
      return 'ai';
    default:
      return 'neutral';
  }
}

export function priorityTone(priority) {
  if (priority === 'tier1') return 'urgent';
  if (priority === 'tier2') return 'pending';
  return 'neutral';
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function relativeTime(value) {
  if (!value) return '—';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

export function slaLabel(ms) {
  if (ms === null || ms === undefined) return 'No SLA';
  const abs = Math.abs(ms);
  const mins = Math.floor(abs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const label = days > 0 ? `${days}d ${hours % 24}h` : hours > 0 ? `${hours}h ${mins % 60}m` : `${mins}m`;
  return ms < 0 ? `${label} overdue` : `${label} left`;
}

export function slaPercent(dueAt, hours, createdAt) {
  if (!dueAt || !hours) return 0;
  const start = new Date(createdAt).getTime();
  const end = new Date(dueAt).getTime();
  const now = Date.now();
  if (end === start) return 100;
  return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');
}

export function classNames(...values) {
  return values.filter(Boolean).join(' ');
}
