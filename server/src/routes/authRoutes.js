import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  changePassword,
  login,
  me,
  register,
  updateProfile,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from '../validators/schemas.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' },
});

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.get('/me', requireAuth, me);
router.patch('/me', requireAuth, validate(updateProfileSchema), updateProfile);
router.post('/change-password', requireAuth, validate(changePasswordSchema), changePassword);

export default router;
