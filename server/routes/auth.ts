import { Router } from 'express';
import { and, eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, t } from '../db';
import {
  checkLoginThrottle,
  clearLoginFailures,
  createSession,
  currentUser,
  destroyAllSessionsFor,
  destroySession,
  hashPassword,
  recordLoginFailure,
  requireAuth,
  validateNewPassword,
  verifyUserPassword,
} from '../auth';
import { HttpError, newId, parse, route } from '../http';
import { categoryIdsByAdmin, serializeUser } from '../serialize';

export const authRouter = Router();

const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function findByEmail(email: string) {
  const [user] = await db
    .select()
    .from(t.users)
    .where(sql`lower(${t.users.email}) = ${normalizeEmail(email)}`)
    .limit(1);
  return user;
}

export async function selfProfile(userId: string) {
  const [user] = await db.select().from(t.users).where(eq(t.users.id, userId)).limit(1);
  if (!user) throw new HttpError(404, 'User not found.');
  const cats = await categoryIdsByAdmin([user.id]);
  return serializeUser(user, cats.get(user.id) ?? [], 'self');
}

authRouter.get(
  '/auth/me',
  route(async (req, res) => {
    if (!req.user) return res.json({ profile: null });
    res.json({ profile: await selfProfile(req.user.id) });
  })
);

const loginBody = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) });

authRouter.post(
  '/auth/login',
  route(async (req, res) => {
    const { email, password } = parse(loginBody, req.body);
    const throttleKey = `${req.ip}|${normalizeEmail(email)}`;
    checkLoginThrottle(throttleKey);

    const user = await findByEmail(email);
    if (!user || !(await verifyUserPassword(user, password))) {
      recordLoginFailure(throttleKey);
      throw new HttpError(401, 'Incorrect email or password.');
    }
    if (user.status === 'deactivated') {
      throw new HttpError(403, 'This account has been deactivated. Contact administration.');
    }
    clearLoginFailures(throttleKey);

    await createSession(req, res, user.id);
    await db.update(t.users).set({ lastActiveAt: Date.now() }).where(eq(t.users.id, user.id));
    res.json({ profile: await selfProfile(user.id) });
  })
);

const registerBody = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().email().max(254),
  password: z.string(),
  phone: z.string().trim().min(5).max(30),
  qualification: z.string().trim().min(1).max(100),
  qualificationDetail: z.string().trim().max(200).optional(),
  board: z.string().trim().max(100).optional(),
});

authRouter.post(
  '/auth/register',
  route(async (req, res) => {
    const body = parse(registerBody, req.body);
    const password = validateNewPassword(body.password);
    if (await findByEmail(body.email)) {
      throw new HttpError(409, 'An account with this email address already exists. Please sign in.');
    }

    const { hash, salt } = await hashPassword(password);
    const id = `stu_${newId()}`;
    // Self-registration always creates a student; roles are only granted by admins.
    await db.insert(t.users).values({
      id,
      email: normalizeEmail(body.email),
      passwordAlgo: 'scrypt',
      passwordHash: hash,
      passwordSalt: salt,
      displayName: body.fullName,
      role: 'student',
      phoneNumber: body.phone,
      qualification: body.qualification,
      qualificationDetail: body.qualificationDetail || null,
      board: body.board || null,
      lastActiveAt: Date.now(),
    });

    await createSession(req, res, id);
    res.status(201).json({ profile: await selfProfile(id) });
  })
);

authRouter.post(
  '/auth/logout',
  route(async (req, res) => {
    if (req.user) {
      await db.update(t.users).set({ isOnline: false, lastActiveAt: Date.now() }).where(eq(t.users.id, req.user.id));
    }
    await destroySession(req, res);
    res.json({ success: true });
  })
);

const changePasswordBody = z.object({ currentPassword: z.string().min(1), newPassword: z.string() });

authRouter.post(
  '/auth/change-password',
  requireAuth,
  route(async (req, res) => {
    const user = currentUser(req);
    const body = parse(changePasswordBody, req.body);
    const newPassword = validateNewPassword(body.newPassword);
    if (!(await verifyUserPassword(user, body.currentPassword))) {
      throw new HttpError(400, 'Your current password is incorrect.');
    }
    const { hash, salt } = await hashPassword(newPassword);
    await db
      .update(t.users)
      .set({ passwordAlgo: 'scrypt', passwordHash: hash, passwordSalt: salt, mustChangePassword: false, updatedAt: Date.now() })
      .where(eq(t.users.id, user.id));
    // Sign out other devices, keep this one.
    await db.delete(t.sessions).where(and(eq(t.sessions.userId, user.id), ne(t.sessions.id, req.sessionId!)));
    res.json({ success: true });
  })
);

// Kept for callers that sign out every device (e.g. "log out everywhere").
authRouter.post(
  '/auth/logout-all',
  requireAuth,
  route(async (req, res) => {
    await destroyAllSessionsFor(currentUser(req).id);
    await destroySession(req, res);
    res.json({ success: true });
  })
);
