import { Router } from 'express';
import { USER_ROLES } from '../../constants/roles.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/authorize.middleware.js';
import {
  changeRecoveryCaseStatus,
  createRecoveryCase,
  getRecoveryCase,
  getRecoveryCaseCustody,
  getRecoveryCases,
  getRecoveryCaseTimeline,
} from './case.controller.js';

const router = Router();
router.use(authenticate);

router.post('/', authorize(USER_ROLES.CUSTOMER), createRecoveryCase);
router.get('/', getRecoveryCases);
router.get('/:caseId', getRecoveryCase);
router.patch(
  '/:caseId/status',
  authorize(USER_ROLES.ADMIN, USER_ROLES.COURIER, USER_ROLES.INSPECTOR),
  changeRecoveryCaseStatus,
);
router.get('/:caseId/timeline', getRecoveryCaseTimeline);
router.get('/:caseId/custody', getRecoveryCaseCustody);

export default router;
