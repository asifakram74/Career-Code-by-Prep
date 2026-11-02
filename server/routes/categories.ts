import { Router } from 'express';
import { and, count, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db, t } from '../db';
import { ADMIN_ROLES, currentUser, requireRole } from '../auth';
import { HttpError, parse, route } from '../http';
import { broadcastChange, refreshCategoryRooms } from '../realtime';
import { serializeCategories } from '../serialize';
import { audit } from '../audit';

export const categoriesRouter = Router();

// Public: the landing page and registration show active categories.
categoriesRouter.get(
  '/categories',
  route(async (req, res) => {
    const onlyActive = req.query.status === 'active' || !req.user;
    const rows = await db
      .select()
      .from(t.categories)
      .where(onlyActive ? eq(t.categories.status, 'active') : undefined)
      .orderBy(t.categories.name);
    res.json(await serializeCategories(rows));
  })
);

const categoryBody = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).default(''),
  icon: z.string().max(100).optional(),
  color: z.string().max(40).optional(),
  subcategories: z.array(z.string().trim().max(100)).max(50).default([]),
  assignedAdminIds: z.array(z.string().max(100)).max(100).default([]),
  primaryAdminId: z.string().max(100).optional(),
  backupAdminId: z.string().max(100).optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

async function saveCategory(id: string, body: z.infer<typeof categoryBody>, isNew: boolean) {
  const admins = body.assignedAdminIds.length
    ? await db
        .select({ id: t.users.id })
        .from(t.users)
        .where(and(inArray(t.users.id, body.assignedAdminIds), inArray(t.users.role, ADMIN_ROLES)))
    : [];
  const adminIds = admins.map((a) => a.id);
  const pick = (candidate?: string) => (candidate && adminIds.includes(candidate) ? candidate : null);
  const now = Date.now();
  const before = isNew
    ? []
    : (await db.select().from(t.categoryAdmins).where(eq(t.categoryAdmins.categoryId, id))).map((r) => r.adminId);

  const values = {
    name: body.name,
    description: body.description,
    icon: body.icon ?? null,
    color: body.color ?? null,
    subcategories: body.subcategories.filter(Boolean),
    primaryAdminId: pick(body.primaryAdminId) ?? adminIds[0] ?? null,
    backupAdminId: pick(body.backupAdminId),
    status: body.status,
    updatedAt: now,
  };

  await db.transaction(async (tx) => {
    if (isNew) await tx.insert(t.categories).values({ id, ...values, createdAt: now });
    else await tx.update(t.categories).set(values).where(eq(t.categories.id, id));
    await tx.delete(t.categoryAdmins).where(eq(t.categoryAdmins.categoryId, id));
    if (adminIds.length) await tx.insert(t.categoryAdmins).values(adminIds.map((adminId) => ({ categoryId: id, adminId })));
  });

  for (const adminId of new Set([...before, ...adminIds])) await refreshCategoryRooms(adminId);
  broadcastChange('categories');
  broadcastChange('users');
  const [row] = await db.select().from(t.categories).where(eq(t.categories.id, id));
  return (await serializeCategories([row]))[0];
}

categoriesRouter.post(
  '/admin/categories',
  requireRole('expert_admin', 'super_admin'),
  route(async (req, res) => {
    const body = parse(categoryBody, req.body);
    const id = `cat-${body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}-${Date.now().toString(36)}`;
    const category = await saveCategory(id, body, true);
    await audit(currentUser(req), 'category_created', { targetId: id, targetType: 'category', details: body.name });
    res.status(201).json(category);
  })
);

categoriesRouter.put(
  '/admin/categories/:id',
  requireRole('expert_admin', 'super_admin'),
  route(async (req, res) => {
    const id = String(req.params.id);
    const body = parse(categoryBody, req.body);
    const [existing] = await db.select({ id: t.categories.id }).from(t.categories).where(eq(t.categories.id, id));
    if (!existing) throw new HttpError(404, 'Category not found.');
    const category = await saveCategory(id, body, false);
    await audit(currentUser(req), 'category_updated', { targetId: id, targetType: 'category', details: body.name });
    res.json(category);
  })
);

categoriesRouter.delete(
  '/admin/categories/:id',
  requireRole('expert_admin', 'super_admin'),
  route(async (req, res) => {
    const id = String(req.params.id);
    const [{ n }] = await db.select({ n: count() }).from(t.queries).where(eq(t.queries.categoryId, id));
    if (n > 0) {
      throw new HttpError(409, `This category has ${n} queries. Set it to inactive instead of deleting it.`);
    }
    const admins = await db.select().from(t.categoryAdmins).where(eq(t.categoryAdmins.categoryId, id));
    const [deleted] = await db.delete(t.categories).where(eq(t.categories.id, id)).returning();
    if (!deleted) throw new HttpError(404, 'Category not found.');
    for (const a of admins) await refreshCategoryRooms(a.adminId);
    await audit(currentUser(req), 'category_deleted', { targetId: id, targetType: 'category', details: deleted.name });
    broadcastChange('categories');
    broadcastChange('users');
    res.json({ success: true });
  })
);
