import { Router } from 'express';
import { getAuditLogs, getSettings, updateSettings } from '../controllers/settingsController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { settingsUpdateSchema } from '../validators/schemas.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/', getSettings);
router.patch('/', validate(settingsUpdateSchema), updateSettings);
router.get('/audit-logs', getAuditLogs);

export default router;
