/**
 * Gateway engine: orchestrates Layer 1 → Layer 2 → Score → Redact pipeline.
 * Persists sanitized results to DB. Raw values never leave request scope.
 */

import { v4 as uuidv4 } from 'uuid';
import { runLayer1, RawFinding, deduplicateFindings } from './layer1';
import { runLayer2 } from './layer2';
import { redactText, maskPreview, RedactionMap } from './redact';
import { scoreAndDecide, extractCategories, PolicyAction } from './scoring';
import { pool } from '../config/db';

export interface ScanFinding {
  id: string;
  type: string;
  maskedPreview: string;
  startIdx: number;
  endIdx: number;
  confidence: number;
  source: 'regex' | 'ai';
  severity: string;
  explanation: string;
}

export interface ScanResult {
  scanId: string;
  riskScore: number;
  action: PolicyAction;
  findings: ScanFinding[];
  redactedText: string;
  aiLayerOk: boolean;
  aiLayerReason?: string;
  note?: string;
  injectionWarning: boolean;
  categories: string[];
  latencyMs: number;
  redactionMap: RedactionMap; // only returned for chat reply restoration — discard after use
}

/**
 * Full scan pipeline. Returns a ScanResult ready for storage and API response.
 * Persists only sanitized data (masked previews, offsets, types) to DB.
 */
export async function runScan(
  text: string,
  userId: string,
  policyMode: string,
  persistToDb: boolean = true
): Promise<ScanResult> {
  const startTime = Date.now();

  // ── Layer 1: Deterministic detection ──────────────────────────────────────
  const layer1Findings = runLayer1(text);

  // ── Skip Layer 2 if Layer 1 alone already yields action=block (Requirement 1)
  const l1Decision = scoreAndDecide(layer1Findings, policyMode);

  let layer2Findings: RawFinding[] = [];
  let aiLayerOk = true;
  let aiLayerReason: string | undefined;
  let note: string | undefined;

  if (l1Decision.action === 'block') {
    aiLayerOk = true;
    note = 'layer2 skipped: deterministic block';
    aiLayerReason = 'layer2 skipped: deterministic block';
  } else {
    // ── Redact Layer 1 findings before passing to Gemini ──────────────────────
    const { redactedText: maskedForGemini } = redactText(text, layer1Findings);

    // ── Layer 2: AI detection on already-masked text (Amendment 2) ───────────
    // Gemini returns {type, text, confidence, explanation} — backend maps to originalText
    const l2Res = await runLayer2(
      maskedForGemini,
      text,
      layer1Findings
    );
    layer2Findings = l2Res.findings;
    aiLayerOk = l2Res.aiLayerOk;
    aiLayerReason = l2Res.aiLayerReason;
  }

  // ── Merge and deduplicate (Amendment 8) ───────────────────────────────────
  const allFindings: RawFinding[] = deduplicateFindings([...layer1Findings, ...layer2Findings]);

  // ── Score and policy decision ─────────────────────────────────────────────
  const { riskScore, action, injectionWarning } = scoreAndDecide(allFindings, policyMode);
  const categories = extractCategories(allFindings);

  // ── Final fully redacted text (Amendment 3) ───────────────────────────────
  // scans.redacted_prompt always stores the FULLY masked text regardless of action
  const { redactedText: finalRedacted, map: combinedMap } = redactText(text, allFindings);

  // ── Build safe finding records ─────────────────────────────────────────────
  const safeFindings: ScanFinding[] = allFindings.map((f) => ({
    id: uuidv4(),
    type: f.type,
    maskedPreview: maskPreview(f.rawValue, f.type),
    startIdx: f.start,
    endIdx: f.end,
    confidence: f.confidence,
    source: f.source,
    severity: f.severity,
    explanation: f.explanation,
  }));

  const latencyMs = Date.now() - startTime;

  // ── Persist sanitized data to DB ───────────────────────────────────────────
  // RULE: Only masked previews, offsets, types, and redacted_prompt are stored.
  // Raw values NEVER touch the DB.
  let scanId = uuidv4();

  if (persistToDb) {
    try {
      const scanResult = await pool.query(
        `INSERT INTO scans (id, user_id, risk_score, action, categories, ai_layer_ok, latency_ms, redacted_prompt)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
         RETURNING id`,
        [
          scanId,
          userId,
          riskScore,
          action,
          JSON.stringify(categories),
          aiLayerOk,
          latencyMs,
          finalRedacted, // Only the redacted version is stored
        ]
      );
      scanId = scanResult.rows[0].id;

      // Insert findings (only safe fields — no raw values)
      for (const f of safeFindings) {
        await pool.query(
          `INSERT INTO findings (id, scan_id, type, masked_preview, start_idx, end_idx, confidence, source, severity, explanation)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            f.id,
            scanId,
            f.type,
            f.maskedPreview,
            f.startIdx,
            f.endIdx,
            f.confidence,
            f.source,
            f.severity,
            f.explanation,
          ]
        );
      }
    } catch (dbErr: any) {
      console.error('[Engine] DB persistence error:', dbErr.message);
      // Don't crash — scan still completed
    }
  }

  return {
    scanId,
    riskScore,
    action,
    findings: safeFindings,
    redactedText: finalRedacted,
    aiLayerOk,
    aiLayerReason,
    note,
    injectionWarning,
    categories,
    latencyMs,
    redactionMap: combinedMap,
  };
}
