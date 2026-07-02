import { Router } from 'express';
import { USER_ROLES } from '../../constants/roles.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/authorize.middleware.js';
import { decide, getByCase, startReview } from './decision.controller.js';

const router = Router();
router.use(authenticate);
router.use(authorize(USER_ROLES.ADMIN));

router.post('/:caseId/start-review', startReview);
router.post('/:caseId/decide', decide);
router.get('/:caseId', getByCase);

export default router;
