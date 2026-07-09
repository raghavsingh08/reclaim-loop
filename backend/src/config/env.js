import dotenv from 'dotenv';

dotenv.config();

const requiredVariables = ['MONGODB_URI', 'JWT_SECRET'];
const nodeEnv = process.env.NODE_ENV || 'development';
const defaultDevelopmentOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const parseOrigins = (value) =>
  value
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) || [];

for (const variable of requiredVariables) {
  if (!process.env[variable]) {
    throw new Error(`Missing required environment variable: ${variable}`);
  }
}

const configuredCorsOrigins = parseOrigins(process.env.CORS_ORIGINS);
const corsOrigins =
  nodeEnv === 'production'
    ? configuredCorsOrigins
    : Array.from(new Set([...defaultDevelopmentOrigins, ...configuredCorsOrigins]));

export const env = Object.freeze({
  nodeEnv,
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigins,
});
