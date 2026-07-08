import { randomUUID } from 'node:crypto';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { logger } from '../config/logger.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const requestPath = (req) => {
  if (req.route?.path) return `${req.baseUrl || ''}${req.route.path}`;
  return req.path || req.url?.split('?')[0];
};

export const requestLogger = pinoHttp({
  logger,
  genReqId(req, res) {
    const suppliedId = req.headers['x-request-id'];
    const requestId = typeof suppliedId === 'string' && UUID_PATTERN.test(suppliedId)
      ? suppliedId
      : randomUUID();
    res.setHeader('X-Request-ID', requestId);
    return requestId;
  },
  quietReqLogger: true,
  autoLogging: {
    ignore: (req) => req.url?.split('?')[0] === '/health',
  },
  customLogLevel(_req, res) {
    // Unexpected 5xx errors are logged once by the global error middleware,
    // with the original Error rather than pino-http's generic status error.
    if (res.statusCode >= 500) return 'silent';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      path: req.url?.split('?')[0],
      remoteAddress: req.remoteAddress,
    }),
    res: (res) => ({ statusCode: res.statusCode }),
    err: pino.stdSerializers.err,
  },
  customSuccessObject(req, res, value) {
    return {
      ...value,
      requestId: req.id,
      method: req.method,
      path: requestPath(req),
      statusCode: res.statusCode,
      responseTimeMs: value.responseTime,
    };
  },
  customErrorObject(req, res, error, value) {
    return {
      ...value,
      requestId: req.id,
      method: req.method,
      path: requestPath(req),
      statusCode: res.statusCode,
      responseTimeMs: value.responseTime,
      err: error,
    };
  },
  customSuccessMessage: () => 'request completed',
  customErrorMessage: () => 'request failed',
});
