// One-time import of the old Firestore data into PostgreSQL.
//
//   npm run import-firestore -- --service-account <key.json> --database <databaseId> [--dry-run] [--force]
//
// The key comes from Firebase console → Project settings → Service accounts →
// "Generate new private key". Keep it out of the repository and delete it after
// the import. (--project/--api-key also work if your rules allow unauthenticated
// reads; env: FIRESTORE_SERVICE_ACCOUNT / FIRESTORE_PROJECT_ID / FIRESTORE_DATABASE_ID / FIRESTORE_API_KEY.)
//
// Reads every collection through the Firestore REST API (no Firebase SDK), then:
// - users: merged with `credentials` so existing passwords keep working (legacy
//   PBKDF2 hashes are upgraded to scrypt on first sign-in); duplicate profiles of
//   the same email are folded into one account
// - base64 attachments, voice notes, covers and screenshots become uploaded files
// - category ↔ admin assignments from both sides are merged into category_admins
// - ticket numbers are kept (duplicates get a suffix) and the sequence continues after them
// - counselor rating totals are recomputed from rated tickets
//
// Refuses to run when the database already has users, unless --force (which
// deletes ALL existing rows first). --dry-run fetches and reports without writing.
import crypto from 'crypto';
import fs from 'fs';
import { sql } from 'drizzle-orm';
import { db, t, closeDb } from '../db';
import { storeBuffer } from '../uploads';

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const serviceAccountPath = arg('service-account') ?? process.env.FIRESTORE_SERVICE_ACCOUNT;
const serviceAccount = serviceAccountPath
  ? (JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')) as { project_id: string; client_email: string; private_key: string })
  : null;
const projectId = arg('project') ?? process.env.FIRESTORE_PROJECT_ID ?? serviceAccount?.project_id;
const databaseId = arg('database') ?? process.env.FIRESTORE_DATABASE_ID ?? '(default)';
const apiKey = arg('api-key') ?? process.env.FIRESTORE_API_KEY;
const dryRun = flag('dry-run');
const force = flag('force');

if (!projectId || (!serviceAccount && !apiKey)) {
  console.error(
    'Usage: npm run import-firestore -- --service-account <key.json> --database <databaseId> [--dry-run] [--force]'
  );
  process.exit(1);
}

/** OAuth access token for the service account (JWT bearer grant), read-only Datastore scope. */
async function serviceAccountToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: serviceAccount!.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(serviceAccount!.private_key).toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  });
  if (!res.ok) throw new Error(`Service account sign-in failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

const authHeaders: Record<string, string> = serviceAccount ? { Authorization: `Bearer ${await serviceAccountToken()}` } : {};

// ---------------------------------------------------------------------------
// Firestore REST reading
// ---------------------------------------------------------------------------

type FsValue = Record<string, unknown>;
type Doc = Record<string, any> & { id: string };

function decode(v: FsValue): unknown {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('timestampValue' in v) return new Date(String(v.timestampValue)).getTime();
  if ('stringValue' in v) return v.stringValue;
  if ('referenceValue' in v) return String(v.referenceValue).split('/').pop();
  if ('arrayValue' in v) return ((v.arrayValue as { values?: FsValue[] }).values ?? []).map(decode);
  if ('mapValue' in v) return decodeFields((v.mapValue as { fields?: Record<string, FsValue> }).fields ?? {});
  if ('geoPointValue' in v) return v.geoPointValue;
  if ('bytesValue' in v) return v.bytesValue;
  return null;
}

function decodeFields(fields: Record<string, FsValue>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decode(v);
  return out;
}

async function fetchCollection(name: string): Promise<Doc[]> {
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${encodeURIComponent(databaseId!)}/documents/${name}`;
  const docs: Doc[] = [];
  let pageToken = '';
  do {
    const qs = new URLSearchParams({ pageSize: '300' });
    if (!serviceAccount) qs.set('key', apiKey!);
    if (pageToken) qs.set('pageToken', pageToken);
    const res = await fetch(`${base}?${qs}`, { headers: authHeaders });
    if (!res.ok) throw new Error(`Reading ${name} failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { documents?: { name: string; fields?: Record<string, FsValue> }[]; nextPageToken?: string };
    for (const d of body.documents ?? []) docs.push({ ...decodeFields(d.fields ?? {}), id: d.name.split('/').pop()! });
    pageToken = body.nextPageToken ?? '';
  } while (pageToken);
  return docs;
}

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : v == null ? fallback : String(v));
const optStr = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const bool = (v: unknown) => v === true;
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function ms(v: unknown, fallback: number | null = Date.now()): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v < 1e11 ? v * 1000 : v;
  if (typeof v === 'string' && v) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n < 1e11 ? n * 1000 : n;
    const d = Date.parse(v);
    if (!Number.isNaN(d)) return d;
  }
  return fallback;
}
const msReq = (v: unknown) => ms(v, Date.now()) as number;

const ROLES = ['student', 'normal_admin', 'expert_admin', 'super_admin'] as const;
type Role = (typeof ROLES)[number];
const role = (v: unknown, fallback: Role = 'student'): Role => (ROLES.includes(v as Role) ? (v as Role) : fallback);
const QUERY_STATUSES = ['open', 'in_progress', 'replied', 'waiting_for_student', 'resolved'] as const;

let filesStored = 0;
const fileCache = new Map<string, string>();

/** Turns a data: URL into an uploaded file; other URLs pass through unchanged. */
async function materialize(url: unknown, name: string, ownerId: string | null): Promise<string | null> {
  if (typeof url !== 'string' || !url) return null;
  const m = url.match(/^data:([^;,]+)?(;[^,]*)?,([\s\S]*)$/);
  if (!m) return url;
  if (dryRun) return '/api/files/dry-run';
  const cached = fileCache.get(url);
  if (cached) return cached;
  const mime = m[1] || 'application/octet-stream';
  const isBase64 = (m[2] || '').includes('base64');
  const buffer = isBase64 ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]));
  const { url: stored } = await storeBuffer(buffer, mime, name, ownerId);
  fileCache.set(url, stored);
  filesStored++;
  return stored;
}

async function attachments(v: unknown, ownerId: string | null) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const [i, a] of v.entries()) {
    if (!a || typeof a !== 'object') continue;
    const item = a as Record<string, unknown>;
    const name = str(item.name, `attachment-${i + 1}`);
    const url = await materialize(item.url ?? item.dataUrl, name, ownerId);
    if (!url) continue;
    out.push({ id: str(item.id, `att-${i}`), name, size: int(item.size) ?? 0, type: str(item.type, 'application/octet-stream'), url });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

const [{ n: existingUsers }] = await db.select({ n: sql<number>`count(*)::int` }).from(t.users);
if (existingUsers > 0 && !force && !dryRun) {
  console.error(`The database already has ${existingUsers} users. Re-run with --force to wipe it and import again.`);
  process.exit(1);
}

console.log(`Reading Firestore project ${projectId}, database ${databaseId}…`);
const names = [
  'users', 'credentials', 'categories', 'queries', 'messages', 'notifications', 'savedAnswers',
  'articles', 'saved_articles', 'platform_reviews', 'coffee_treats', 'auditLogs', 'settings',
] as const;
const data = {} as Record<(typeof names)[number], Doc[]>;
for (const name of names) {
  data[name] = await fetchCollection(name).catch((err) => {
    console.warn(`  ${name}: ${err.message.split('\n')[0]} — skipped`);
    return [];
  });
  console.log(`  ${name}: ${data[name].length}`);
}

// --- users: one account per email, with the password from `credentials`
const credByEmail = new Map(data.credentials.filter((c) => c.email).map((c) => [str(c.email).trim().toLowerCase(), c]));
const usersByEmail = new Map<string, Doc[]>();
for (const u of data.users) {
  const email = str(u.email).trim().toLowerCase();
  if (!email) continue;
  usersByEmail.set(email, [...(usersByEmail.get(email) ?? []), u]);
}
// Credentials without any profile still become accounts.
for (const [email, c] of credByEmail) {
  if (!usersByEmail.has(email)) usersByEmail.set(email, [{ id: str(c.uid), email, displayName: c.displayName, role: c.role }]);
}

const idMap = new Map<string, string>(); // any old user id → canonical id
const userRows: (typeof t.users.$inferInsert)[] = [];
const userAssignedCats = new Map<string, string[]>();
let withoutPassword = 0;

for (const [email, profiles] of usersByEmail) {
  const cred = credByEmail.get(email);
  // Prefer the profile the credentials point at, then the most complete one.
  const canonical =
    profiles.find((p) => cred && p.id === cred.uid) ??
    [...profiles].sort((a, b) => Object.keys(b).length - Object.keys(a).length)[0];
  const merged = Object.assign({}, ...[...profiles].reverse().filter((p) => p !== canonical), canonical) as Doc;
  for (const p of profiles) idMap.set(p.id, canonical.id);
  if (cred?.uid) idMap.set(str(cred.uid), canonical.id);

  if (!cred?.passwordHash || !cred?.salt) withoutPassword++;
  userRows.push({
    id: canonical.id,
    email,
    passwordAlgo: 'pbkdf2_legacy',
    passwordHash: optStr(cred?.passwordHash),
    passwordSalt: optStr(cred?.salt),
    displayName: str(merged.displayName, email.split('@')[0]).slice(0, 120),
    role: role(merged.role ?? cred?.role),
    status: merged.status === 'deactivated' || merged.isDeactivated === true ? 'deactivated' : 'active',
    qualification: optStr(merged.qualification),
    qualificationDetail: optStr(merged.qualificationDetail),
    board: optStr(merged.board),
    phoneNumber: optStr(merged.phoneNumber ?? merged.phone),
    professionalTitle: optStr(merged.professionalTitle),
    shortDescription: optStr(merged.shortDescription ?? merged.bio),
    photoUrl: null, // set below (may be a data URL)
    lastActiveAt: ms(merged.lastActiveAt, null),
    lastReplyAt: ms(merged.lastReplyAt, null),
    createdAt: msReq(merged.createdAt),
    updatedAt: msReq(merged.updatedAt ?? merged.createdAt),
  });
  userAssignedCats.set(canonical.id, [...new Set(profiles.flatMap((p) => strArr(p.assignedCategories)))]);
  (userRows[userRows.length - 1] as { _photo?: unknown })._photo = merged.photoURL;
}
const userIds = new Set(userRows.map((u) => u.id));
const uid = (v: unknown): string | null => {
  const id = typeof v === 'string' ? idMap.get(v) ?? v : null;
  return id && userIds.has(id) ? id : null;
};
const adminIds = new Set(userRows.filter((u) => u.role !== 'student').map((u) => u.id));

// --- categories and assignments
const categoryIds = new Set(data.categories.map((c) => c.id));
const links = new Set<string>();
for (const c of data.categories) {
  for (const a of [...strArr(c.assignedAdminIds), ...strArr(c.assignedExpertIds)]) {
    const id = uid(a);
    if (id && adminIds.has(id)) links.add(`${c.id}|${id}`);
  }
}
for (const [adminId, cats] of userAssignedCats) {
  if (!adminIds.has(adminId)) continue;
  for (const c of cats) if (categoryIds.has(c)) links.add(`${c}|${adminId}`);
}

// --- tickets
const seenTicketNumbers = new Set<string>();
let maxTicketNumber = 100000;
function uniqueTicketNumber(raw: unknown, id: string): string {
  let n = str(raw) || `PT-${id.slice(0, 6).toUpperCase()}`;
  const digits = Number(n.replace(/\D/g, '').slice(0, 9));
  if (Number.isFinite(digits) && digits > maxTicketNumber) maxTicketNumber = digits;
  let i = 2;
  const base = n;
  while (seenTicketNumbers.has(n)) n = `${base}-${i++}`;
  seenTicketNumbers.add(n);
  return n;
}

console.log(dryRun ? '\nDry run — nothing will be written.' : '\nWriting to PostgreSQL…');

if (force && !dryRun) {
  await db.execute(sql`truncate users, sessions, categories, category_admins, queries, query_hidden_for, messages,
    saved_answers, notifications, audit_logs, articles, article_likes, saved_articles, platform_reviews,
    coffee_treats, files, settings restart identity cascade`);
}

async function insertAll<T extends { [k: string]: unknown }>(table: Parameters<typeof db.insert>[0], rows: T[], label: string) {
  if (!dryRun) for (let i = 0; i < rows.length; i += 500) await db.insert(table).values(rows.slice(i, i + 500) as never);
  console.log(`  ${label}: ${rows.length}`);
}

// Users go in first so uploaded avatars can reference their owner.
const photos = userRows.map((u) => {
  const photo = (u as { _photo?: unknown })._photo;
  delete (u as { _photo?: unknown })._photo;
  return photo;
});
await insertAll(t.users, userRows, 'users');
for (const [i, u] of userRows.entries()) {
  const photoUrl = await materialize(photos[i], 'avatar.jpg', u.id);
  if (photoUrl && !dryRun) await db.execute(sql`update users set photo_url = ${photoUrl} where id = ${u.id}`);
}

await insertAll(
  t.categories,
  data.categories.map((c) => {
    const primary = uid(c.primaryAdminId);
    const backup = uid(c.backupAdminId);
    return {
      id: c.id,
      name: str(c.name, c.id),
      description: str(c.description),
      icon: optStr(c.icon),
      color: optStr(c.color),
      subcategories: strArr(c.subcategories),
      primaryAdminId: primary && adminIds.has(primary) ? primary : null,
      backupAdminId: backup && adminIds.has(backup) ? backup : null,
      status: c.status === 'inactive' ? 'inactive' : 'active',
      createdAt: msReq(c.createdAt),
      updatedAt: msReq(c.updatedAt ?? c.createdAt),
    };
  }),
  'categories'
);
await insertAll(
  t.categoryAdmins,
  [...links].map((l) => {
    const [categoryId, adminId] = l.split('|');
    return { categoryId, adminId };
  }),
  'category assignments'
);

const queryRows = [];
const hiddenRows = [];
const ratingTotals = new Map<string, { count: number; sum: number }>();
for (const q of data.queries) {
  const studentId = uid(q.studentId);
  const expertRaw = q.expertId && q.expertId !== 'unassigned' ? q.expertId : q.assignedAdminId;
  const expertId = expertRaw && expertRaw !== 'unassigned' ? uid(expertRaw) : null;
  const rating = int(q.rating);
  if (rating && expertId) {
    const tot = ratingTotals.get(expertId) ?? { count: 0, sum: 0 };
    ratingTotals.set(expertId, { count: tot.count + 1, sum: tot.sum + rating });
  }
  for (const h of strArr(q.deletedForUsers)) {
    const hid = uid(h);
    if (hid) hiddenRows.push({ queryId: q.id, userId: hid });
  }
  queryRows.push({
    id: q.id,
    ticketNumber: uniqueTicketNumber(q.ticketNumber, q.id),
    studentId,
    studentName: str(q.studentName),
    studentEmail: str(q.studentEmail),
    studentPhone: optStr(q.studentPhone),
    studentQualification: str(q.studentQualification),
    studentBoard: optStr(q.studentBoard),
    studentAvatarUrl: await materialize(q.studentAvatarUrl, 'avatar.jpg', studentId),
    categoryId: categoryIds.has(str(q.categoryId)) ? str(q.categoryId) : null,
    categoryName: str(q.categoryName),
    expertId,
    expertEmail: optStr(q.expertEmail),
    expertName: str(q.expertName ?? q.assignedAdminName, expertId ? '' : 'General Expert Queue'),
    expertRole: str(q.expertRole),
    expertTitle: optStr(q.expertTitle),
    expertAvatarUrl: await materialize(q.expertAvatarUrl, 'avatar.jpg', expertId),
    title: str(q.title, 'Untitled query').slice(0, 500),
    detail: str(q.detail),
    audioUrl: await materialize(q.audioUrl, 'voice-note.webm', studentId),
    audioDuration: int(q.audioDuration),
    attachments: await attachments(q.attachments, studentId),
    status: (QUERY_STATUSES as readonly string[]).includes(q.status) ? q.status : 'open',
    assignmentStatus: ['assigned', 'unassigned', 'reassigned'].includes(q.assignmentStatus)
      ? q.assignmentStatus
      : expertId
        ? 'assigned'
        : 'unassigned',
    hasUnreadStudentReply: bool(q.hasUnreadStudentReply),
    hasUnreadAdminReply: bool(q.hasUnreadAdminReply),
    isInitialQueryReadByAdmin: bool(q.isInitialQueryReadByAdmin),
    lastReplyPreview: optStr(q.lastReplyPreview),
    lastReplyAt: ms(q.lastReplyAt, null),
    lastSenderRole: q.lastSenderRole ? role(q.lastSenderRole) : null,
    lastSenderName: optStr(q.lastSenderName),
    lastSenderId: optStr(q.lastSenderId),
    rating: rating && rating >= 1 && rating <= 5 ? rating : null,
    ratingFeedback: optStr(q.ratingFeedback),
    ratingTags: strArr(q.ratingTags),
    ratedAt: ms(q.ratedAt, null),
    reassignedToAdminId: optStr(q.reassignedToAdminId),
    reassignedToAdminName: optStr(q.reassignedToAdminName),
    reassignedFromAdminId: optStr(q.reassignedFromAdminId),
    reassignedFromAdminName: optStr(q.reassignedFromAdminName),
    reassignedInitialTicketId: optStr(q.reassignedInitialTicketId),
    createdAt: msReq(q.createdAt),
    updatedAt: msReq(q.updatedAt ?? q.lastReplyAt ?? q.createdAt),
  });
}
await insertAll(t.queries, queryRows, 'queries');
const dedupHidden = [...new Map(hiddenRows.map((h) => [`${h.queryId}|${h.userId}`, h])).values()];
await insertAll(t.queryHiddenFor, dedupHidden, 'hidden-for-me entries');

const queryIds = new Set(queryRows.map((q) => q.id));
const messageRows = [];
let orphanMessages = 0;
for (const m of data.messages) {
  if (!queryIds.has(str(m.queryId))) {
    orphanMessages++;
    continue;
  }
  const senderId = m.senderId === 'system' ? null : uid(m.senderId);
  messageRows.push({
    id: m.id,
    queryId: str(m.queryId),
    senderId,
    senderName: str(m.senderName),
    senderRole: role(m.senderRole, 'super_admin'),
    senderAvatarUrl: await materialize(m.senderAvatarUrl, 'avatar.jpg', senderId),
    content: str(m.content),
    audioUrl: await materialize(m.audioUrl, 'voice-note.webm', senderId),
    audioDuration: int(m.audioDuration),
    attachments: await attachments(m.attachments, senderId),
    isNewQueryHeader: bool(m.isNewQueryHeader),
    queryTitle: optStr(m.queryTitle),
    isSystemMessage: bool(m.isSystemMessage) || m.senderId === 'system',
    isRead: bool(m.isRead),
    createdAt: msReq(m.createdAt),
  });
}
await insertAll(t.messages, messageRows, `messages (${orphanMessages} without a ticket skipped)`);

await insertAll(
  t.notifications,
  data.notifications
    .filter((n) => uid(n.userId))
    .map((n) => ({
      id: n.id,
      userId: uid(n.userId)!,
      title: str(n.title, 'Notification'),
      message: str(n.message),
      type: str(n.type, 'query_update'),
      queryId: optStr(n.queryId),
      isRead: bool(n.isRead),
      createdAt: msReq(n.createdAt),
    })),
  'notifications'
);

await insertAll(
  t.savedAnswers,
  data.savedAnswers
    .filter((s) => uid(s.studentId))
    .map((s) => ({
      id: s.id,
      studentId: uid(s.studentId)!,
      queryId: optStr(s.queryId),
      messageId: optStr(s.messageId),
      queryTitle: str(s.queryTitle),
      categoryName: str(s.categoryName),
      expertName: str(s.expertName),
      questionText: str(s.questionText),
      answerText: str(s.answerText),
      savedAt: msReq(s.savedAt),
    })),
  'saved answers'
);

const { sanitizeArticleHtml } = await import('../routes/articles');
const articleRows = [];
const likeRows = [];
for (const a of data.articles) {
  articleRows.push({
    id: a.id,
    title: str(a.title, 'Untitled article'),
    description: str(a.description),
    coverImage: (await materialize(a.coverImage, 'cover.jpg', uid(a.authorId))) ?? '',
    content: sanitizeArticleHtml(str(a.content)),
    category: str(a.category),
    tags: strArr(a.tags),
    authorId: str(a.authorId, 'unknown'),
    authorName: str(a.authorName),
    authorRole: str(a.authorRole),
    authorPhotoUrl: await materialize(a.authorPhotoURL, 'avatar.jpg', uid(a.authorId)),
    authorProfessionalTitle: optStr(a.authorProfessionalTitle),
    authorQualification: optStr(a.authorQualification),
    authorBio: optStr(a.authorBio),
    readTimeMinutes: int(a.readTimeMinutes) ?? 1,
    viewsCount: int(a.viewsCount) ?? 0,
    createdAt: msReq(a.createdAt),
    updatedAt: msReq(a.updatedAt ?? a.createdAt),
  });
  for (const liker of new Set(strArr(a.likedBy).map((l) => uid(l)).filter(Boolean))) {
    likeRows.push({ articleId: a.id, userId: liker! });
  }
}
await insertAll(t.articles, articleRows, 'articles');
await insertAll(t.articleLikes, likeRows, 'article likes');

const articleIds = new Set(articleRows.map((a) => a.id));
const savedArticleRows = [
  ...new Map(
    data.saved_articles
      .filter((s) => uid(s.userId) && articleIds.has(str(s.articleId)))
      .map((s) => [`${s.articleId}|${uid(s.userId)}`, { articleId: str(s.articleId), userId: uid(s.userId)!, savedAt: msReq(s.savedAt) }])
  ).values(),
];
await insertAll(t.savedArticles, savedArticleRows, 'saved articles');

await insertAll(
  t.platformReviews,
  data.platform_reviews
    .filter((r) => int(r.rating))
    .map((r) => ({
      id: r.id,
      studentId: uid(r.studentId),
      studentName: str(r.studentName, 'Student'),
      studentEmail: optStr(r.studentEmail),
      studentQualification: str(r.studentQualification),
      studentBoard: optStr(r.studentBoard),
      studentAvatarUrl: optStr(r.studentAvatarUrl)?.startsWith('data:') ? null : optStr(r.studentAvatarUrl),
      rating: Math.min(5, Math.max(1, int(r.rating)!)),
      ratingFeedback: str(r.ratingFeedback),
      ratingTags: strArr(r.ratingTags),
      categoryName: optStr(r.categoryName),
      expertName: optStr(r.expertName),
      status: str(r.status, 'active'),
      createdAt: msReq(r.createdAt),
    })),
  'platform reviews'
);

const treatRows = [];
for (const c of data.coffee_treats) {
  treatRows.push({
    id: c.id,
    ticketId: optStr(c.ticketId),
    ticketNumber: optStr(c.ticketNumber),
    ticketTitle: optStr(c.ticketTitle),
    studentId: uid(c.studentId),
    studentName: str(c.studentName),
    studentEmail: optStr(c.studentEmail),
    expertId: uid(c.expertId),
    expertName: str(c.expertName),
    expertTitle: optStr(c.expertTitle),
    amount: int(c.amount) ?? 0,
    paymentMethod: str(c.paymentMethod),
    accountNumber: str(c.accountNumber),
    accountTitle: str(c.accountTitle),
    screenshotUrl: (await materialize(c.screenshotUrl, str(c.screenshotName, 'payment.jpg'), uid(c.studentId))) ?? '',
    screenshotName: optStr(c.screenshotName),
    note: optStr(c.note),
    status: str(c.status, 'submitted'),
    createdAt: msReq(c.createdAt),
  });
}
await insertAll(t.coffeeTreats, treatRows, 'coffee treats');

await insertAll(
  t.auditLogs,
  data.auditLogs.map((l) => ({
    id: l.id,
    actorId: optStr(l.actorId),
    actorName: str(l.actorName),
    actorRole: str(l.actorRole),
    action: str(l.action, 'unknown'),
    targetId: optStr(l.targetId),
    targetType: optStr(l.targetType),
    details: optStr(l.details),
    timestamp: msReq(l.timestamp),
  })),
  'audit logs'
);

const driveConfig = data.settings.find((s) => s.id === 'drive_config');
if (driveConfig && /^[A-Za-z0-9_-]{10,}$/.test(str(driveConfig.rootFolderId))) {
  const { id: _id, ...value } = driveConfig;
  await insertAll(t.settings, [{ key: 'drive_config', value }], 'settings (drive_config)');
}

if (!dryRun) {
  for (const [expertId, tot] of ratingTotals) {
    await db.execute(sql`update users set rating_count = ${tot.count}, rating_sum = ${tot.sum} where id = ${expertId}`);
  }
  await db.execute(sql`select setval('ticket_number_seq', ${maxTicketNumber + 1}, false)`);
}

console.log(`\nFiles extracted from base64: ${filesStored}`);
console.log(`Accounts without a password (an admin must set one): ${withoutPassword}`);
console.log(`Next ticket number: PT-${maxTicketNumber + 1}`);
console.log(dryRun ? 'Dry run finished.' : 'Import finished.');
await closeDb();
process.exit(0);
