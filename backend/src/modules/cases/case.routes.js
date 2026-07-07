import { Router } from 'express';
import { env } from '../../config/env.js';
import { USER_ROLES } from '../../constants/roles.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/authorize.middleware.js';
import {
  createRecoveryCase,
  deleteRecoveryCase,
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
router.get('/:caseId/timeline', getRecoveryCaseTimeline);
router.get('/:caseId/custody', getRecoveryCaseCustody);

// Development/testing-only destructive endpoint. It is not registered in production.
if (env.nodeEnv !== 'production') {
  router.delete('/:caseId', authorize(USER_ROLES.ADMIN), deleteRecoveryCase);
}

export default router;
