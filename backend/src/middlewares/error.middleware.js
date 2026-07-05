import { env } from '../config/env.js';

export const notFound = (req, _res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

export const errorHandler = (error, _req, res, _next) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal server error';
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(error.errors).map((item) => item.message).join(', ');
  }
  if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid identifier';
  }
  if (error.code === 11000) {
    statusCode = 409;
    message = error.keyPattern?.email
      ? 'A user with this email already exists'
      : 'A record with the same unique field already exists';
  }
  res.status(statusCode).json({
    success: false,
    ...(typeof error.code === 'string' && { code: error.code }),
    message,
    errors: error.errors || [],
    ...(env.nodeEnv === 'development' && { stack: error.stack }),
  });
};
