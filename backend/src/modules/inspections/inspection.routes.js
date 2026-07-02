import { Router } from 'express';
import { USER_ROLES } from '../../constants/roles.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/authorize.middleware.js';
import { assign, complete, getMine, getOne, start } from './inspection.controller.js';

const router = Router();
router.use(authenticate);
router.use(authorize(USER_ROLES.INSPECTOR, USER_ROLES.ADMIN));

router.post('/:caseId/assign', authorize(USER_ROLES.ADMIN), assign);
router.get('/my', authorize(USER_ROLES.INSPECTOR), getMine);
router.post('/:caseId/start', start);
router.post('/:caseId/complete', complete);
router.get('/:caseId', getOne);

export default router;
