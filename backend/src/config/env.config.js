import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

/**
 * Derives a deterministic cryptographic secret from database credentials
 * if explicit secrets are not provided in environment.
 */
const deriveSecret = (purpose) => {
  const base = process.env.DATABASE_URL || process.env.DB_PASSWORD;
  return base
    ? crypto.createHmac('sha256', base).update(`ddpl:${purpose}`).digest('hex')
    : crypto.randomBytes(48).toString('hex');
};

const jwtSecret = process.env.JWT_SECRET || (() => {
  console.warn('⚠️ JWT_SECRET not set - using a derived fallback. Set JWT_SECRET in environment.');
  return deriveSecret('jwt');
})();

const quoteSignatureSalt = process.env.QUOTE_SIGNATURE_SALT || (() => {
  console.warn('⚠️ QUOTE_SIGNATURE_SALT not set - using a derived fallback. Set QUOTE_SIGNATURE_SALT in environment.');
  return deriveSecret('quote-signature');
})();

const rawClientUrl = (process.env.CLIENT_URL || 'https://creative-frangipane-4c668d.netlify.app').replace(/['"]/g, '').trim();
const configuredOrigins = rawClientUrl
  ? rawClientUrl.split(',').map((u) => u.trim().replace(/\/+$/, '')).filter(Boolean)
  : [];

const allowedOrigins = [
  ...configuredOrigins,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

export const config = Object.freeze({
  env: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 5000,
  clientUrl: rawClientUrl,
  allowedOrigins,

  db: {
    url: process.env.DATABASE_URL || '',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD !== undefined ? String(process.env.DB_PASSWORD) : 'root',
    database: process.env.DB_NAME || 'ddpl_procurement',
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 25,
    runSeed: process.env.RUN_SEED === 'true'
  },

  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },

  security: {
    quoteSignatureSalt
  }
});

export default config;
