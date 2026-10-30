import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../config/db';

const auditQuerySchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  action: z.enum(['allow', 'redact', 'block']).optional(),
  type:   z.string().optional(),
});

export async function getAudit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const query = auditQuerySchema.parse(req.query);

    const conditions: string[] = ['s.user_id = $1'];
    const params: any[] = [userId];
    let paramIdx = 2;

    if (query.action) {
      conditions.push(`s.action = $${paramIdx++}`);
      params.push(query.action);
    }

    if (query.type) {
      conditions.push(`EXISTS (SELECT 1 FROM findings f WHERE f.scan_id = s.id AND f.type = $${paramIdx++})`);
      params.push(query.type);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM scans s WHERE ${whereClause}`,
      params
    );
    const total = countResult.rows[0]?.total ?? 0;

    // Get paginated scans with their findings
    const limitParam = paramIdx++;
    const offsetParam = paramIdx++;
    params.push(query.limit, query.offset);

    const scansResult = await pool.query(
      `SELECT 
         s.id, s.risk_score, s.action, s.categories, s.ai_layer_ok,
         s.latency_ms, s.redacted_prompt, s.created_at
       FROM scans s
       WHERE ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params
    );

    const scanIds = scansResult.rows.map((r) => r.id);
    
    // Batch-fetch findings for these scans (only safe fields)
    let findingsByScandId: Record<string, any[]> = {};
    if (scanIds.length > 0) {
      const placeholders = scanIds.map((_, i) => `$${i + 1}`).join(',');
      const findingsResult = await pool.query(
        `SELECT id, scan_id, type, masked_preview, start_idx, end_idx, 
                confidence, source, severity, explanation
         FROM findings WHERE scan_id IN (${placeholders})
         ORDER BY start_idx ASC`,
        scanIds
      );
      for (const row of findingsResult.rows) {
        if (!findingsByScandId[row.scan_id]) findingsByScandId[row.scan_id] = [];
        findingsByScandId[row.scan_id].push({
          id: row.id,
          type: row.type,
          maskedPreview: row.masked_preview,
          startIdx: row.start_idx,
          endIdx: row.end_idx,
          confidence: row.confidence,
          source: row.source,
          severity: row.severity,
          explanation: row.explanation,
        });
      }
    }

    const items = scansResult.rows.map((row) => ({
      id: row.id,
      riskScore: row.risk_score,
      action: row.action,
      categories: row.categories,
      aiLayerOk: row.ai_layer_ok,
      latencyMs: row.latency_ms,
      redactedPrompt: row.redacted_prompt,
      createdAt: row.created_at,
      findings: findingsByScandId[row.id] ?? [],
    }));

    res.status(200).json({ items, total });
  } catch (error) {
    next(error);
  }
}

export async function getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;

    // Overall scan counts and avg risk
    const summaryResult = await pool.query(
      `SELECT
         COUNT(*)::int AS total_scans,
         SUM(CASE WHEN action = 'block'  THEN 1 ELSE 0 END)::int AS blocked,
         SUM(CASE WHEN action = 'redact' THEN 1 ELSE 0 END)::int AS redacted,
         SUM(CASE WHEN action = 'allow'  THEN 1 ELSE 0 END)::int AS allowed,
         COALESCE(AVG(risk_score), 0)::numeric(5,1) AS avg_risk
       FROM scans WHERE user_id = $1`,
      [userId]
    );
    const summary = summaryResult.rows[0];

    // Category breakdown (Amendment 7: GROUP BY findings.type)
    const categoryResult = await pool.query(
      `SELECT f.type, COUNT(*)::int AS count
       FROM findings f
       JOIN scans s ON s.id = f.scan_id
       WHERE s.user_id = $1
       GROUP BY f.type
       ORDER BY count DESC`,
      [userId]
    );

    // Risk over time: fetch scans for timeline and bucket by calendar day
    const scansForTime = await pool.query(
      `SELECT created_at, risk_score FROM scans WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId]
    );

    const dayBuckets: Record<string, { sum: number; count: number }> = {};
    for (const row of scansForTime.rows) {
      const d = new Date(row.created_at).toISOString().split('T')[0];
      if (!dayBuckets[d]) dayBuckets[d] = { sum: 0, count: 0 };
      dayBuckets[d].sum += row.risk_score;
      dayBuckets[d].count += 1;
    }

    const riskOverTime = Object.entries(dayBuckets).map(([date, b]) => ({
      date,
      avgRisk: parseFloat((b.sum / b.count).toFixed(1)),
      scanCount: b.count,
    }));

    res.status(200).json({
      totalScans: summary?.total_scans ?? 0,
      blocked:    summary?.blocked ?? 0,
      redacted:   summary?.redacted ?? 0,
      allowed:    summary?.allowed ?? 0,
      avgRisk:    parseFloat(summary?.avg_risk ?? '0'),
      byCategory: categoryResult.rows.map((r) => ({ type: r.type, count: r.count })),
      riskOverTime,
    });
  } catch (error) {
    next(error);
  }
}
