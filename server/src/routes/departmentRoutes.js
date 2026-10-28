import { Router } from 'express';
import {
  createDepartment,
  deleteDepartment,
  getDepartment,
  listDepartments,
  updateDepartment,
} from '../controllers/departmentController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { departmentSchema } from '../validators/schemas.js';

const router = Router();
router.use(requireAuth);

router.get('/', listDepartments);
router.get('/:id', getDepartment);

router.post('/', requireAdmin, validate(departmentSchema), createDepartment);
router.patch('/:id', requireAdmin, validate(departmentSchema.partial()), updateDepartment);
router.delete('/:id', requireAdmin, deleteDepartment);

export default router;
