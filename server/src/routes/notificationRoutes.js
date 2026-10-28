import { Router } from 'express';
import { getNotifications, readAllNotifications, readNotification } from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', getNotifications);
router.post('/read-all', readAllNotifications);
router.post('/:id/read', readNotification);

export default router;
