import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { getAllSettings, setSetting, DEFAULT_SETTINGS } from '../services/settingsService.js';
import { listAuditLogs } from '../services/auditService.js';
import { recordAudit } from '../services/auditService.js';
import { CATEGORIES, SETTING_KEYS } from '../config/constants.js';
import { engineStatus } from '../services/aiTriage.js';
import { Grievance } from '../models/Grievance.js';

export const getSettings = asyncHandler(async (_req, res) => {
  const settings = await getAllSettings();
  res.json({
    success: true,
    settings,
    defaults: DEFAULT_SETTINGS,
    taxonomy: CATEGORIES,
    engine: engineStatus(),
  });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const payload = req.body;
  const allowed = Object.values(SETTING_KEYS);
  const updated = [];
  for (const [key, value] of Object.entries(payload)) {
    if (!allowed.includes(key)) continue;
    await setSetting(key, value, req.user._id);
    updated.push(key);
  }
  if (!updated.length) throw ApiError.badRequest('No recognised settings keys were supplied');

  await recordAudit({
    req,
    action: 'settings.updated',
    entity: 'Setting',
    description: `Updated settings: ${updated.join(', ')}`,
    severity: 'warning',
    meta: { updated },
  });

  res.json({ success: true, updated, settings: await getAllSettings() });
});

export const getAuditLogs = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Number.parseInt(req.query.limit, 10) || 25);
  const result = await listAuditLogs({
    page,
    limit,
    action: req.query.action,
    entity: req.query.entity,
    actor: req.query.actor,
    severity: req.query.severity,
  });

  const activeBreaches = await Grievance.countDocuments({ 'sla.breached': true });
  res.json({ success: true, ...result, activeBreaches });
});
