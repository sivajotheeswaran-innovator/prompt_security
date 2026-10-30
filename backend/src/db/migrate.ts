import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';

const FALLBACK_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS policies (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('strict', 'balanced', 'relaxed')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    risk_score INT NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('allow', 'redact', 'block')),
    categories JSONB NOT NULL DEFAULT '[]'::jsonb,
    ai_layer_ok BOOLEAN NOT NULL DEFAULT true,
    latency_ms INT NOT NULL DEFAULT 0,
    redacted_prompt TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    masked_preview VARCHAR(255) NOT NULL,
    start_idx INT NOT NULL,
    end_idx INT NOT NULL,
    confidence REAL NOT NULL,
    source VARCHAR(20) NOT NULL CHECK (source IN ('regex', 'ai')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    explanation TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_policies_user_id ON policies(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_findings_scan_id ON findings(scan_id);
`;

export async function runMigrations(): Promise<void> {
  const candidatePaths = [
    path.join(__dirname, 'migrations', '001_init.sql'),
    path.join(__dirname, '..', '..', 'src', 'db', 'migrations', '001_init.sql'),
    path.join(process.cwd(), 'src', 'db', 'migrations', '001_init.sql'),
    path.join(process.cwd(), 'backend', 'src', 'db', 'migrations', '001_init.sql'),
  ];

  let sql: string = '';
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        sql = fs.readFileSync(p, 'utf-8');
        break;
      } catch {
        // continue
      }
    }
  }

  if (!sql) {
    sql = FALLBACK_SCHEMA_SQL;
  }

  console.log('[Migration] Running initial database migration...');
  
  // Split statements for safe execution across drivers
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (err: any) {
      // Ignore if index or table already exists
      if (!err.message?.includes('already exists')) {
        console.warn(`[Migration Warning] ${err.message}`);
      }
    }
  }

  console.log('[Migration] Migration completed successfully.');
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('[Migration] Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration Failed]', err);
      process.exit(1);
    });
}
