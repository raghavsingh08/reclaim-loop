import cors from 'cors';
import express from 'express';
import { errorHandler, notFound } from './middlewares/error.middleware.js';
import { requestLogger } from './middlewares/requestLogger.middleware.js';
import authRoutes from './modules/auth/auth.routes.js';
import caseRoutes from './modules/cases/case.routes.js';
import decisionRoutes from './modules/decisions/decision.routes.js';
import facilityRoutes from './modules/facilities/facility.routes.js';
import inspectionRoutes from './modules/inspections/inspection.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import pickupRoutes from './modules/pickups/pickup.routes.js';
import refundRoutes from './modules/refunds/refund.routes.js';
import userRoutes from './modules/users/user.routes.js';
import { ApiResponse } from './utils/ApiResponse.js';

export const app = express();
app.use(requestLogger);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.status(200).json(new ApiResponse(200, { status: 'ok' }, 'ReclaimLoop API is healthy'));
});
app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/decisions', decisionRoutes);
app.use('/api/pickups', pickupRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use(notFound);
app.use(errorHandler);
