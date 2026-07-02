import { Router } from 'express';
import { USER_ROLES } from '../../constants/roles.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/authorize.middleware.js';
import {
  adminDashboard,
  courierDashboard,
  customerDashboard,
  inspectorDashboard,
} from './dashboard.controller.js';

const router = Router();
router.use(authenticate);

router.get('/customer', authorize(USER_ROLES.CUSTOMER), customerDashboard);
router.get('/courier', authorize(USER_ROLES.COURIER), courierDashboard);
router.get('/inspector', authorize(USER_ROLES.INSPECTOR), inspectorDashboard);
router.get('/admin', authorize(USER_ROLES.ADMIN), adminDashboard);

export default router;
