import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);

  // Sanitized logging: do not log request body or raw sensitive fields
  console.error(`[Error Handler] ${req.method} ${req.originalUrl} - Status ${statusCode}:`, err.message || err);

  res.status(statusCode).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { details: err.stack }),
  });
}
