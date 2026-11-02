import crypto from 'crypto';
import { promisify } from 'util';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { and, eq, gt, lt } from 'drizzle-orm';
import { db, t } from './db';
import { config } from './config';
import { HttpError } from './http';

export type UserRow = typeof t.users.$inferSelect;
export type Role = UserRow['role'];

export const ADMIN_ROLES: Role[] = ['normal_admin', 'expert_admin', 'super_admin'];
export const MANAGER_ROLES: Role[] = ['expert_admin', 'super_admin'];

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserRow;
      sessionId?: string;
    }
  }
}

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

const scrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: string,
  keylen: number,
  options: crypto.ScryptOptions
) => Promise<Buffer>;

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, 64, SCRYPT_PARAMS)).toString('hex');
  return { hash, salt };
}

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Checks a password against a user row. Legacy Firestore PBKDF2 hashes are upgraded in place. */
export async function verifyUserPassword(user: UserRow, password: string): Promise<boolean> {
  if (!user.passwordHash || !user.passwordSalt) return false;

  if (user.passwordAlgo === 'pbkdf2_legacy') {
    const computed = crypto.pbkdf2Sync(password, user.passwordSalt, 1000, 64, 'sha512').toString('hex');
    if (!safeEqualHex(computed, user.passwordHash)) return false;
    const { hash, salt } = await hashPassword(password);
    await db
      .update(t.users)
      .set({ passwordAlgo: 'scrypt', passwordHash: hash, passwordSalt: salt, updatedAt: Date.now() })
      .where(eq(t.users.id, user.id));
    return true;
  }

  const computed = (await scrypt(password, user.passwordSalt, 64, SCRYPT_PARAMS)).toString('hex');
  return safeEqualHex(computed, user.passwordHash);
}

export function validateNewPassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters.');
  }
  if (password.length > 200) throw new HttpError(400, 'Password is too long.');
  return password;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export async function createSession(req: Request, res: Response, userId: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + config.sessionTtlMs;
  await db.insert(t.sessions).values({
    id: sha256(token),
    userId,
    userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
    expiresAt,
  });
  res.cookie(config.sessionCookie, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    maxAge: config.sessionTtlMs,
    path: '/',
  });
}

export async function destroySession(req: Request, res: Response) {
  if (req.sessionId) await db.delete(t.sessions).where(eq(t.sessions.id, req.sessionId));
  res.clearCookie(config.sessionCookie, { path: '/' });
}

export async function destroyAllSessionsFor(userId: string) {
  await db.delete(t.sessions).where(eq(t.sessions.userId, userId));
}

/** Resolves a raw cookie token to an active user, or null. Shared by HTTP and Socket.IO. */
export async function userFromToken(token: string | undefined): Promise<{ user: UserRow; sessionId: string } | null> {
  if (!token) return null;
  const sessionId = sha256(token);
  const [row] = await db
    .select({ user: t.users })
    .from(t.sessions)
    .innerJoin(t.users, eq(t.users.id, t.sessions.userId))
    .where(and(eq(t.sessions.id, sessionId), gt(t.sessions.expiresAt, Date.now())))
    .limit(1);
  if (!row || row.user.status !== 'active') return null;
  return { user: row.user, sessionId };
}

export async function purgeExpiredSessions() {
  await db.delete(t.sessions).where(lt(t.sessions.expiresAt, Date.now()));
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/** Attaches req.user when a valid session cookie is present. Never rejects. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const found = await userFromToken(req.cookies?.[config.sessionCookie]);
    if (found) {
      req.user = found.user;
      req.sessionId = found.sessionId;
    }
    next();
  } catch (err) {
    next(err);
  }
};

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, 'Please sign in.'));
  next();
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Please sign in.'));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have permission to do that.'));
    next();
  };
}

/** The authenticated user; only call after requireAuth/requireRole. */
export function currentUser(req: Request): UserRow {
  if (!req.user) throw new HttpError(401, 'Please sign in.');
  return req.user;
}

export const isAdmin = (role: Role) => ADMIN_ROLES.includes(role);
export const isManager = (role: Role) => MANAGER_ROLES.includes(role);

/** Whether `actor` may manage (edit, reset password, deactivate, delete) `target`. */
export function canManageUser(actor: UserRow, target: Pick<UserRow, 'id' | 'role'>): boolean {
  if (actor.role === 'super_admin') return true;
  if (actor.role === 'expert_admin') return target.role === 'normal_admin' || target.role === 'student';
  return false;
}

// ---------------------------------------------------------------------------
// Login throttling (per IP + email, in memory)
// ---------------------------------------------------------------------------

const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

export function checkLoginThrottle(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (entry && entry.resetAt > now && entry.count >= MAX_ATTEMPTS) {
    throw new HttpError(429, 'Too many sign-in attempts. Please try again in a few minutes.');
  }
}

export function recordLoginFailure(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else entry.count++;
}

export function clearLoginFailures(key: string) {
  attempts.delete(key);
}
