import crypto from 'crypto';
import type { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';
import { z, ZodError, ZodType } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Wraps an async route handler so rejections reach the error middleware. */
export const route =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    handler(req, res, next).catch(next);
  };

export function parse<S extends ZodType>(schema: S, value: unknown): z.infer<S> {
  return schema.parse(value);
}

export const newId = () => crypto.randomUUID();

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({ error: first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input.' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request is too large.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
};
