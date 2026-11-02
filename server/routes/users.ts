import { Router } from 'express';
import { and, count, desc, eq, gte, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, t } from '../db';
import {
  ADMIN_ROLES,
  canManageUser,
  currentUser,
  destroyAllSessionsFor,
  hashPassword,
  isAdmin,
  isManager,
  requireAuth,
  requireRole,
  validateNewPassword,
  type Role,
  type UserRow,
} from '../auth';
import { HttpError, newId, parse, route } from '../http';
import { broadcastChange, disconnectUser, emitQueryChange, emitToUser, refreshCategoryRooms } from '../realtime';
import { categoryIdsByAdmin, serializeQueries, serializeUser, serializeUsers } from '../serialize';
import { notify } from '../notify';
import { audit } from '../audit';
import { selfProfile } from './auth';

export const usersRouter = Router();

// Profile photos: an uploaded file or an https image URL.
const photoUrl = z
  .string()
  .max(1000)
  .regex(/^(\/api\/files\/[0-9a-f-]{36}|https:\/\/\S+)$/, 'must be an uploaded image or https URL');

async function loadUser(id: string): Promise<UserRow> {
  const [user] = await db.select().from(t.users).where(eq(t.users.id, id)).limit(1);
  if (!user) throw new HttpError(404, 'User not found.');
  return user;
}

async function pushProfile(userId: string) {
  emitToUser(userId, 'profile:update', await selfProfile(userId));
  broadcastChange('users');
}

async function setCategoryAssignments(adminId: string, categoryIds: string[]) {
  const existing = categoryIds.length
    ? await db.select({ id: t.categories.id }).from(t.categories).where(inArray(t.categories.id, categoryIds))
    : [];
  await db.transaction(async (tx) => {
    await tx.delete(t.categoryAdmins).where(eq(t.categoryAdmins.adminId, adminId));
    if (existing.length) {
      await tx.insert(t.categoryAdmins).values(existing.map((c) => ({ categoryId: c.id, adminId })));
    }
  });
  await refreshCategoryRooms(adminId);
  broadcastChange('categories');
}

async function assertNotLastSuperAdmin(target: UserRow) {
  if (target.role !== 'super_admin') return;
  const [{ n }] = await db
    .select({ n: count() })
    .from(t.users)
    .where(and(eq(t.users.role, 'super_admin'), eq(t.users.status, 'active'), ne(t.users.id, target.id)));
  if (!n) throw new HttpError(400, 'There must be at least one active super admin.');
}

/**
 * Moves a departing admin's open tickets to another admin, or back to the
 * unassigned queue of their category when no replacement is given.
 */
async function handOverOpenTickets(admin: UserRow, replacementId?: string) {
  const replacement = replacementId ? await loadUser(replacementId) : null;
  if (replacement && (!isAdmin(replacement.role) || replacement.status !== 'active' || replacement.id === admin.id)) {
    throw new HttpError(400, 'Choose an active counselor to take over the open queries.');
  }
  const moved = await db
    .update(t.queries)
    .set(
      replacement
        ? {
            expertId: replacement.id,
            expertEmail: replacement.email,
            expertName: replacement.displayName,
            expertRole: replacement.role,
            expertTitle: replacement.professionalTitle,
            expertAvatarUrl: replacement.photoUrl,
            assignmentStatus: 'assigned',
            hasUnreadAdminReply: true,
            updatedAt: Date.now(),
          }
        : {
            expertId: null,
            expertEmail: null,
            expertName: 'General Expert Queue',
            expertRole: '',
            assignmentStatus: 'unassigned',
            updatedAt: Date.now(),
          }
    )
    .where(and(eq(t.queries.expertId, admin.id), ne(t.queries.status, 'resolved')))
    .returning();

  const serialized = await serializeQueries(moved);
  moved.forEach((q, i) => emitQueryChange(q, 'query:upsert', serialized[i]));
  for (const q of moved) emitToUser(admin.id, 'query:removed', { id: q.id });
  if (replacement && moved.length) {
    await notify([replacement.id], {
      title: `${moved.length} ${moved.length === 1 ? 'query' : 'queries'} reassigned to you`,
      message: `Open queries from ${admin.displayName} are now assigned to you.`,
      type: 'assignment',
    });
  }
  return moved.length;
}

// ---------------------------------------------------------------------------
// Self
// ---------------------------------------------------------------------------

const selfUpdateBody = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  phoneNumber: z.string().trim().max(30).optional(),
  photoURL: z.union([photoUrl, z.literal('')]).optional(),
  qualification: z.string().trim().max(100).optional(),
  qualificationDetail: z.string().trim().max(200).optional(),
  board: z.string().trim().max(100).optional(),
  professionalTitle: z.string().trim().max(150).optional(),
  shortDescription: z.string().trim().max(1000).optional(),
});

usersRouter.patch(
  '/users/me',
  requireAuth,
  route(async (req, res) => {
    const user = currentUser(req);
    const body = parse(selfUpdateBody, req.body);
    const common = {
      displayName: body.displayName,
      phoneNumber: body.phoneNumber,
      photoUrl: body.photoURL === undefined ? undefined : body.photoURL || null,
    };
    const roleFields =
      user.role === 'student'
        ? { qualification: body.qualification, qualificationDetail: body.qualificationDetail, board: body.board }
        : { professionalTitle: body.professionalTitle, shortDescription: body.shortDescription };
    await db
      .update(t.users)
      .set({ ...common, ...roleFields, updatedAt: Date.now() })
      .where(eq(t.users.id, user.id));
    await pushProfile(user.id);
    res.json(await selfProfile(user.id));
  })
);

usersRouter.post(
  '/users/me/activity',
  requireAuth,
  route(async (req, res) => {
    await db
      .update(t.users)
      .set({ lastActiveAt: Date.now(), isOnline: true })
      .where(eq(t.users.id, currentUser(req).id));
    res.json({ success: true });
  })
);

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

// A single user. Admins see contact details; students may only see counselors
// and only their public profile.
usersRouter.get(
  '/users/:uid',
  requireAuth,
  route(async (req, res) => {
    const viewer = currentUser(req);
    const target = await loadUser(String(req.params.uid));
    if (target.id === viewer.id) return res.json(await selfProfile(viewer.id));
    const cats = (await categoryIdsByAdmin([target.id])).get(target.id) ?? [];
    if (isAdmin(viewer.role)) return res.json(serializeUser(target, cats, 'staff'));
    if (!isAdmin(target.role)) throw new HttpError(404, 'User not found.');
    res.json(serializeUser(target, cats, 'public'));
  })
);

// Counselors. Managers get the full directory (including deactivated, with contact
// details); everyone else gets active counselors' public profiles.
usersRouter.get(
  '/admins',
  requireAuth,
  route(async (req, res) => {
    const viewer = currentUser(req);
    const manager = isManager(viewer.role);
    const rows = await db
      .select()
      .from(t.users)
      .where(and(inArray(t.users.role, ADMIN_ROLES), manager ? undefined : eq(t.users.status, 'active')))
      .orderBy(t.users.displayName);
    res.json(await serializeUsers(rows, manager || isAdmin(viewer.role) ? 'staff' : 'public'));
  })
);

usersRouter.get(
  '/admin/students',
  requireRole('expert_admin', 'super_admin'),
  route(async (_req, res) => {
    const rows = await db.select().from(t.users).where(eq(t.users.role, 'student')).orderBy(desc(t.users.createdAt));
    res.json(await serializeUsers(rows));
  })
);

usersRouter.get(
  '/admin/users',
  requireRole('expert_admin', 'super_admin'),
  route(async (_req, res) => {
    const rows = await db.select().from(t.users).orderBy(desc(t.users.createdAt));
    res.json(await serializeUsers(rows));
  })
);

// Replies per admin in the last 24 hours (Admin Management activity column).
usersRouter.get(
  '/admin/stats/replies-24h',
  requireRole('expert_admin', 'super_admin'),
  route(async (_req, res) => {
    const rows = await db
      .select({ senderId: t.messages.senderId, count: count() })
      .from(t.messages)
      .where(
        and(
          gte(t.messages.createdAt, Date.now() - 24 * 60 * 60 * 1000),
          isNotNull(t.messages.senderId),
          ne(t.messages.senderRole, 'student')
        )
      )
      .groupBy(t.messages.senderId);
    res.json(Object.fromEntries(rows.map((r) => [r.senderId, r.count])));
  })
);

// ---------------------------------------------------------------------------
// Management
// ---------------------------------------------------------------------------

const statusBody = z.object({
  status: z.enum(['active', 'deactivated']),
  // Deactivating an admin: hand open tickets to this admin; omitted = unassigned queue.
  reassignToUid: z.string().max(100).optional(),
});

usersRouter.patch(
  '/admin/users/:uid/status',
  requireRole('expert_admin', 'super_admin'),
  route(async (req, res) => {
    const actor = currentUser(req);
    const body = parse(statusBody, req.body);
    const target = await loadUser(String(req.params.uid));
    if (target.id === actor.id) throw new HttpError(400, 'You cannot change your own account status.');
    if (!canManageUser(actor, target)) throw new HttpError(403, 'You cannot manage this account.');
    if (body.status === 'deactivated') await assertNotLastSuperAdmin(target);

    await db.update(t.users).set({ status: body.status, updatedAt: Date.now() }).where(eq(t.users.id, target.id));
    let reassignedCount = 0;
    if (body.status === 'deactivated') {
      await destroyAllSessionsFor(target.id);
      disconnectUser(target.id);
      if (isAdmin(target.role)) reassignedCount = await handOverOpenTickets(target, body.reassignToUid);
    }
    await audit(actor, body.status === 'active' ? 'user_reactivated' : 'user_deactivated', {
      targetId: target.id,
      targetType: target.role,
      details: `${target.displayName}${reassignedCount ? `; ${reassignedCount} open queries handed over` : ''}`,
    });
    broadcastChange('users');
    const updated = await loadUser(target.id);
    res.json({ success: true, profile: serializeUser(updated, (await categoryIdsByAdmin([target.id])).get(target.id) ?? []), reassignedCount });
  })
);

const adminRole = z.enum(['normal_admin', 'expert_admin', 'super_admin']);

const createAdminBody = z.object({
  email: z.string().email().max(254),
  password: z.string(),
  displayName: z.string().trim().min(2).max(120),
  role: adminRole,
  professionalTitle: z.string().trim().max(150).optional(),
  shortDescription: z.string().trim().max(1000).optional(),
  phoneNumber: z.string().trim().max(30).optional(),
  assignedCategories: z.array(z.string().max(100)).max(50).default([]),
});

function assertCanGrantRole(actor: UserRow, role: Role) {
  if (actor.role === 'super_admin') return;
  if (actor.role === 'expert_admin' && role === 'normal_admin') return;
  throw new HttpError(403, 'Expert Admins can only manage Admin accounts.');
}

usersRouter.post(
  '/admin/admins',
  requireRole('expert_admin', 'super_admin'),
  route(async (req, res) => {
    const actor = currentUser(req);
    const body = parse(createAdminBody, req.body);
    assertCanGrantRole(actor, body.role);
    const password = validateNewPassword(body.password);
    const email = body.email.trim().toLowerCase();
    const [taken] = await db.select({ id: t.users.id }).from(t.users).where(sql`lower(${t.users.email}) = ${email}`).limit(1);
    if (taken) throw new HttpError(409, 'An account with this email already exists.');

    const { hash, salt } = await hashPassword(password);
    const id = `admin_${newId()}`;
    await db.insert(t.users).values({
      id,
      email,
      passwordAlgo: 'scrypt',
      passwordHash: hash,
      passwordSalt: salt,
      // The admin who created the account knows this password; force a change.
      mustChangePassword: true,
      displayName: body.displayName,
      role: body.role,
      professionalTitle: body.professionalTitle || 'Admissions & Career Counselor',
      shortDescription: body.shortDescription || 'Guiding students toward their chosen academic paths.',
      phoneNumber: body.phoneNumber || null,
    });
    await setCategoryAssignments(id, body.assignedCategories);
    await audit(actor, 'admin_created', { targetId: id, targetType: body.role, details: `${body.displayName} <${email}>` });
    broadcastChange('users');
    const created = await loadUser(id);
    res.status(201).json({ success: true, profile: serializeUser(created, body.assignedCategories) });
  })
);

const updateAdminBody = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  phoneNumber: z.string().trim().max(30).optional(),
  professionalTitle: z.string().trim().max(150).optional(),
  shortDescription: z.string().trim().max(1000).optional(),
  photoURL: z.union([photoUrl, z.literal('')]).optional(),
  assignedCategories: z.array(z.string().max(100)).max(50).optional(),
  role: adminRole.optional(),
});

usersRouter.patch(
  '/admin/admins/:uid',
  requireRole('normal_admin', 'expert_admin', 'super_admin'),
  route(async (req, res) => {
    const actor = currentUser(req);
    const body = parse(updateAdminBody, req.body);
    const target = await loadUser(String(req.params.uid));
    const isSelf = target.id === actor.id;
    if (!isAdmin(target.role)) throw new HttpError(400, 'That account is not an administrator.');
    if (!isSelf && !canManageUser(actor, target)) throw new HttpError(403, 'You cannot edit this administrator.');

    // Category assignments and roles are granted by managers, never by oneself.
    if (body.assignedCategories && !isManager(actor.role)) {
      throw new HttpError(403, 'Only Expert or Super Admins can change category assignments.');
    }
    if (body.role && body.role !== target.role) {
      if (actor.role !== 'super_admin') throw new HttpError(403, 'Only a Super Admin can change roles.');
      if (target.role === 'super_admin') await assertNotLastSuperAdmin(target);
    }

    await db
      .update(t.users)
      .set({
        displayName: body.displayName,
        phoneNumber: body.phoneNumber,
        professionalTitle: body.professionalTitle,
        shortDescription: body.shortDescription,
        photoUrl: body.photoURL === undefined ? undefined : body.photoURL || null,
        role: body.role,
        updatedAt: Date.now(),
      })
      .where(eq(t.users.id, target.id));
    if (body.assignedCategories) await setCategoryAssignments(target.id, body.assignedCategories);
    if (body.role && body.role !== target.role) {
      // Role-dependent socket rooms are set on connect; reconnecting picks up the new role.
      disconnectUser(target.id);
    }
    if (!isSelf) {
      await audit(actor, 'admin_updated', { targetId: target.id, targetType: target.role, details: target.displayName });
    }
    await pushProfile(target.id);
    const updated = await loadUser(target.id);
    res.json({
      success: true,
      profile: serializeUser(updated, (await categoryIdsByAdmin([target.id])).get(target.id) ?? []),
    });
  })
);

const passwordBody = z.object({ newPassword: z.string() });

usersRouter.put(
  '/admin/users/:uid/password',
  requireRole('expert_admin', 'super_admin'),
  route(async (req, res) => {
    const actor = currentUser(req);
    const { newPassword } = parse(passwordBody, req.body);
    const password = validateNewPassword(newPassword);
    const target = await loadUser(String(req.params.uid));
    if (target.id === actor.id) throw new HttpError(400, 'Use “Change password” in your profile instead.');
    if (!canManageUser(actor, target)) throw new HttpError(403, 'You cannot reset this password.');

    const { hash, salt } = await hashPassword(password);
    await db
      .update(t.users)
      .set({ passwordAlgo: 'scrypt', passwordHash: hash, passwordSalt: salt, mustChangePassword: true, updatedAt: Date.now() })
      .where(eq(t.users.id, target.id));
    await destroyAllSessionsFor(target.id);
    disconnectUser(target.id);
    await audit(actor, 'password_reset', { targetId: target.id, targetType: target.role, details: target.displayName });
    res.json({ success: true, message: `Password updated for ${target.displayName}.` });
  })
);

usersRouter.delete(
  '/admin/admins/:uid',
  requireRole('expert_admin', 'super_admin'),
  route(async (req, res) => {
    const actor = currentUser(req);
    const target = await loadUser(String(req.params.uid));
    if (target.id === actor.id) throw new HttpError(400, 'You cannot delete your own account.');
    if (!isAdmin(target.role)) throw new HttpError(400, 'That account is not an administrator.');
    if (!canManageUser(actor, target)) throw new HttpError(403, 'You cannot delete this administrator.');
    await assertNotLastSuperAdmin(target);

    const reassignTo = typeof req.query.reassignToUid === 'string' && req.query.reassignToUid ? req.query.reassignToUid : undefined;
    const handedOver = await handOverOpenTickets(target, reassignTo);
    disconnectUser(target.id);
    // Resolved tickets keep the admin's name (snapshot columns); their id becomes NULL.
    await db.delete(t.users).where(eq(t.users.id, target.id));
    await audit(actor, 'admin_deleted', {
      targetId: target.id,
      targetType: target.role,
      details: `${target.displayName} <${target.email}>; ${handedOver} open queries handed over`,
    });
    broadcastChange('users');
    broadcastChange('categories');
    res.json({ success: true, message: `Administrator ${target.displayName} permanently deleted.` });
  })
);

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

// Mentors for the landing page: public profile fields only.
usersRouter.get(
  '/public/mentors',
  route(async (_req, res) => {
    const admins = await db
      .select()
      .from(t.users)
      .where(and(inArray(t.users.role, ADMIN_ROLES), eq(t.users.status, 'active')));
    const cats = await db.select().from(t.categories).where(eq(t.categories.status, 'active'));
    const links = admins.length
      ? await db.select().from(t.categoryAdmins).where(inArray(t.categoryAdmins.adminId, admins.map((a) => a.id)))
      : [];
    const catMap = new Map(cats.map((c) => [c.id, { id: c.id, name: c.name, color: c.color || 'emerald' }]));
    const hiddenCats = new Set(['cat-admissions', 'cat-general-guidance']);

    const mentors = admins.map((a) => {
      const isFounder = a.displayName.toLowerCase().includes('huzaifa') || a.id === 'admin_huzaifa_khalil';
      return {
        uid: a.id,
        displayName: a.displayName,
        professionalTitle: isFounder ? 'Founder, Career Code' : a.professionalTitle || 'Academic & Career Mentor',
        shortDescription:
          a.shortDescription || 'Experienced mentor helping Pakistani students explore degree options and admissions.',
        photoURL: a.photoUrl || '',
        role: a.role,
        categories: links
          .filter((l) => l.adminId === a.id && !hiddenCats.has(l.categoryId) && catMap.has(l.categoryId))
          .map((l) => catMap.get(l.categoryId)),
        isFounder,
        averageRating: a.ratingCount ? Math.round((a.ratingSum / a.ratingCount) * 10) / 10 : null,
        ratingCount: a.ratingCount,
      };
    });
    mentors.sort(
      (a, b) =>
        Number(b.isFounder) - Number(a.isFounder) ||
        Number(Boolean(b.photoURL)) - Number(Boolean(a.photoURL)) ||
        a.displayName.localeCompare(b.displayName)
    );
    res.json({ success: true, mentors });
  })
);
