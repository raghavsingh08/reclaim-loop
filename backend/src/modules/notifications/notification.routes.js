import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { list, markAllRead, markRead } from './notification.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', list);
router.patch('/read-all', markAllRead);
router.patch('/:notificationId/read', markRead);

export default router;
