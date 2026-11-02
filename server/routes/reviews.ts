import { Router } from 'express';
import { desc, eq, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import { db, t } from '../db';
import { currentUser, isManager, requireAuth, requireRole } from '../auth';
import { loadVisibleQuery } from '../access';
import { HttpError, newId, parse, route } from '../http';
import { broadcastChange } from '../realtime';
import { notify, superAdminIds } from '../notify';
import { serializeRow } from '../serialize';
import { audit } from '../audit';

export const reviewsRouter = Router();

// ---------------------------------------------------------------------------
// Unified reviews: ratings on tickets + platform reviews
// ---------------------------------------------------------------------------

// Public view drops anything that identifies or contacts the student beyond the
// name they chose to show; managers additionally get ticket titles and emails.
reviewsRouter.get(
  '/reviews',
  route(async (req, res) => {
    const full = Boolean(req.user && isManager(req.user.role));
    const rated = await db
      .select()
      .from(t.queries)
      .where(isNotNull(t.queries.rating))
      .orderBy(desc(t.queries.ratedAt))
      .limit(500);
    const platform = await db
      .select()
      .from(t.platformReviews)
      .where(eq(t.platformReviews.status, 'active'))
      .orderBy(desc(t.platformReviews.createdAt))
      .limit(500);

    const fromQueries = rated.map((q) => ({
      id: q.id,
      source: 'query' as const,
      ticketNumber: q.ticketNumber,
      studentName: q.studentName,
      studentQualification: q.studentQualification,
      studentBoard: q.studentBoard ?? undefined,
      studentAvatarUrl: q.studentAvatarUrl ?? undefined,
      categoryId: q.categoryId ?? '',
      categoryName: q.categoryName,
      expertId: q.expertId ?? undefined,
      expertName: q.expertName,
      expertRole: q.expertRole,
      expertTitle: q.expertTitle ?? undefined,
      rating: q.rating!,
      ratingFeedback: q.ratingFeedback ?? '',
      ratingTags: q.ratingTags ?? [],
      ratedAt: q.ratedAt ?? q.updatedAt,
      ...(full ? { studentId: q.studentId ?? undefined, studentEmail: q.studentEmail, title: q.title } : {}),
    }));
    const fromPlatform = platform.map((p) => ({
      id: p.id,
      source: 'platform' as const,
      studentName: p.studentName,
      studentQualification: p.studentQualification,
      studentBoard: p.studentBoard ?? undefined,
      studentAvatarUrl: p.studentAvatarUrl ?? undefined,
      categoryId: '',
      categoryName: p.categoryName ?? 'Career Code LMS',
      expertName: p.expertName ?? 'Career Code Mentors',
      rating: p.rating,
      ratingFeedback: p.ratingFeedback,
      ratingTags: p.ratingTags,
      ratedAt: p.createdAt,
      ...(full ? { studentId: p.studentId ?? undefined, studentEmail: p.studentEmail ?? undefined } : {}),
    }));
    res.json([...fromQueries, ...fromPlatform].sort((a, b) => b.ratedAt - a.ratedAt));
  })
);

const reviewBody = z.object({
  studentName: z.string().trim().min(2).max(120),
  studentQualification: z.string().trim().max(100).default(''),
  studentBoard: z.string().trim().max(100).optional(),
  rating: z.number().int().min(1).max(5),
  ratingFeedback: z.string().trim().min(5).max(2000),
  ratingTags: z.array(z.string().max(60)).max(10).default([]),
});

// At most 3 reviews per IP per day.
const reviewAttempts = new Map<string, { count: number; resetAt: number }>();

reviewsRouter.post(
  '/platform-reviews',
  route(async (req, res) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = reviewAttempts.get(key);
    if (entry && entry.resetAt > now && entry.count >= 3) {
      throw new HttpError(429, 'You have already submitted reviews today. Thank you!');
    }
    if (!entry || entry.resetAt <= now) reviewAttempts.set(key, { count: 1, resetAt: now + 86_400_000 });
    else entry.count++;

    const body = parse(reviewBody, req.body);
    const student = req.user?.role === 'student' ? req.user : undefined;
    // Signed-in students' reviews go live immediately; guests' wait for approval.
    const status = student ? 'active' : 'pending';
    const [row] = await db
      .insert(t.platformReviews)
      .values({
        id: newId(),
        studentId: student?.id ?? null,
        studentName: body.studentName,
        studentEmail: student?.email ?? null,
        studentQualification: body.studentQualification,
        studentBoard: body.studentBoard ?? null,
        studentAvatarUrl: student?.photoUrl ?? null,
        rating: body.rating,
        ratingFeedback: body.ratingFeedback,
        ratingTags: body.ratingTags,
        categoryName: 'Career Code LMS',
        expertName: 'Career Code Mentors',
        status,
        createdAt: now,
      })
      .returning();
    await notify(await superAdminIds(), {
      title: '⭐ New Review for Career Code!',
      message: `${body.studentName} rated Career Code ${body.rating}/5${status === 'pending' ? ' (awaiting approval)' : ''}.`,
      type: 'platform_review',
    });
    if (status === 'active') broadcastChange('reviews');
    res.status(201).json({ ...serializeRow(row), pending: status === 'pending' });
  })
);

reviewsRouter.get(
  '/admin/platform-reviews',
  requireRole('expert_admin', 'super_admin'),
  route(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const rows = await db
      .select()
      .from(t.platformReviews)
      .where(status ? eq(t.platformReviews.status, status) : undefined)
      .orderBy(desc(t.platformReviews.createdAt));
    res.json(rows.map((r) => serializeRow(r)));
  })
);

reviewsRouter.patch(
  '/admin/platform-reviews/:id',
  requireRole('expert_admin', 'super_admin'),
  route(async (req, res) => {
    const { status } = parse(z.object({ status: z.enum(['active', 'hidden', 'pending']) }), req.body);
    const [row] = await db
      .update(t.platformReviews)
      .set({ status })
      .where(eq(t.platformReviews.id, String(req.params.id)))
      .returning();
    if (!row) throw new HttpError(404, 'Review not found.');
    await audit(currentUser(req), `platform_review_${status}`, { targetId: row.id, targetType: 'platform_review', details: row.studentName });
    broadcastChange('reviews');
    res.json(serializeRow(row));
  })
);

// ---------------------------------------------------------------------------
// Coffee treats
// ---------------------------------------------------------------------------

// Payment details live in server configuration, not in the frontend bundle.
function coffeeConfig() {
  return {
    amount: Number(process.env.COFFEE_AMOUNT_PKR) || 250,
    paymentMethod: process.env.COFFEE_PAYMENT_METHOD || '',
    accountNumber: process.env.COFFEE_ACCOUNT_NUMBER || '',
    accountTitle: process.env.COFFEE_ACCOUNT_TITLE || '',
  };
}

reviewsRouter.get(
  '/coffee-treats/config',
  requireAuth,
  route(async (_req, res) => {
    const cfg = coffeeConfig();
    res.json({ ...cfg, enabled: Boolean(cfg.accountNumber) });
  })
);

const coffeeBody = z.object({
  ticketId: z.string().min(1).max(100),
  paymentMethod: z.string().trim().max(60).optional(),
  screenshotUrl: z.string().regex(/^\/api\/files\/[0-9a-f-]{36}$/, 'must be an uploaded image'),
  screenshotName: z.string().max(255).optional(),
  note: z.string().trim().max(1000).optional(),
});

reviewsRouter.post(
  '/coffee-treats',
  requireRole('student'),
  route(async (req, res) => {
    const student = currentUser(req);
    const body = parse(coffeeBody, req.body);
    const q = await loadVisibleQuery(student, body.ticketId);
    const cfg = coffeeConfig();
    if (!cfg.accountNumber) throw new HttpError(503, 'Coffee treats are not set up yet.');

    const [row] = await db
      .insert(t.coffeeTreats)
      .values({
        id: newId(),
        ticketId: q.id,
        ticketNumber: q.ticketNumber,
        ticketTitle: q.title,
        studentId: student.id,
        studentName: student.displayName,
        studentEmail: student.email,
        expertId: q.expertId,
        expertName: q.expertName,
        expertTitle: q.expertTitle,
        amount: cfg.amount,
        paymentMethod: body.paymentMethod || cfg.paymentMethod,
        accountNumber: cfg.accountNumber,
        accountTitle: cfg.accountTitle,
        screenshotUrl: body.screenshotUrl,
        screenshotName: body.screenshotName ?? null,
        note: body.note ?? null,
        status: 'submitted',
      })
      .returning();
    await notify(await superAdminIds(), {
      title: `☕ Coffee Treat for ${q.expertName}!`,
      message: `${student.displayName} sent a coffee treat for ticket #${q.ticketNumber}.`,
      type: 'coffee_treat',
      queryId: q.id,
    });
    res.status(201).json(serializeRow(row));
  })
);

reviewsRouter.get(
  '/admin/coffee-treats',
  requireRole('super_admin'),
  route(async (_req, res) => {
    const rows = await db.select().from(t.coffeeTreats).orderBy(desc(t.coffeeTreats.createdAt)).limit(500);
    res.json(rows.map((r) => serializeRow(r)));
  })
);

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

reviewsRouter.get(
  '/admin/audit-logs',
  requireRole('expert_admin', 'super_admin'),
  route(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    const rows = await db.select().from(t.auditLogs).orderBy(desc(t.auditLogs.timestamp)).limit(limit);
    res.json(rows.map((r) => serializeRow(r)));
  })
);
