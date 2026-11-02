import { Router } from 'express';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import { db, t } from '../db';
import { currentUser, isManager, requireAuth, requireRole } from '../auth';
import { HttpError, newId, parse, route } from '../http';
import { broadcastChange, emitToUser } from '../realtime';
import { serializeArticle } from '../serialize';

export const articlesRouter = Router();

// Article bodies come from a rich-text editor and are rendered as HTML, so they
// are sanitized on every write. Only formatting the editor produces survives.
export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'p', 'br', 'hr', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'mark',
      'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'span', 'div', 'code', 'pre', 'sub', 'sup', 'font',
    ],
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      font: ['color'],
      '*': ['class', 'style'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowedStyles: {
      '*': {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^[a-z]+$/i],
        'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^[a-z]+$/i],
        'text-align': [/^(left|right|center|justify)$/],
        'font-weight': [/^(bold|normal|\d{3})$/],
        'font-style': [/^(italic|normal)$/],
        'text-decoration': [/^[a-z\s-]+$/],
      },
    },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer nofollow' },
      }),
    },
  });
}

const coverImage = z
  .string()
  .max(2000)
  .regex(/^(\/api\/files\/[0-9a-f-]{36}|https:\/\/\S+)$/, 'must be an uploaded image or https URL');

const articleBody = z.object({
  title: z.string().trim().min(3).max(300),
  description: z.string().trim().max(1000).default(''),
  coverImage,
  category: z.string().trim().max(150).default(''),
  tags: z.array(z.string().trim().max(60)).max(20).default([]),
  content: z.string().max(500_000),
  readTimeMinutes: z.number().int().min(1).max(240).optional(),
});

const estimateReadTime = (html: string) =>
  Math.max(1, Math.round(sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).split(/\s+/).length / 200));

async function likesFor(articleIds: string[]) {
  const map = new Map<string, string[]>();
  if (!articleIds.length) return map;
  const rows = await db.select().from(t.articleLikes).where(inArray(t.articleLikes.articleId, articleIds));
  for (const r of rows) map.set(r.articleId, [...(map.get(r.articleId) ?? []), r.userId]);
  return map;
}

async function loadArticle(id: string) {
  const [a] = await db.select().from(t.articles).where(eq(t.articles.id, id)).limit(1);
  if (!a) throw new HttpError(404, 'Article not found.');
  return a;
}

async function serializeOne(id: string) {
  const a = await loadArticle(id);
  return serializeArticle(a, (await likesFor([id])).get(id) ?? []);
}

articlesRouter.get(
  '/articles',
  route(async (_req, res) => {
    const rows = await db.select().from(t.articles).orderBy(desc(t.articles.createdAt));
    const likes = await likesFor(rows.map((r) => r.id));
    res.json(rows.map((a) => serializeArticle(a, likes.get(a.id) ?? [])));
  })
);

articlesRouter.get(
  '/articles/:id',
  route(async (req, res) => {
    res.json(await serializeOne(String(req.params.id)));
  })
);

articlesRouter.post(
  '/articles',
  requireRole('normal_admin', 'expert_admin', 'super_admin'),
  route(async (req, res) => {
    const author = currentUser(req);
    const body = parse(articleBody, req.body);
    const content = sanitizeArticleHtml(body.content);
    const now = Date.now();
    const id = newId();
    await db.insert(t.articles).values({
      id,
      ...body,
      content,
      readTimeMinutes: body.readTimeMinutes ?? estimateReadTime(content),
      authorId: author.id,
      authorName: author.displayName,
      authorRole: author.role,
      authorPhotoUrl: author.photoUrl,
      authorProfessionalTitle: author.professionalTitle,
      authorQualification: author.qualification,
      authorBio: author.shortDescription,
      createdAt: now,
      updatedAt: now,
    });
    broadcastChange('articles');
    res.status(201).json(await serializeOne(id));
  })
);

async function loadEditable(req: Parameters<Parameters<typeof route>[0]>[0]) {
  const user = currentUser(req);
  const article = await loadArticle(String(req.params.id));
  if (article.authorId !== user.id && !isManager(user.role)) {
    throw new HttpError(403, 'You can only edit your own articles.');
  }
  return article;
}

articlesRouter.patch(
  '/articles/:id',
  requireRole('normal_admin', 'expert_admin', 'super_admin'),
  route(async (req, res) => {
    const article = await loadEditable(req);
    const body = parse(articleBody.partial(), req.body);
    const content = body.content === undefined ? undefined : sanitizeArticleHtml(body.content);
    await db
      .update(t.articles)
      .set({
        ...body,
        content,
        readTimeMinutes: body.readTimeMinutes ?? (content ? estimateReadTime(content) : undefined),
        updatedAt: Date.now(),
      })
      .where(eq(t.articles.id, article.id));
    broadcastChange('articles');
    res.json(await serializeOne(article.id));
  })
);

articlesRouter.delete(
  '/articles/:id',
  requireRole('normal_admin', 'expert_admin', 'super_admin'),
  route(async (req, res) => {
    const article = await loadEditable(req);
    await db.delete(t.articles).where(eq(t.articles.id, article.id));
    broadcastChange('articles');
    res.json({ success: true });
  })
);

articlesRouter.post(
  '/articles/:id/like',
  requireAuth,
  route(async (req, res) => {
    const user = currentUser(req);
    const { liked } = parse(z.object({ liked: z.boolean() }), req.body);
    const article = await loadArticle(String(req.params.id));
    if (liked) {
      await db.insert(t.articleLikes).values({ articleId: article.id, userId: user.id }).onConflictDoNothing();
    } else {
      await db
        .delete(t.articleLikes)
        .where(and(eq(t.articleLikes.articleId, article.id), eq(t.articleLikes.userId, user.id)));
    }
    const likedBy = (await likesFor([article.id])).get(article.id) ?? [];
    broadcastChange('articles');
    res.json({ likesCount: likedBy.length, likedBy });
  })
);

// Counts at most one view per viewer per article per hour.
const recentViews = new Map<string, number>();

articlesRouter.post(
  '/articles/:id/view',
  route(async (req, res) => {
    const article = await loadArticle(String(req.params.id));
    const key = `${req.user?.id ?? req.ip}|${article.id}`;
    const last = recentViews.get(key) ?? 0;
    if (Date.now() - last < 60 * 60 * 1000) return res.json({ viewsCount: article.viewsCount });
    recentViews.set(key, Date.now());
    const [row] = await db
      .update(t.articles)
      .set({ viewsCount: sql`${t.articles.viewsCount} + 1` })
      .where(eq(t.articles.id, article.id))
      .returning({ viewsCount: t.articles.viewsCount });
    res.json({ viewsCount: row.viewsCount });
  })
);

// ---------------------------------------------------------------------------
// Saved (bookmarked) articles
// ---------------------------------------------------------------------------

articlesRouter.get(
  '/saved-articles',
  requireAuth,
  route(async (req, res) => {
    const rows = await db
      .select({ id: t.savedArticles.articleId })
      .from(t.savedArticles)
      .where(eq(t.savedArticles.userId, currentUser(req).id))
      .orderBy(desc(t.savedArticles.savedAt));
    res.json(rows.map((r) => r.id));
  })
);

articlesRouter.put(
  '/saved-articles/:articleId',
  requireAuth,
  route(async (req, res) => {
    const user = currentUser(req);
    const article = await loadArticle(String(req.params.articleId));
    await db.insert(t.savedArticles).values({ articleId: article.id, userId: user.id }).onConflictDoNothing();
    emitToUser(user.id, 'data:changed', { resource: 'saved-articles' });
    res.json({ success: true });
  })
);

articlesRouter.delete(
  '/saved-articles/:articleId',
  requireAuth,
  route(async (req, res) => {
    const user = currentUser(req);
    await db
      .delete(t.savedArticles)
      .where(and(eq(t.savedArticles.articleId, String(req.params.articleId)), eq(t.savedArticles.userId, user.id)));
    emitToUser(user.id, 'data:changed', { resource: 'saved-articles' });
    res.json({ success: true });
  })
);
