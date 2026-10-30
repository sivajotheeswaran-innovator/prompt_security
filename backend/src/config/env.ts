import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-flash-lite-latest'),
  GEMINI_DETECTION_MODEL: z.string().optional(),
  GEMINI_CHAT_MODEL: z.string().optional(),
});

const rawEnv = envSchema.parse(process.env);
const defaultModel = rawEnv.GEMINI_MODEL || 'gemini-flash-lite-latest';

// Enforce required variables in development and production (Requirement 2)
if (rawEnv.NODE_ENV !== 'test') {
  const missing: string[] = [];
  if (!rawEnv.DATABASE_URL || rawEnv.DATABASE_URL.trim() === '') {
    missing.push('DATABASE_URL');
  }
  if (!rawEnv.JWT_SECRET || rawEnv.JWT_SECRET.trim() === '') {
    missing.push('JWT_SECRET');
  }

  if (missing.length > 0) {
    console.error(`\n[Fatal Config Error] Missing required environment variable(s) in ${rawEnv.NODE_ENV} mode:`);
    missing.forEach((v) => console.error(`  - ${v}: (strictly required, no default allowed)`));
    console.error('Please configure them in your .env file before starting the application.\n');
    process.exit(1);
  }
}

export const env = {
  ...rawEnv,
  GEMINI_MODEL: defaultModel,
  GEMINI_DETECTION_MODEL: rawEnv.GEMINI_DETECTION_MODEL || defaultModel,
  GEMINI_CHAT_MODEL: rawEnv.GEMINI_CHAT_MODEL || defaultModel,
  JWT_SECRET: rawEnv.JWT_SECRET || (rawEnv.NODE_ENV === 'test' ? 'test-jwt-secret-key-32charslong!!' : ''),
};
