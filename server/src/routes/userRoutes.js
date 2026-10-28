import { Router } from 'express';
import { createUser, deleteUser, listOfficers, listUsers, updateUser } from '../controllers/userController.js';
import { requireAdmin, requireAuth, requireOfficer } from '../middleware/auth.js';
import { parsePagination, validate } from '../middleware/validate.js';
import { createUserSchema, updateUserSchema } from '../validators/schemas.js';

const router = Router();

router.use(requireAuth);

router.get('/officers', requireOfficer, listOfficers);

router.use(requireAdmin);
router.get('/', parsePagination(25), listUsers);
router.post('/', validate(createUserSchema), createUser);
router.patch('/:id', validate(updateUserSchema), updateUser);
router.delete('/:id', deleteUser);

export default router;
