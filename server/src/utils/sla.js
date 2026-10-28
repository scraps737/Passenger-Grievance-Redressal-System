import { DEFAULT_SLA_HOURS, PRIORITY_TIERS } from '../config/constants.js';

/**
 * Resolves the SLA window (in hours) for a grievance, preferring a
 * department-level override, then a global setting, then the built-in default.
 */
export function resolveSlaHours({ priority, department, slaRules }) {
  const tier = priority || PRIORITY_TIERS.TIER3;
  if (department?.slaHours?.[tier]) return Number(department.slaHours[tier]);
  if (slaRules?.[tier]) return Number(slaRules[tier]);
  return DEFAULT_SLA_HOURS[tier] ?? DEFAULT_SLA_HOURS.tier3;
}

export function computeDueAt(from, hours) {
  return new Date(new Date(from).getTime() + hours * 60 * 60 * 1000);
}

/** Milliseconds remaining until the SLA deadline. Negative means breached. */
export function msRemaining(dueAt, now = new Date()) {
  if (!dueAt) return null;
  return new Date(dueAt).getTime() - now.getTime();
}

export function isBreached(dueAt, breachedFlag, now = new Date()) {
  if (breachedFlag) return true;
  const remaining = msRemaining(dueAt, now);
  return remaining !== null && remaining < 0;
}

export function formatRemaining(ms) {
  if (ms === null || ms === undefined) return 'No SLA';
  const abs = Math.abs(ms);
  const mins = Math.floor(abs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const label =
    days > 0 ? `${days}d ${hours % 24}h` : hours > 0 ? `${hours}h ${mins % 60}m` : `${mins}m`;
  return ms < 0 ? `${label} overdue` : `${label} left`;
}

/**
 * Human label for a case's SLA position. Terminal cases report how the case
 * closed rather than a live countdown, which would be misleading.
 */
export function slaStateLabel({ status, breached, dueAt, now = new Date() }) {
  const remaining = msRemaining(dueAt, now);
  if (status === 'rejected') return 'Rejected';
  if (['resolved', 'closed'].includes(status)) {
    return breached || (remaining !== null && remaining < 0) ? 'Closed beyond SLA' : 'Closed within SLA';
  }
  return formatRemaining(remaining);
}

/**
 * Marks a grievance's SLA as breached when the deadline has passed.
 * Returns true when a state change was made.
 */
export function syncSlaState(grievance, now = new Date()) {
  if (!grievance?.sla?.dueAt) return false;
  const terminal = ['resolved', 'closed', 'rejected'].includes(grievance.status);
  const overdue = msRemaining(grievance.sla.dueAt, now) < 0;
  if (overdue && !grievance.sla.breached) {
    grievance.sla.breached = true;
    grievance.sla.breachedAt = now;
    return true;
  }
  if (!overdue && !terminal && grievance.sla.breached) {
    // SLA extended (e.g. priority lowered) – clear the breach window.
    grievance.sla.breached = false;
    grievance.sla.breachedAt = null;
    return true;
  }
  return false;
}
