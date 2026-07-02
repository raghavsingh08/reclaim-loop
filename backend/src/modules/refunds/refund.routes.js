import { Router } from 'express';
import { USER_ROLES } from '../../constants/roles.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/authorize.middleware.js';
import { approve, getByCase, record } from './refund.controller.js';

const router = Router();
router.use(authenticate);
router.use(authorize(USER_ROLES.ADMIN));

router.post('/:caseId/approve', approve);
router.post('/:caseId/record', record);
router.get('/:caseId', getByCase);

export default router;
