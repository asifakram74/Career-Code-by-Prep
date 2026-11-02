import { and, eq, inArray, isNull, or, SQL } from 'drizzle-orm';
import { db, t } from './db';
import { HttpError } from './http';
import type { UserRow } from './auth';

export type QueryRow = typeof t.queries.$inferSelect;

export async function adminCategoryIds(adminId: string): Promise<string[]> {
  const rows = await db
    .select({ id: t.categoryAdmins.categoryId })
    .from(t.categoryAdmins)
    .where(eq(t.categoryAdmins.adminId, adminId));
  return rows.map((r) => r.id);
}

/**
 * SQL filter for the queries a user may see:
 * - students: their own tickets
 * - normal admins: tickets assigned to them, plus unassigned tickets in their categories
 * - expert / super admins: everything
 */
export async function visibleQueriesFilter(user: UserRow): Promise<SQL | undefined> {
  if (user.role === 'student') return eq(t.queries.studentId, user.id);
  if (user.role === 'normal_admin') {
    const cats = await adminCategoryIds(user.id);
    const own = eq(t.queries.expertId, user.id);
    if (!cats.length) return own;
    return or(own, and(isNull(t.queries.expertId), inArray(t.queries.categoryId, cats)));
  }
  return undefined;
}

export async function canViewQuery(user: UserRow, q: QueryRow): Promise<boolean> {
  if (user.role === 'expert_admin' || user.role === 'super_admin') return true;
  if (user.role === 'student') return q.studentId === user.id;
  if (q.expertId === user.id) return true;
  if (!q.expertId && q.categoryId) return (await adminCategoryIds(user.id)).includes(q.categoryId);
  return false;
}

/** Loads a query the user is allowed to see, or throws 404. */
export async function loadVisibleQuery(user: UserRow, queryId: string): Promise<QueryRow> {
  const [q] = await db.select().from(t.queries).where(eq(t.queries.id, queryId)).limit(1);
  if (!q || !(await canViewQuery(user, q))) throw new HttpError(404, 'Query not found.');
  return q;
}

/** Whether the user may act as the answering side of a query (reply, change status). */
export function isQueryStaff(user: UserRow, q: QueryRow): boolean {
  if (user.role === 'expert_admin' || user.role === 'super_admin') return true;
  return user.role === 'normal_admin' && (q.expertId === user.id || !q.expertId);
}
