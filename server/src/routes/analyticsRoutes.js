import { Router } from 'express';
import {
  aiInsights,
  officerOverview,
  overview,
  passengerOverview,
  reportSummary,
} from '../controllers/analyticsController.js';
import { requireAdmin, requireAuth, requireOfficer } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/me', passengerOverview);
router.get('/officer', requireOfficer, officerOverview);
router.get('/overview', requireAdmin, overview);
router.get('/ai-insights', requireAdmin, aiInsights);
router.get('/reports', requireAdmin, reportSummary);

export default router;
