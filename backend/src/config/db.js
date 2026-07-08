import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

export const connectDatabase = async () => {
  await mongoose.connect(env.mongoUri);
  logger.info({ mongoHost: mongoose.connection.host }, 'MongoDB connected');
};
