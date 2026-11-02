import { inArray } from 'drizzle-orm';
import { db, t } from './db';
import type { UserRow } from './auth';

// Converts database rows to the shapes in src/types/index.ts, which the frontend
// already uses. `null` columns become `undefined` so optional fields stay optional.

type Nullable<T> = { [K in keyof T]: T[K] | null };

function stripNulls<T extends object>(row: Nullable<T>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (v !== null) out[k] = v;
  return out as T;
}

export async function categoryIdsByAdmin(adminIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!adminIds.length) return map;
  const rows = await db.select().from(t.categoryAdmins).where(inArray(t.categoryAdmins.adminId, adminIds));
  for (const r of rows) map.set(r.adminId, [...(map.get(r.adminId) ?? []), r.categoryId]);
  return map;
}

export type UserVisibility = 'self' | 'staff' | 'public';

/**
 * - self: everything about the signed-in user
 * - staff: what admins need about another user (contact details included)
 * - public: name, role and mentor profile only — no email or phone
 */
export function serializeUser(u: UserRow, assignedCategories: string[] = [], visibility: UserVisibility = 'staff') {
  const base = {
    uid: u.id,
    displayName: u.displayName,
    role: u.role,
    status: u.status,
    professionalTitle: u.professionalTitle ?? undefined,
    shortDescription: u.shortDescription ?? undefined,
    photoURL: u.photoUrl ?? undefined,
    assignedCategories,
    ratingCount: u.ratingCount,
    ratingSum: u.ratingSum,
    averageRating: u.ratingCount ? Math.round((u.ratingSum / u.ratingCount) * 10) / 10 : undefined,
    isOnline: u.isOnline,
    lastActiveAt: u.lastActiveAt ?? u.createdAt,
    lastReplyAt: u.lastReplyAt ?? undefined,
    createdAt: u.createdAt,
  };
  if (visibility === 'public') return base;
  return {
    ...base,
    email: u.email,
    phoneNumber: u.phoneNumber ?? undefined,
    qualification: u.qualification ?? undefined,
    qualificationDetail: u.qualificationDetail ?? undefined,
    board: u.board ?? undefined,
    ...(visibility === 'self' ? { mustChangePassword: u.mustChangePassword } : {}),
  };
}

export async function serializeUsers(rows: UserRow[], visibility: UserVisibility = 'staff') {
  const cats = await categoryIdsByAdmin(rows.filter((r) => r.role !== 'student').map((r) => r.id));
  return rows.map((r) => serializeUser(r, cats.get(r.id) ?? [], visibility));
}

export async function serializeCategories(rows: (typeof t.categories.$inferSelect)[]) {
  const links = rows.length
    ? await db.select().from(t.categoryAdmins).where(inArray(t.categoryAdmins.categoryId, rows.map((r) => r.id)))
    : [];
  return rows.map((c) => ({
    ...stripNulls(c),
    assignedAdminIds: links.filter((l) => l.categoryId === c.id).map((l) => l.adminId),
  }));
}

export async function serializeQueries(rows: (typeof t.queries.$inferSelect)[]) {
  const hidden = rows.length
    ? await db.select().from(t.queryHiddenFor).where(inArray(t.queryHiddenFor.queryId, rows.map((r) => r.id)))
    : [];
  return rows.map((q) => ({
    ...stripNulls(q),
    studentId: q.studentId ?? '',
    categoryId: q.categoryId ?? '',
    // The frontend uses the 'unassigned' sentinel from the Firestore era.
    expertId: q.expertId ?? 'unassigned',
    assignedAdminId: q.expertId ?? 'unassigned',
    attachments: q.attachments ?? [],
    deletedForUsers: hidden.filter((h) => h.queryId === q.id).map((h) => h.userId),
  }));
}

export function serializeMessage(m: typeof t.messages.$inferSelect) {
  return { ...stripNulls(m), senderId: m.senderId ?? '' };
}

export function serializeRow<T extends object>(row: Nullable<T>): T {
  return stripNulls(row);
}

export function serializeArticle(
  a: typeof t.articles.$inferSelect,
  likedBy: string[] = []
) {
  const { authorPhotoUrl, ...rest } = stripNulls(a) as typeof a;
  return { ...rest, authorPhotoURL: authorPhotoUrl ?? undefined, likedBy, likesCount: likedBy.length };
}
