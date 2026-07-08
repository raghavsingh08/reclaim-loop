import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export const notFound = (req, _res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

export const errorHandler = (error, req, res, _next) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal server error';
  let isOperational = error.isOperational === true;
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(error.errors).map((item) => item.message).join(', ');
    isOperational = true;
  }
  if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid identifier';
    isOperational = true;
  }
  if (error.code === 11000) {
    statusCode = 409;
    message = error.keyPattern?.email
      ? 'A user with this email already exists'
      : 'A record with the same unique field already exists';
    isOperational = true;
  }
  if (statusCode < 500) isOperational = true;

  if (statusCode >= 500 && !isOperational) {
    (req.log || logger).error(
      { err: error, requestId: req.id },
      'Unexpected request error',
    );
    if (env.nodeEnv === 'production') message = 'Internal server error';
  }

  res.status(statusCode).json({
    success: false,
    ...((isOperational || env.nodeEnv === 'development') &&
      typeof error.code === 'string' && { code: error.code }),
    message,
    errors: isOperational || env.nodeEnv === 'development' ? error.errors || [] : [],
    ...(env.nodeEnv === 'development' && { stack: error.stack }),
  });
};
