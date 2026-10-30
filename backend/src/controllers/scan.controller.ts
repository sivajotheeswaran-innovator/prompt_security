import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../config/db';
import { runScan } from '../detection/engine';

export const scanSchema = z.object({
  text: z.string().trim().min(1, 'Text is required').max(8000, 'Text must be 8000 characters or fewer'),
});

export async function scan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { text } = req.body;
    const userId = req.user!.id;

    // Get user's current policy mode
    const policyResult = await pool.query(
      'SELECT mode FROM policies WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    const policyMode = policyResult.rows[0]?.mode ?? 'balanced';

    const result = await runScan(text, userId, policyMode, true);

    // Discard the redaction map immediately — never send raw mapping to client
    result.redactionMap.clear();

    res.status(200).json({
      scanId: result.scanId,
      riskScore: result.riskScore,
      action: result.action,
      findings: result.findings,
      redactedText: result.redactedText,
      aiLayerOk: result.aiLayerOk,
      ...(result.aiLayerReason ? { aiLayerReason: result.aiLayerReason } : {}),
      ...(result.note ? { note: result.note } : {}),
      injectionWarning: result.injectionWarning,
    });
  } catch (error) {
    next(error);
  }
}
