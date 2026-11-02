// Seeds a fresh database with the official categories and the starter articles.
// Skips anything that already exists, so it is safe to run more than once.
// Not needed after `npm run import-firestore`, which brings the real data.
//
//   npm run seed
import { inArray, sql } from 'drizzle-orm';
import { db, t, closeDb } from '../db';
import { newId } from '../http';
import { OFFICIAL_23_CATEGORIES } from '../../src/constants/officialCategories';
import { STARTER_ARTICLES } from '../seed/starterArticles';
import { sanitizeArticleHtml } from '../routes/articles';

const existingCats = new Set(
  (await db.select({ id: t.categories.id }).from(t.categories)).map((c) => c.id)
);
const newCats = OFFICIAL_23_CATEGORIES.filter((c) => !existingCats.has(c.id));
if (newCats.length) {
  await db.insert(t.categories).values(
    newCats.map((c) => ({ id: c.id, name: c.name, description: c.description, status: 'active' }))
  );
}

// Assign the listed counselors only where those accounts exist.
const adminIds = new Set(
  (
    await db
      .select({ id: t.users.id })
      .from(t.users)
      .where(inArray(t.users.id, [...new Set(OFFICIAL_23_CATEGORIES.flatMap((c) => c.assignedAdminIds))]))
  ).map((u) => u.id)
);
const links = newCats.flatMap((c) =>
  c.assignedAdminIds.filter((id) => adminIds.has(id)).map((adminId) => ({ categoryId: c.id, adminId }))
);
if (links.length) await db.insert(t.categoryAdmins).values(links).onConflictDoNothing();
console.log(`Categories: ${newCats.length} added, ${existingCats.size} already present, ${links.length} assignments.`);

const [{ n: articleCount }] = await db.select({ n: sql<number>`count(*)::int` }).from(t.articles);
if (articleCount === 0) {
  await db.insert(t.articles).values(
    STARTER_ARTICLES.map((a) => ({
      id: newId(),
      title: a.title,
      description: a.description,
      coverImage: a.coverImage,
      content: sanitizeArticleHtml(a.content),
      category: a.category,
      tags: a.tags ?? [],
      authorId: a.authorId,
      authorName: a.authorName,
      authorRole: a.authorRole,
      authorPhotoUrl: a.authorPhotoURL ?? null,
      authorProfessionalTitle: a.authorProfessionalTitle ?? null,
      authorQualification: a.authorQualification ?? null,
      authorBio: a.authorBio ?? null,
      readTimeMinutes: a.readTimeMinutes,
      viewsCount: a.viewsCount ?? 0,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }))
  );
  console.log(`Articles: ${STARTER_ARTICLES.length} starter articles added.`);
} else {
  console.log(`Articles: ${articleCount} already present, none added.`);
}

await closeDb();
process.exit(0);
