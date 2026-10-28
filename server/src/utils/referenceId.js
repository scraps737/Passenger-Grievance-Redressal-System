import crypto from 'node:crypto';
import { Grievance } from '../models/Grievance.js';

/**
 * Generates a collision-resistant, human-readable grievance reference:
 *   GAI-<year>-<6 hex chars>   e.g. GAI-2026-4F9C21
 * Retries on the (unlikely) chance the unique index rejects it.
 */
export async function generateReferenceId(attempts = 5) {
  const year = new Date().getFullYear();
  for (let i = 0; i < attempts; i += 1) {
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const referenceId = `GAI-${year}-${suffix}`;
    const exists = await Grievance.exists({ referenceId });
    if (!exists) return referenceId;
  }
  // Fall back to a timestamp-based suffix; still unique in practice.
  return `GAI-${year}-${Date.now().toString(36).toUpperCase()}`;
}
