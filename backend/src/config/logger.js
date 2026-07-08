import pino from 'pino';

const nodeEnv = process.env.NODE_ENV || 'development';
const defaultLevels = {
  development: 'debug',
  production: 'info',
  test: 'silent',
};

export const logger = pino({
  level: process.env.LOG_LEVEL || defaultLevels[nodeEnv] || 'info',
  base: {
    service: 'reclaimloop-backend',
    environment: nodeEnv,
    pid: process.pid,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'authorization',
      'cookie',
      'password',
      'passwordHash',
      'token',
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["idempotency-key"]',
      'req.body',
      'request.body',
    ],
    censor: '[REDACTED]',
  },
});
