import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const toInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  // 5050 by default: macOS AirPlay Receiver occupies 5000.
  port: toInt(process.env.PORT, 5050),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/grievanceai',
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET || 'insecure-development-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  ai: {
    provider: (process.env.AI_PROVIDER || 'none').toLowerCase(),
    model: process.env.AI_MODEL || '',
    openaiKey: process.env.OPENAI_API_KEY || '',
    anthropicKey: process.env.ANTHROPIC_API_KEY || '',
    geminiKey: process.env.GEMINI_API_KEY || '',
    timeoutMs: toInt(process.env.AI_TIMEOUT_MS, 12000),
  },
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxUploadMb: toInt(process.env.MAX_UPLOAD_MB, 10),
  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@grievanceai.gov',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',
  },
};

export const isProd = env.nodeEnv === 'production';

if (isProd && env.jwtSecret.startsWith('insecure')) {
  throw new Error('JWT_SECRET must be configured in production.');
}
