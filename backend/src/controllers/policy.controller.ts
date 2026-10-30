import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../config/db';

export const updatePolicySchema = z.object({
  mode: z.enum(['strict', 'balanced', 'relaxed'], {
    errorMap: () => ({ message: "Mode must be one of: 'strict', 'balanced', 'relaxed'" }),
  }),
});

export async function getPolicy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;

    let result = await pool.query(
      'SELECT mode, updated_at FROM policies WHERE user_id = $1 LIMIT 1',
      [userId]
    );

    // If for any reason no policy exists yet, initialize default 'balanced'
    if (result.rows.length === 0) {
      result = await pool.query(
        'INSERT INTO policies (user_id, mode) VALUES ($1, $2) RETURNING mode, updated_at',
        [userId, 'balanced']
      );
    }

    const policy = result.rows[0];
    res.status(200).json({
      mode: policy.mode,
      updated_at: policy.updated_at,
    });
  } catch (error) {
    next(error);
  }
}

export async function updatePolicy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { mode } = req.body;

    const result = await pool.query(
      `INSERT INTO policies (user_id, mode, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET mode = EXCLUDED.mode, updated_at = NOW()
       RETURNING mode, updated_at`,
      [userId, mode]
    );

    const updated = result.rows[0];
    res.status(200).json({
      mode: updated.mode,
      updated_at: updated.updated_at,
    });
  } catch (error) {
    next(error);
  }
}
