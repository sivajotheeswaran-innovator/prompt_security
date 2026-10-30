import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../config/db';
import { runScan } from '../detection/engine';
import { restorePlaceholders } from '../detection/redact';
import { generateChatReply } from '../services/gemini.service';

export const chatSchema = z.object({
  text: z.string().trim().min(1, 'Text is required').max(8000, 'Text must be 8000 characters or fewer'),
});

/**
 * POST /api/chat
 * Single-turn chat gateway per specs:
 * 1. Scans prompt, scores risk, saves scan to audit DB (always logged).
 * 2. If 'block': returns { scan, reply: null, blocked: true } with NO Gemini call.
 * 3. If 'redact': sends redactedText (typed placeholders) to Gemini, restores placeholders
 *    in reply, immediately discards in-memory mapping, and returns reply.
 * 4. If 'allow': forwards original prompt as-is to Gemini and returns reply.
 * 5. If Gemini times out / errors: returns clear fallback notice without crashing.
 */
export async function chat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { text } = req.body;
    const userId = req.user!.id;

    // Fetch user's current policy mode (strict, balanced, or relaxed)
    const policyResult = await pool.query(
      'SELECT mode FROM policies WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    const policyMode = policyResult.rows[0]?.mode ?? 'balanced';

    // Scan prompt — always logged/persisted to scans & findings DB
    const scanResult = await runScan(text, userId, policyMode, true);

    console.log(
      `[ChatGateway] User: ${userId} | Mode: ${policyMode} | Risk: ${scanResult.riskScore} | Action: ${scanResult.action}`
    );

    const scanResponse = {
      scanId: scanResult.scanId,
      riskScore: scanResult.riskScore,
      action: scanResult.action,
      findings: scanResult.findings,
      redactedText: scanResult.redactedText,
      aiLayerOk: scanResult.aiLayerOk,
      ...(scanResult.aiLayerReason ? { aiLayerReason: scanResult.aiLayerReason } : {}),
      ...(scanResult.note ? { note: scanResult.note } : {}),
      injectionWarning: scanResult.injectionWarning,
    };

    // Policy: BLOCK
    if (scanResult.action === 'block') {
      console.log('[ChatGateway] Policy is BLOCK. Upstream Gemini AI was NOT called.');
      // Immediately clear the redaction map
      scanResult.redactionMap.clear();

      res.status(200).json({
        scan: scanResponse,
        reply: null,
        blocked: true,
        isFallback: false,
      });
      return;
    }

    // Policy: REDACT
    if (scanResult.action === 'redact') {
      const sanitizedPayload = scanResult.redactedText;
      const gatewayAuditMsg = `[ChatGateway] Policy: REDACT. Sending sanitized prompt to Gemini: "${sanitizedPayload}"`;
      console.log(gatewayAuditMsg);

      // Upstream Gemini call receives ONLY the redacted prompt with placeholders
      const { reply: rawReply, isFallback } = await generateChatReply(sanitizedPayload);

      // Restore placeholders in Gemini's reply using the request-scoped map
      const restoredReply = restorePlaceholders(rawReply, scanResult.redactionMap);

      // Discard mapping immediately after request completion
      scanResult.redactionMap.clear();

      res.status(200).json({
        scan: scanResponse,
        reply: restoredReply,
        blocked: false,
        isFallback: isFallback ?? false,
      });
      return;
    }

    // Policy: ALLOW
    console.log('[ChatGateway] Policy: ALLOW. Request forwarded downstream after zero-risk evaluation.');
    const { reply: rawReply, isFallback } = await generateChatReply(text);

    // Discard mapping immediately
    scanResult.redactionMap.clear();

    res.status(200).json({
      scan: scanResponse,
      reply: rawReply,
      blocked: false,
      isFallback: isFallback ?? false,
    });
  } catch (error) {
    next(error);
  }
}
