-- TrustLayer Database Migration 001_init.sql

-- Enable pgcrypto / uuid-ossp for gen_random_uuid if available (standard in Postgres 13+)
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_policies_user_id ON policies(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_findings_scan_id ON findings(scan_id);
