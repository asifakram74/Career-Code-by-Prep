import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, t } from '../db';
import { currentUser, requireAuth } from '../auth';
import { HttpError, parse, route } from '../http';
import { emitToUser } from '../realtime';
import { serializeRow } from '../serialize';

export const notificationsRouter = Router();
notificationsRouter.use('/notifications', requireAuth);

notificationsRouter.get(
  '/notifications',
  route(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const rows = await db
      .select()
      .from(t.notifications)
      .where(eq(t.notifications.userId, currentUser(req).id))
      .orderBy(desc(t.notifications.createdAt))
      .limit(limit);
    res.json(rows.map((r) => serializeRow(r)));
  })
);

notificationsRouter.patch(
  '/notifications/:id/read',
  route(async (req, res) => {
    const user = currentUser(req);
    const [row] = await db
      .update(t.notifications)
      .set({ isRead: true })
      .where(and(eq(t.notifications.id, String(req.params.id)), eq(t.notifications.userId, user.id)))
      .returning({ id: t.notifications.id });
    if (!row) throw new HttpError(404, 'Notification not found.');
    emitToUser(user.id, 'notification:read', { ids: [row.id] });
    res.json({ success: true });
  })
);

notificationsRouter.post(
  '/notifications/read-all',
  route(async (req, res) => {
    const user = currentUser(req);
    const rows = await db
      .update(t.notifications)
      .set({ isRead: true })
      .where(and(eq(t.notifications.userId, user.id), eq(t.notifications.isRead, false)))
      .returning({ id: t.notifications.id });
    emitToUser(user.id, 'notification:read', { all: true });
    res.json({ updated: rows.length });
  })
);

notificationsRouter.post(
  '/notifications/read-by-query',
  route(async (req, res) => {
    const user = currentUser(req);
    const { queryId } = parse(z.object({ queryId: z.string().min(1).max(100) }), req.body);
    const rows = await db
      .update(t.notifications)
      .set({ isRead: true })
      .where(and(eq(t.notifications.userId, user.id), eq(t.notifications.queryId, queryId), eq(t.notifications.isRead, false)))
      .returning({ id: t.notifications.id });
    emitToUser(user.id, 'notification:read', { queryId });
    res.json({ updated: rows.length });
  })
);
