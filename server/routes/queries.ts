import { Router } from 'express';
import { and, asc, desc, eq, inArray, isNull, ne, notInArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, t } from '../db';
import { currentUser, isAdmin, isManager, requireAuth, requireRole, type UserRow } from '../auth';
import { isQueryStaff, loadVisibleQuery, visibleQueriesFilter, adminCategoryIds, type QueryRow } from '../access';
import { HttpError, newId, parse, route } from '../http';
import { broadcastChange, emitQueryChange, emitToQueryRoom, emitToUser } from '../realtime';
import { allActiveAdminIds, notify } from '../notify';
import { serializeMessage, serializeQueries, serializeRow } from '../serialize';
import { audit } from '../audit';

export const queriesRouter = Router();
queriesRouter.use('/queries', requireAuth);

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const fileUrl = z.string().regex(/^\/api\/files\/[0-9a-f-]{36}$/, 'must be an uploaded file');

const attachmentSchema = z.object({
  id: z.string().max(100),
  name: z.string().max(255),
  size: z.number().int().nonnegative(),
  type: z.string().max(150),
  url: fileUrl,
});

const contentFields = {
  attachments: z.array(attachmentSchema).max(10).default([]),
  audioUrl: fileUrl.optional(),
  audioDuration: z.number().int().min(0).max(60 * 60).optional(),
};

const RATING_RESET = { rating: null, ratingFeedback: null, ratingTags: null, ratedAt: null } as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function nextTicketNumber(tx: Tx): Promise<string> {
  const result = await tx.execute<{ n: string }>(sql`select nextval('ticket_number_seq')::text as n`);
  return `PT-${result.rows[0].n}`;
}

function preview(content: string, audioUrl?: string, attachments: unknown[] = []) {
  if (audioUrl && !content.trim()) return '🎤 Voice Message';
  if (!content.trim() && attachments.length) return '📎 File Attachment';
  return content.replace(/\s+/g, ' ').trim().slice(0, 120);
}

const headerContent = (title: string, detail: string, prefix = 'New Query') =>
  `📌 **${prefix}: ${title}**\n\n${detail}`;

async function getQuery(id: string, tx: Tx | typeof db = db): Promise<QueryRow> {
  const [q] = await tx.select().from(t.queries).where(eq(t.queries.id, id)).limit(1);
  if (!q) throw new HttpError(404, 'Query not found.');
  return q;
}

/** Pushes the current state of tickets to everyone who can see them (including former assignees). */
async function broadcastQueries(rows: QueryRow[], alsoNotify: QueryRow[] = []) {
  const serialized = await serializeQueries(rows);
  rows.forEach((q, i) => emitQueryChange(q, 'query:upsert', serialized[i]));
  for (const old of alsoNotify) {
    const current = rows.find((r) => r.id === old.id);
    if (current && old.expertId && old.expertId !== current.expertId) {
      emitToUser(old.expertId, 'query:upsert', serialized[rows.indexOf(current)]);
    }
  }
  return serialized;
}

async function serializeOne(q: QueryRow) {
  return (await serializeQueries([q]))[0];
}

function assertStudentOwner(user: UserRow, q: QueryRow) {
  if (user.role !== 'student' || q.studentId !== user.id) throw new HttpError(403, 'Only the student who asked can do that.');
}

function assertStaff(user: UserRow, q: QueryRow) {
  if (!isQueryStaff(user, q)) throw new HttpError(403, 'You are not assigned to this query.');
}

async function loadActiveAdmin(id: string, tx: Tx | typeof db = db): Promise<UserRow> {
  const [admin] = await tx.select().from(t.users).where(eq(t.users.id, id)).limit(1);
  if (!admin || !isAdmin(admin.role) || admin.status !== 'active') {
    throw new HttpError(400, 'The selected counselor is not available.');
  }
  return admin;
}

function expertFields(admin: UserRow | null) {
  return {
    expertId: admin?.id ?? null,
    expertEmail: admin?.email ?? null,
    expertName: admin?.displayName ?? 'General Expert Queue',
    expertRole: admin?.role ?? '',
    expertTitle: admin?.professionalTitle ?? null,
    expertAvatarUrl: admin?.photoUrl ?? null,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

// GET /api/queries?scope=mine|all
//   student: own tickets
//   admins, scope=mine (default): assigned to me, plus unassigned in my categories (normal admins)
//   expert/super admins, scope=all: every ticket
queriesRouter.get(
  '/queries',
  route(async (req, res) => {
    const user = currentUser(req);
    const scope = req.query.scope === 'all' ? 'all' : 'mine';
    let where;
    if (user.role === 'student' || user.role === 'normal_admin') {
      where = await visibleQueriesFilter(user);
    } else if (scope === 'mine') {
      where = eq(t.queries.expertId, user.id);
    }
    const rows = await db
      .select()
      .from(t.queries)
      .where(where)
      .orderBy(desc(sql`coalesce(${t.queries.lastReplyAt}, ${t.queries.createdAt})`));
    res.json(await serializeQueries(rows));
  })
);

queriesRouter.get(
  '/queries/:id',
  route(async (req, res) => {
    const q = await loadVisibleQuery(currentUser(req), String(req.params.id));
    res.json(await serializeOne(q));
  })
);

queriesRouter.get(
  '/queries/:id/messages',
  route(async (req, res) => {
    const q = await loadVisibleQuery(currentUser(req), String(req.params.id));
    const rows = await db.select().from(t.messages).where(eq(t.messages.queryId, q.id)).orderBy(asc(t.messages.createdAt));
    res.json(rows.map(serializeMessage));
  })
);

queriesRouter.get(
  '/queries/:id/coffee-treat',
  route(async (req, res) => {
    const q = await loadVisibleQuery(currentUser(req), String(req.params.id));
    const [treat] = await db
      .select()
      .from(t.coffeeTreats)
      .where(eq(t.coffeeTreats.ticketId, q.id))
      .orderBy(desc(t.coffeeTreats.createdAt))
      .limit(1);
    res.json(treat ? serializeRow(treat) : null);
  })
);

// Active admins a ticket can be assigned to, optionally limited to one category.
queriesRouter.get(
  '/queries-meta/experts',
  requireAuth,
  route(async (req, res) => {
    const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : '';
    const base = and(inArray(t.users.role, ['normal_admin', 'expert_admin', 'super_admin']), eq(t.users.status, 'active'));
    const rows = categoryId
      ? await db
          .select({ u: t.users })
          .from(t.users)
          .innerJoin(t.categoryAdmins, eq(t.categoryAdmins.adminId, t.users.id))
          .where(and(base, eq(t.categoryAdmins.categoryId, categoryId)))
          .then((r) => r.map((x) => x.u))
      : await db.select().from(t.users).where(base);
    res.json(
      rows.map((u) => ({
        uid: u.id,
        displayName: u.displayName,
        role: u.role,
        professionalTitle: u.professionalTitle ?? undefined,
        shortDescription: u.shortDescription ?? undefined,
        photoURL: u.photoUrl ?? undefined,
        isOnline: u.isOnline,
        averageRating: u.ratingCount ? Math.round((u.ratingSum / u.ratingCount) * 10) / 10 : undefined,
        ratingCount: u.ratingCount,
      }))
    );
  })
);

// ---------------------------------------------------------------------------
// A1: student submits a new query (merged into an existing chat with the same counselor)
// ---------------------------------------------------------------------------

const createQueryBody = z.object({
  categoryId: z.string().min(1).max(100),
  expertId: z.string().max(100).optional(),
  title: z.string().trim().min(1).max(200),
  detail: z.string().trim().max(4000).default(''),
  ...contentFields,
});

queriesRouter.post(
  '/queries',
  requireRole('student'),
  route(async (req, res) => {
    const student = currentUser(req);
    const body = parse(createQueryBody, req.body);
    if (!body.detail && !body.audioUrl) throw new HttpError(400, 'Describe your query or record a voice note.');

    const [category] = await db.select().from(t.categories).where(eq(t.categories.id, body.categoryId)).limit(1);
    if (!category || category.status !== 'active') throw new HttpError(400, 'Please choose an active category.');

    const targetId = body.expertId && body.expertId !== 'unassigned' ? body.expertId : category.primaryAdminId;
    const expert = targetId ? await loadActiveAdmin(targetId).catch(() => null) : null;
    if (body.expertId && body.expertId !== 'unassigned' && !expert) {
      throw new HttpError(400, 'The selected counselor is not available.');
    }

    const now = Date.now();
    const lastReplyPreview = body.audioUrl ? `🎤 Voice Note: ${body.title}` : `📌 Initial Query: ${body.title}`;

    const result = await db.transaction(async (tx) => {
      // Reuse the student's existing (not hidden) chat with this counselor.
      let existing: QueryRow | undefined;
      if (expert) {
        [existing] = await tx
          .select()
          .from(t.queries)
          .where(
            and(
              eq(t.queries.studentId, student.id),
              eq(t.queries.expertId, expert.id),
              notInArray(
                t.queries.id,
                tx.select({ id: t.queryHiddenFor.queryId }).from(t.queryHiddenFor).where(eq(t.queryHiddenFor.userId, student.id))
              )
            )
          )
          .orderBy(desc(t.queries.updatedAt))
          .limit(1);
      }

      if (existing) {
        await tx.insert(t.messages).values({
          id: newId(),
          queryId: existing.id,
          senderId: student.id,
          senderName: student.displayName,
          senderRole: 'student',
          senderAvatarUrl: student.photoUrl,
          content: headerContent(body.title, body.detail),
          audioUrl: body.audioUrl,
          audioDuration: body.audioDuration,
          attachments: body.attachments,
          isNewQueryHeader: true,
          queryTitle: body.title,
          createdAt: now,
        });
        const [updated] = await tx
          .update(t.queries)
          .set({
            // The ticket shows the latest question; earlier ones remain in the thread as header messages.
            title: body.title,
            detail: body.detail,
            categoryId: category.id,
            categoryName: category.name,
            status: 'open',
            assignmentStatus: 'assigned',
            reassignedToAdminId: null,
            reassignedToAdminName: null,
            hasUnreadStudentReply: false,
            hasUnreadAdminReply: true,
            isInitialQueryReadByAdmin: false,
            lastReplyPreview,
            lastReplyAt: now,
            lastSenderRole: 'student',
            lastSenderName: student.displayName,
            lastSenderId: student.id,
            audioUrl: body.audioUrl ?? null,
            audioDuration: body.audioDuration ?? null,
            updatedAt: now,
          })
          .where(eq(t.queries.id, existing.id))
          .returning();
        return { ticket: updated, merged: true };
      }

      const [created] = await tx
        .insert(t.queries)
        .values({
          id: newId(),
          ticketNumber: await nextTicketNumber(tx),
          studentId: student.id,
          studentName: student.displayName,
          studentEmail: student.email,
          studentPhone: student.phoneNumber,
          studentQualification: student.qualification ?? '',
          studentBoard: student.board,
          studentAvatarUrl: student.photoUrl,
          categoryId: category.id,
          categoryName: category.name,
          ...expertFields(expert),
          title: body.title,
          detail: body.detail,
          audioUrl: body.audioUrl,
          audioDuration: body.audioDuration,
          attachments: body.attachments,
          status: 'open',
          assignmentStatus: expert ? 'assigned' : 'unassigned',
          hasUnreadAdminReply: true,
          lastReplyPreview,
          lastReplyAt: now,
          lastSenderRole: 'student',
          lastSenderName: student.displayName,
          lastSenderId: student.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return { ticket: created, merged: false };
    });

    const recipients = expert ? [expert.id] : await allActiveAdminIds();
    await notify(recipients, {
      title: expert ? `New Query from ${student.displayName}` : `Unassigned Query in ${category.name}`,
      message: body.title,
      type: 'new_query',
      queryId: result.ticket.id,
    });
    const [ticket] = await broadcastQueries([result.ticket]);
    res.status(201).json({ ticket, merged: result.merged });
  })
);

// ---------------------------------------------------------------------------
// A2: send a message (text, files or voice)
// ---------------------------------------------------------------------------

const messageBody = z.object({ content: z.string().max(8000).default(''), ...contentFields });

queriesRouter.post(
  '/queries/:id/messages',
  route(async (req, res) => {
    const user = currentUser(req);
    const body = parse(messageBody, req.body);
    if (!body.content.trim() && !body.audioUrl && !body.attachments.length) throw new HttpError(400, 'Message is empty.');

    const q = await loadVisibleQuery(user, String(req.params.id));
    const fromStudent = user.role === 'student';
    if (fromStudent) assertStudentOwner(user, q);
    else assertStaff(user, q);

    const now = Date.now();
    const content = body.content.trim() || (body.audioUrl ? '🎤 Voice Message' : '');
    const { message, ticket } = await db.transaction(async (tx) => {
      const [message] = await tx
        .insert(t.messages)
        .values({
          id: newId(),
          queryId: q.id,
          senderId: user.id,
          senderName: user.displayName,
          senderRole: user.role,
          senderAvatarUrl: user.photoUrl,
          content,
          audioUrl: body.audioUrl,
          audioDuration: body.audioDuration,
          attachments: body.attachments,
          createdAt: now,
        })
        .returning();

      const common = {
        lastReplyPreview: preview(body.content, body.audioUrl, body.attachments),
        lastReplyAt: now,
        lastSenderRole: user.role,
        lastSenderName: user.displayName,
        lastSenderId: user.id,
        updatedAt: now,
      };
      const changes = fromStudent
        ? {
            ...common,
            hasUnreadAdminReply: true,
            ...(q.status === 'replied' || q.status === 'resolved' ? { status: 'in_progress' as const } : {}),
          }
        : {
            ...common,
            hasUnreadStudentReply: true,
            status: 'replied' as const,
            // A normal admin answering an unassigned ticket in their category claims it.
            ...(!q.expertId && user.role === 'normal_admin' ? { ...expertFields(user), assignmentStatus: 'assigned' as const } : {}),
          };
      const [ticket] = await tx.update(t.queries).set(changes).where(eq(t.queries.id, q.id)).returning();
      if (!fromStudent) await tx.update(t.users).set({ lastReplyAt: now }).where(eq(t.users.id, user.id));
      return { message, ticket };
    });

    const serializedMessage = serializeMessage(message);
    emitToQueryRoom(q.id, 'message:new', serializedMessage);
    const [serializedTicket] = await broadcastQueries([ticket]);

    const isVoice = Boolean(body.audioUrl);
    if (fromStudent) {
      const recipients = ticket.expertId ? [ticket.expertId] : await allActiveAdminIds();
      await notify(recipients, {
        title: isVoice ? `Student Voice Note: ${ticket.title}` : `New Reply from ${user.displayName}`,
        message: serializedTicket.lastReplyPreview ?? '',
        type: 'new_reply',
        queryId: q.id,
      });
    } else {
      await notify([ticket.studentId], {
        title: isVoice ? `Expert Voice Note: ${ticket.title}` : `${user.displayName} replied`,
        message: serializedTicket.lastReplyPreview ?? '',
        type: 'new_reply',
        queryId: q.id,
      });
    }
    res.status(201).json({ message: serializedMessage, ticket: serializedTicket });
  })
);

// ---------------------------------------------------------------------------
// A3: follow-up question in the same chat
// ---------------------------------------------------------------------------

const followUpBody = z.object({
  title: z.string().trim().min(1).max(200),
  detail: z.string().trim().max(4000).default(''),
  ...contentFields,
});

queriesRouter.post(
  '/queries/:id/follow-up',
  requireRole('student'),
  route(async (req, res) => {
    const user = currentUser(req);
    const body = parse(followUpBody, req.body);
    const q = await loadVisibleQuery(user, String(req.params.id));
    assertStudentOwner(user, q);

    const now = Date.now();
    const { message, ticket } = await db.transaction(async (tx) => {
      const [message] = await tx
        .insert(t.messages)
        .values({
          id: newId(),
          queryId: q.id,
          senderId: user.id,
          senderName: user.displayName,
          senderRole: 'student',
          senderAvatarUrl: user.photoUrl,
          content: headerContent(body.title, body.detail),
          audioUrl: body.audioUrl,
          audioDuration: body.audioDuration,
          attachments: body.attachments,
          isNewQueryHeader: true,
          queryTitle: body.title,
          createdAt: now,
        })
        .returning();
      const [ticket] = await tx
        .update(t.queries)
        .set({
          status: 'in_progress',
          title: body.title,
          detail: body.detail,
          lastReplyPreview: `📌 New Query: ${body.title}`,
          lastReplyAt: now,
          lastSenderRole: 'student',
          lastSenderName: user.displayName,
          lastSenderId: user.id,
          hasUnreadAdminReply: true,
          hasUnreadStudentReply: false,
          updatedAt: now,
        })
        .where(eq(t.queries.id, q.id))
        .returning();
      return { message, ticket };
    });

    const serializedMessage = serializeMessage(message);
    emitToQueryRoom(q.id, 'message:new', serializedMessage);
    const [serializedTicket] = await broadcastQueries([ticket]);
    await notify(ticket.expertId ? [ticket.expertId] : await allActiveAdminIds(), {
      title: `Follow-up Query from ${user.displayName}`,
      message: body.title,
      type: 'new_query',
      queryId: q.id,
    });
    res.status(201).json({ message: serializedMessage, ticket: serializedTicket });
  })
);

// ---------------------------------------------------------------------------
// A4 / A5: status changes and reopening
// ---------------------------------------------------------------------------

const statusBody = z.object({ status: z.enum(['open', 'in_progress', 'replied', 'waiting_for_student', 'resolved']) });

queriesRouter.patch(
  '/queries/:id/status',
  route(async (req, res) => {
    const user = currentUser(req);
    const { status } = parse(statusBody, req.body);
    const q = await loadVisibleQuery(user, String(req.params.id));
    if (user.role === 'student') {
      assertStudentOwner(user, q);
      if (status !== 'resolved') throw new HttpError(403, 'Students can only mark their query as resolved.');
    } else {
      assertStaff(user, q);
    }
    if (q.status === status) return res.json(await serializeOne(q));

    // Resolving keeps any existing rating; reopening (below) clears it.
    const [ticket] = await db
      .update(t.queries)
      .set({ status, updatedAt: Date.now() })
      .where(eq(t.queries.id, q.id))
      .returning();
    const [serialized] = await broadcastQueries([ticket]);
    if (status === 'resolved' && user.role !== 'student') {
      await notify([ticket.studentId], {
        title: `Query Resolved: #${ticket.ticketNumber}`,
        message: `${user.displayName} marked "${ticket.title}" as resolved. You can rate the guidance you received.`,
        type: 'query_resolved',
        queryId: ticket.id,
      });
    }
    res.json(serialized);
  })
);

queriesRouter.post(
  '/queries/:id/reopen',
  route(async (req, res) => {
    const user = currentUser(req);
    const q = await loadVisibleQuery(user, String(req.params.id));
    const byStudent = user.role === 'student';
    if (byStudent) assertStudentOwner(user, q);
    else assertStaff(user, q);

    const [ticket] = await db
      .update(t.queries)
      .set({
        status: 'in_progress',
        ...RATING_RESET,
        ...(byStudent ? { hasUnreadAdminReply: true, hasUnreadStudentReply: false } : {}),
        updatedAt: Date.now(),
      })
      .where(eq(t.queries.id, q.id))
      .returning();
    // Undo the counselor's rating aggregate for the rating being cleared.
    if (q.rating && q.expertId) {
      await db
        .update(t.users)
        .set({
          ratingCount: sql`greatest(${t.users.ratingCount} - 1, 0)`,
          ratingSum: sql`greatest(${t.users.ratingSum} - ${q.rating}, 0)`,
        })
        .where(eq(t.users.id, q.expertId));
    }
    res.json((await broadcastQueries([ticket]))[0]);
  })
);

// ---------------------------------------------------------------------------
// A7: student rates a resolved ticket
// ---------------------------------------------------------------------------

const ratingBody = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().trim().max(2000).default(''),
  tags: z.array(z.string().max(60)).max(10).default([]),
});

queriesRouter.post(
  '/queries/:id/rating',
  requireRole('student'),
  route(async (req, res) => {
    const user = currentUser(req);
    const body = parse(ratingBody, req.body);
    const q = await loadVisibleQuery(user, String(req.params.id));
    assertStudentOwner(user, q);
    if (q.status !== 'resolved') throw new HttpError(400, 'You can rate a query once it is resolved.');

    const now = Date.now();
    const { ticket, expert } = await db.transaction(async (tx) => {
      // Lock the ticket so concurrent submissions can't double-count.
      const [locked] = await tx.select().from(t.queries).where(eq(t.queries.id, q.id)).for('update');
      const [ticket] = await tx
        .update(t.queries)
        .set({ rating: body.rating, ratingFeedback: body.feedback, ratingTags: body.tags, ratedAt: now, updatedAt: now })
        .where(eq(t.queries.id, q.id))
        .returning();
      let expert: UserRow | undefined;
      if (locked.expertId) {
        [expert] = await tx
          .update(t.users)
          .set({
            ratingCount: locked.rating ? t.users.ratingCount : sql`${t.users.ratingCount} + 1`,
            ratingSum: sql`${t.users.ratingSum} + ${body.rating - (locked.rating ?? 0)}`,
          })
          .where(eq(t.users.id, locked.expertId))
          .returning();
      }
      return { ticket, expert };
    });

    const [serialized] = await broadcastQueries([ticket]);
    broadcastChange('reviews');
    await notify([ticket.expertId], {
      title: `${'⭐'.repeat(body.rating)} New Rating from ${user.displayName}`,
      message: body.feedback || `Ticket #${ticket.ticketNumber} was rated ${body.rating}/5.`,
      type: 'query_rating',
      queryId: ticket.id,
    });
    res.json({
      ticket: serialized,
      expert: expert && {
        ratingCount: expert.ratingCount,
        ratingSum: expert.ratingSum,
        averageRating: expert.ratingCount ? Math.round((expert.ratingSum / expert.ratingCount) * 10) / 10 : undefined,
      },
    });
  })
);

// ---------------------------------------------------------------------------
// A8: mark a conversation as read
// ---------------------------------------------------------------------------

queriesRouter.post(
  '/queries/:id/read',
  route(async (req, res) => {
    const user = currentUser(req);
    const q = await loadVisibleQuery(user, String(req.params.id));
    const isStudent = user.role === 'student' && q.studentId === user.id;
    const isAssignee = q.expertId === user.id;

    // Notifications are always cleared; read receipts only for the two participants.
    await db
      .update(t.notifications)
      .set({ isRead: true })
      .where(and(eq(t.notifications.userId, user.id), eq(t.notifications.queryId, q.id), eq(t.notifications.isRead, false)));
    emitToUser(user.id, 'notification:read', { queryId: q.id });

    if (!isStudent && !isAssignee) return res.json(await serializeOne(q));

    const readMessages = await db
      .update(t.messages)
      .set({ isRead: true })
      .where(
        and(
          eq(t.messages.queryId, q.id),
          eq(t.messages.isRead, false),
          isStudent ? ne(t.messages.senderRole, 'student') : eq(t.messages.senderRole, 'student')
        )
      )
      .returning({ id: t.messages.id });
    if (readMessages.length) {
      emitToQueryRoom(q.id, 'message:update', { queryId: q.id, readIds: readMessages.map((m) => m.id) });
    }

    const flags = isStudent
      ? { hasUnreadStudentReply: false }
      : { hasUnreadAdminReply: false, isInitialQueryReadByAdmin: true };
    const needsUpdate = isStudent
      ? q.hasUnreadStudentReply
      : q.hasUnreadAdminReply || !q.isInitialQueryReadByAdmin;
    if (!needsUpdate) return res.json(await serializeOne(q));
    const [ticket] = await db.update(t.queries).set(flags).where(eq(t.queries.id, q.id)).returning();
    res.json((await broadcastQueries([ticket]))[0]);
  })
);

// ---------------------------------------------------------------------------
// A9: delete a chat "for me"
// ---------------------------------------------------------------------------

queriesRouter.post(
  '/queries/:id/hide',
  route(async (req, res) => {
    const user = currentUser(req);
    const q = await loadVisibleQuery(user, String(req.params.id));
    await db.transaction(async (tx) => {
      await tx.insert(t.queryHiddenFor).values({ queryId: q.id, userId: user.id }).onConflictDoNothing();
      await tx.delete(t.savedAnswers).where(and(eq(t.savedAnswers.studentId, user.id), eq(t.savedAnswers.queryId, q.id)));
      await tx.delete(t.notifications).where(and(eq(t.notifications.userId, user.id), eq(t.notifications.queryId, q.id)));
    });
    emitToUser(user.id, 'query:removed', { id: q.id });
    res.json({ success: true });
  })
);

// ---------------------------------------------------------------------------
// A6: reassign a ticket to another counselor
// ---------------------------------------------------------------------------

const reassignBody = z.object({ newExpertId: z.string().min(1).max(100) });

export async function reassignQuery(actor: UserRow, q: QueryRow, newExpertId: string) {
  if (q.assignmentStatus === 'reassigned') throw new HttpError(409, 'This query has already been reassigned.');
  if (q.expertId === newExpertId) throw new HttpError(400, 'The query is already assigned to that counselor.');
  const target = await loadActiveAdmin(newExpertId);
  const now = Date.now();
  const previousName = q.expertName || 'the previous counselor';

  const result = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(t.queries).where(eq(t.queries.id, q.id)).for('update');
    if (locked.assignmentStatus === 'reassigned') throw new HttpError(409, 'This query has already been reassigned.');

    await tx.insert(t.messages).values({
      id: newId(),
      queryId: q.id,
      senderId: null,
      senderName: 'System',
      senderRole: actor.role,
      content: `🔄 This query has been reassigned to ${target.displayName}.`,
      isSystemMessage: true,
      isRead: true,
      createdAt: now,
    });
    const [oldTicket] = await tx
      .update(t.queries)
      .set({
        assignmentStatus: 'reassigned',
        reassignedToAdminId: target.id,
        reassignedToAdminName: target.displayName,
        status: 'resolved',
        lastReplyPreview: `🔄 Reassigned to ${target.displayName}`,
        lastReplyAt: now,
        updatedAt: now,
      })
      .where(eq(t.queries.id, q.id))
      .returning();

    // Continue in the student's existing chat with the new counselor, if any.
    const [existing] = q.studentId
      ? await tx
          .select()
          .from(t.queries)
          .where(
            and(
              eq(t.queries.studentId, q.studentId),
              eq(t.queries.expertId, target.id),
              ne(t.queries.id, q.id),
              notInArray(
                t.queries.id,
                tx
                  .select({ id: t.queryHiddenFor.queryId })
                  .from(t.queryHiddenFor)
                  .where(inArray(t.queryHiddenFor.userId, [q.studentId, target.id]))
              )
            )
          )
          .orderBy(desc(t.queries.updatedAt))
          .limit(1)
      : [];

    const shared = {
      status: 'open' as const,
      assignmentStatus: 'assigned' as const,
      hasUnreadStudentReply: false,
      hasUnreadAdminReply: true,
      isInitialQueryReadByAdmin: false,
      lastReplyPreview: `📌 Reassigned Query: ${q.title}`,
      lastReplyAt: now,
      lastSenderRole: 'student' as const,
      lastSenderName: q.studentName,
      lastSenderId: q.studentId,
      audioUrl: q.audioUrl,
      audioDuration: q.audioDuration,
      updatedAt: now,
    };

    let targetTicket: QueryRow;
    if (existing) {
      [targetTicket] = await tx
        .update(t.queries)
        .set({ ...shared, title: q.title, detail: q.detail })
        .where(eq(t.queries.id, existing.id))
        .returning();
      // The question itself is the student's, so it is shown as theirs.
      await tx.insert(t.messages).values({
        id: newId(),
        queryId: existing.id,
        senderId: q.studentId,
        senderName: q.studentName,
        senderRole: 'student',
        senderAvatarUrl: q.studentAvatarUrl,
        content: headerContent(q.title, q.detail, `New Query (Reassigned from ${previousName})`),
        audioUrl: q.audioUrl,
        audioDuration: q.audioDuration,
        attachments: q.attachments,
        isNewQueryHeader: true,
        queryTitle: q.title,
        createdAt: now,
      });
    } else {
      [targetTicket] = await tx
        .insert(t.queries)
        .values({
          ...q,
          ...shared,
          id: newId(),
          ticketNumber: await nextTicketNumber(tx),
          ...expertFields(target),
          ...RATING_RESET,
          reassignedToAdminId: null,
          reassignedToAdminName: null,
          reassignedFromAdminId: q.expertId,
          reassignedFromAdminName: q.expertName,
          reassignedInitialTicketId: q.id,
          createdAt: now,
        })
        .returning();
    }
    return { oldTicket, targetTicket, merged: Boolean(existing) };
  });

  const [oldTicket, targetTicket] = await broadcastQueries([result.oldTicket, result.targetTicket], [q]);
  await notify([target.id], {
    title: 'Query Reassigned to You',
    message: `${q.studentName}: ${q.title}`,
    type: 'new_query',
    queryId: result.targetTicket.id,
  });
  await notify([q.studentId], {
    title: `Query Reassigned to ${target.displayName}`,
    message: `Your query "${q.title}" will now be answered by ${target.displayName}.`,
    type: 'new_reply',
    queryId: result.targetTicket.id,
  });
  await audit(actor, 'query_reassigned', {
    targetId: q.id,
    targetType: 'query',
    details: `#${q.ticketNumber} from ${previousName} to ${target.displayName}`,
  });
  return { oldTicket, targetTicket, merged: result.merged };
}

queriesRouter.post(
  '/queries/:id/reassign',
  route(async (req, res) => {
    const user = currentUser(req);
    if (!isAdmin(user.role)) throw new HttpError(403, 'Only counselors can reassign queries.');
    const { newExpertId } = parse(reassignBody, req.body);
    const q = await loadVisibleQuery(user, String(req.params.id));
    assertStaff(user, q);
    res.json(await reassignQuery(user, q, newExpertId));
  })
);

// Unassigned tickets in categories the caller covers (normal admins) or anywhere (managers).
queriesRouter.get(
  '/queries-meta/unassigned',
  requireRole('normal_admin', 'expert_admin', 'super_admin'),
  route(async (req, res) => {
    const user = currentUser(req);
    const cats = isManager(user.role) ? null : await adminCategoryIds(user.id);
    if (cats && !cats.length) return res.json([]);
    const rows = await db
      .select()
      .from(t.queries)
      .where(and(isNull(t.queries.expertId), cats ? inArray(t.queries.categoryId, cats) : undefined))
      .orderBy(desc(t.queries.createdAt));
    res.json(await serializeQueries(rows));
  })
);
