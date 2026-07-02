import { Router } from 'express';
import { USER_ROLES } from '../../constants/roles.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/authorize.middleware.js';
import { create, getOne, list, receive, updateCapacity } from './facility.controller.js';

const router = Router();
router.use(authenticate);

router.post('/', authorize(USER_ROLES.ADMIN), create);
router.get(
  '/',
  authorize(USER_ROLES.ADMIN, USER_ROLES.INSPECTOR, USER_ROLES.COURIER),
  list,
);
router.get(
  '/:facilityId',
  authorize(USER_ROLES.ADMIN, USER_ROLES.INSPECTOR, USER_ROLES.COURIER),
  getOne,
);
router.patch('/:facilityId/capacity', authorize(USER_ROLES.ADMIN), updateCapacity);
router.patch(
  '/:facilityId/receive/:caseId',
  authorize(USER_ROLES.ADMIN, USER_ROLES.INSPECTOR),
  receive,
);

export default router;
