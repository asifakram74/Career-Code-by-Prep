import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, t } from '../db';
import { currentUser, requireAuth } from '../auth';
import { loadVisibleQuery } from '../access';
import { HttpError, newId, parse, route } from '../http';
import { emitToUser } from '../realtime';
import { serializeRow } from '../serialize';

export const savedAnswersRouter = Router();
savedAnswersRouter.use('/saved-answers', requireAuth);

savedAnswersRouter.get(
  '/saved-answers',
  route(async (req, res) => {
    const user = currentUser(req);
    const queryId = typeof req.query.queryId === 'string' ? req.query.queryId : undefined;
    const rows = await db
      .select()
      .from(t.savedAnswers)
      .where(and(eq(t.savedAnswers.studentId, user.id), queryId ? eq(t.savedAnswers.queryId, queryId) : undefined))
      .orderBy(desc(t.savedAnswers.savedAt));
    res.json(rows.map((r) => serializeRow(r)));
  })
);

const saveBody = z.object({
  queryId: z.string().min(1).max(100),
  messageId: z.string().max(100).optional(),
  queryTitle: z.string().max(300).default(''),
  categoryName: z.string().max(200).default(''),
  expertName: z.string().max(200).default(''),
  questionText: z.string().max(8000).default(''),
  answerText: z.string().max(8000).default(''),
});

savedAnswersRouter.post(
  '/saved-answers',
  route(async (req, res) => {
    const user = currentUser(req);
    const body = parse(saveBody, req.body);
    await loadVisibleQuery(user, body.queryId);
    if (body.messageId) {
      const [dupe] = await db
        .select()
        .from(t.savedAnswers)
        .where(and(eq(t.savedAnswers.studentId, user.id), eq(t.savedAnswers.messageId, body.messageId)))
        .limit(1);
      if (dupe) return res.json(serializeRow(dupe));
    }
    const [row] = await db
      .insert(t.savedAnswers)
      .values({ id: newId(), studentId: user.id, ...body, savedAt: Date.now() })
      .returning();
    const item = serializeRow(row);
    emitToUser(user.id, 'saved-answer:upsert', item);
    res.status(201).json(item);
  })
);

savedAnswersRouter.delete(
  '/saved-answers/:id',
  route(async (req, res) => {
    const user = currentUser(req);
    const [row] = await db
      .delete(t.savedAnswers)
      .where(and(eq(t.savedAnswers.id, String(req.params.id)), eq(t.savedAnswers.studentId, user.id)))
      .returning({ id: t.savedAnswers.id });
    if (!row) throw new HttpError(404, 'Saved answer not found.');
    emitToUser(user.id, 'saved-answer:deleted', { id: row.id });
    res.json({ success: true });
  })
);
