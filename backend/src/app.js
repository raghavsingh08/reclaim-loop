import cors from 'cors';
import express from 'express';
import { errorHandler, notFound } from './middlewares/error.middleware.js';
import authRoutes from './modules/auth/auth.routes.js';
import caseRoutes from './modules/cases/case.routes.js';
import pickupRoutes from './modules/pickups/pickup.routes.js';
import { ApiResponse } from './utils/ApiResponse.js';

export const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.status(200).json(new ApiResponse(200, { status: 'ok' }, 'ReclaimLoop API is healthy'));
});
app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/pickups', pickupRoutes);
app.use(notFound);
app.use(errorHandler);
