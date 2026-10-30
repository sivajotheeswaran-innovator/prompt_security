import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { pool } from '../config/db';

export interface AuthUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token required (format: Bearer <token>)',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    const userCheck = await pool.query('SELECT id, email FROM users WHERE id = $1 LIMIT 1', [decoded.id]);
    if (userCheck.rows.length === 0) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User no longer exists or session has expired',
      });
      return;
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
    };
    next();
  } catch (err) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Token is invalid or expired',
    });
    return;
  }
}
