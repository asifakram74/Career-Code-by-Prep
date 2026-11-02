import { and, eq, inArray } from 'drizzle-orm';
import { db, t } from './db';
import { newId } from './http';
import { emitToUser } from './realtime';
import { ADMIN_ROLES, type Role } from './auth';

export type NotificationType =
  | 'query_update'
  | 'new_reply'
  | 'new_query'
  | 'admin_alert'
  | 'assignment'
  | 'query_rating'
  | 'query_resolved'
  | 'coffee_treat'
  | 'platform_review';

export interface NotificationInput {
  title: string;
  message: string;
  type: NotificationType;
  queryId?: string | null;
}

/** Creates one notification per recipient (deduplicated) and pushes it over the socket. */
export async function notify(userIds: (string | null | undefined)[], input: NotificationInput, exceptUserId?: string) {
  const recipients = [...new Set(userIds.filter((id): id is string => Boolean(id) && id !== exceptUserId))];
  if (!recipients.length) return;
  const now = Date.now();
  const rows = recipients.map((userId) => ({
    id: newId(),
    userId,
    title: input.title.slice(0, 200),
    message: input.message.slice(0, 1000),
    type: input.type,
    queryId: input.queryId ?? null,
    isRead: false,
    createdAt: now,
  }));
  await db.insert(t.notifications).values(rows);
  for (const row of rows) emitToUser(row.userId, 'notification:new', { ...row, queryId: row.queryId ?? undefined });
}

export async function activeUserIdsWithRoles(roles: Role[]): Promise<string[]> {
  const rows = await db
    .select({ id: t.users.id })
    .from(t.users)
    .where(and(inArray(t.users.role, roles), eq(t.users.status, 'active')));
  return rows.map((r) => r.id);
}

export const allActiveAdminIds = () => activeUserIdsWithRoles(ADMIN_ROLES);
export const superAdminIds = () => activeUserIdsWithRoles(['super_admin']);
