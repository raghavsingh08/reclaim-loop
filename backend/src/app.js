import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { errorHandler, notFound } from './middlewares/error.middleware.js';
import { env } from './config/env.js';
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
app.set('trust proxy', 1);

const rateLimitHandler = (_req, res) => {
  res.status(429).json(new ApiResponse(429, null, 'Too many requests, please try again later'));
};

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

app.use(requestLogger);
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
}));

app.get('/health', (_req, res) => {
  res.status(200).json(new ApiResponse(200, { status: 'ok' }, 'ReclaimLoop API is healthy'));
});
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(['/api/auth/login', '/api/auth/register'], authRateLimiter);
app.use('/api', apiRateLimiter);
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
