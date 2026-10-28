import { Router } from 'express';
import mongoose from 'mongoose';
import authRoutes from './authRoutes.js';
import grievanceRoutes from './grievanceRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import userRoutes from './userRoutes.js';
import departmentRoutes from './departmentRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';
import settingsRoutes from './settingsRoutes.js';
import { engineStatus } from '../services/aiTriage.js';
import { publicStats } from '../controllers/analyticsController.js';

const router = Router();

router.get('/stats', publicStats);

router.get('/health', (_req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    success: true,
    status: 'ok',
    database: states[mongoose.connection.readyState] || 'unknown',
    ai: engineStatus(),
    time: new Date().toISOString(),
  });
});

router.use('/auth', authRoutes);
router.use('/grievances', grievanceRoutes);
router.use('/notifications', notificationRoutes);
router.use('/users', userRoutes);
router.use('/departments', departmentRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/settings', settingsRoutes);

export default router;
