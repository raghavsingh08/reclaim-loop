import { Router } from 'express';
import { USER_ROLES } from '../../constants/roles.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/authorize.middleware.js';
import { accept, assign, collect, fail, getMine } from './pickup.controller.js';

const router = Router();
router.use(authenticate);

router.post('/assign', authorize(USER_ROLES.ADMIN), assign);
router.get('/my', authorize(USER_ROLES.COURIER), getMine);
router.patch('/:pickupId/accept', authorize(USER_ROLES.COURIER), accept);
router.patch('/:pickupId/collect', authorize(USER_ROLES.COURIER), collect);
router.patch('/:pickupId/fail', authorize(USER_ROLES.COURIER), fail);

export default router;
