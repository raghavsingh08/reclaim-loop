import { Router } from 'express';
import { USER_ROLES } from '../../constants/roles.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/authorize.middleware.js';
import { getUsers } from './user.controller.js';

const router = Router();

router.get('/', authenticate, authorize(USER_ROLES.ADMIN), getUsers);

export default router;
