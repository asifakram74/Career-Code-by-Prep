import { db, t } from './db';
import { newId } from './http';
import type { UserRow } from './auth';

export async function audit(
  actor: Pick<UserRow, 'id' | 'displayName' | 'role'>,
  action: string,
  extra: { targetId?: string; targetType?: string; details?: string } = {}
) {
  await db.insert(t.auditLogs).values({
    id: newId(),
    actorId: actor.id,
    actorName: actor.displayName,
    actorRole: actor.role,
    action,
    ...extra,
  });
}
