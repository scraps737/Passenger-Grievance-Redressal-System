import { Router } from 'express';
import {
  aiEngineInfo,
  assignGrievance,
  createGrievance,
  downloadAttachment,
  escalateGrievance,
  exportGrievancesCsv,
  generateResolutionOtp,
  getGrievance,
  listGrievances,
  overrideTriage,
  resolveGrievance,
  submitFeedback,
  trackGrievance,
  updateStatus,
  uploadAttachments,
} from '../controllers/grievanceController.js';
import { listMessages, postMessage } from '../controllers/messageController.js';
import { requireAuth, requireOfficer, optionalAuth } from '../middleware/auth.js';
import { parsePagination, validate } from '../middleware/validate.js';
import { upload } from '../middleware/upload.js';
import {
  assignSchema,
  createGrievanceSchema,
  escalateSchema,
  feedbackSchema,
  listGrievanceQuerySchema,
  messageSchema,
  resolveSchema,
  triageOverrideSchema,
  updateStatusSchema,
} from '../validators/schemas.js';

const router = Router();

router.get('/track/:referenceId', trackGrievance);
router.get('/ai-engine', aiEngineInfo);

router.use(requireAuth);

router
  .route('/')
  .get(validate(listGrievanceQuerySchema, 'query'), parsePagination(), listGrievances)
  .post(upload.array('evidence', 5), validate(createGrievanceSchema), createGrievance);

router.get('/export/csv', exportGrievancesCsv);

router.get('/:id', getGrievance);
router.post('/:id/attachments', upload.array('evidence', 5), uploadAttachments);
router.get('/:id/attachments/:attachmentId', downloadAttachment);

router.get('/:id/messages', listMessages);
router.post('/:id/messages', upload.array('evidence', 3), validate(messageSchema), postMessage);

router.patch('/:id/status', requireOfficer, validate(updateStatusSchema), updateStatus);
router.post('/:id/assign', requireOfficer, validate(assignSchema), assignGrievance);
router.post('/:id/escalate', requireOfficer, validate(escalateSchema), escalateGrievance);
router.post('/:id/triage/override', requireOfficer, validate(triageOverrideSchema), overrideTriage);
router.post('/:id/resolution-otp', requireOfficer, generateResolutionOtp);
router.post('/:id/resolve', requireOfficer, validate(resolveSchema), resolveGrievance);
router.post('/:id/feedback', validate(feedbackSchema), submitFeedback);

export default router;
