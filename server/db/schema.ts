import { sql } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  pgSequence,
  text,
  integer,
  boolean,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
  customType,
} from 'drizzle-orm/pg-core';

// timestamptz in the database, millisecond epoch numbers in application code
// (the frontend types all use `number` timestamps, as Firestore did).
export const epochMs = customType<{ data: number; driverData: Date | string }>({
  dataType() {
    return 'timestamp with time zone';
  },
  toDriver(value) {
    return new Date(value);
  },
  fromDriver(value) {
    return new Date(value).getTime();
  },
});

const createdAt = () => epochMs('created_at').notNull().default(sql`now()`);
const updatedAt = () => epochMs('updated_at').notNull().default(sql`now()`);

export const userRole = pgEnum('user_role', ['student', 'normal_admin', 'expert_admin', 'super_admin']);
export const accountStatus = pgEnum('account_status', ['active', 'deactivated']);
export const queryStatus = pgEnum('query_status', [
  'open',
  'in_progress',
  'replied',
  'waiting_for_student',
  'resolved',
]);
export const assignmentStatus = pgEnum('assignment_status', ['assigned', 'unassigned', 'reassigned']);

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

// ---------------------------------------------------------------------------
// Users & auth
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    // 'scrypt' for new hashes; 'pbkdf2_legacy' for hashes migrated from Firestore,
    // which are upgraded to scrypt on the next successful login.
    passwordAlgo: text('password_algo').notNull().default('scrypt'),
    passwordHash: text('password_hash'),
    passwordSalt: text('password_salt'),
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    displayName: text('display_name').notNull(),
    role: userRole('role').notNull().default('student'),
    status: accountStatus('status').notNull().default('active'),
    qualification: text('qualification'),
    qualificationDetail: text('qualification_detail'),
    board: text('board'),
    phoneNumber: text('phone_number'),
    professionalTitle: text('professional_title'),
    shortDescription: text('short_description'),
    photoUrl: text('photo_url'),
    ratingCount: integer('rating_count').notNull().default(0),
    ratingSum: integer('rating_sum').notNull().default(0),
    isOnline: boolean('is_online').notNull().default(false),
    lastActiveAt: epochMs('last_active_at'),
    lastReplyAt: epochMs('last_reply_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('users_email_lower_idx').on(sql`lower(${t.email})`), index('users_role_idx').on(t.role)]
);

export const sessions = pgTable(
  'sessions',
  {
    // SHA-256 of the cookie token; the raw token is never stored.
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    expiresAt: epochMs('expires_at').notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)]
);

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  icon: text('icon'),
  color: text('color'),
  subcategories: text('subcategories').array().notNull().default(sql`'{}'::text[]`),
  primaryAdminId: text('primary_admin_id').references(() => users.id, { onDelete: 'set null' }),
  backupAdminId: text('backup_admin_id').references(() => users.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('active'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Replaces both `categories.assignedAdminIds` and `users.assignedCategories`,
// which Firestore kept in sync by hand.
export const categoryAdmins = pgTable(
  'category_admins',
  {
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    adminId: text('admin_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assignedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.categoryId, t.adminId] }), index('category_admins_admin_idx').on(t.adminId)]
);

// ---------------------------------------------------------------------------
// Queries (tickets) & messages
// ---------------------------------------------------------------------------

export const queries = pgTable(
  'queries',
  {
    id: text('id').primaryKey(),
    ticketNumber: text('ticket_number').notNull(),
    studentId: text('student_id').references(() => users.id, { onDelete: 'set null' }),
    // Snapshot of student/expert/category details at the time of the ticket, as
    // in Firestore; history keeps showing the original names after edits.
    studentName: text('student_name').notNull().default(''),
    studentEmail: text('student_email').notNull().default(''),
    studentPhone: text('student_phone'),
    studentQualification: text('student_qualification').notNull().default(''),
    studentBoard: text('student_board'),
    studentAvatarUrl: text('student_avatar_url'),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    categoryName: text('category_name').notNull().default(''),
    expertId: text('expert_id').references(() => users.id, { onDelete: 'set null' }),
    expertEmail: text('expert_email'),
    expertName: text('expert_name').notNull().default(''),
    expertRole: text('expert_role').notNull().default(''),
    expertTitle: text('expert_title'),
    expertAvatarUrl: text('expert_avatar_url'),
    title: text('title').notNull(),
    detail: text('detail').notNull().default(''),
    audioUrl: text('audio_url'),
    audioDuration: integer('audio_duration'),
    attachments: jsonb('attachments').$type<Attachment[]>().notNull().default([]),
    status: queryStatus('status').notNull().default('open'),
    assignmentStatus: assignmentStatus('assignment_status').notNull().default('assigned'),
    hasUnreadStudentReply: boolean('has_unread_student_reply').notNull().default(false),
    hasUnreadAdminReply: boolean('has_unread_admin_reply').notNull().default(false),
    isInitialQueryReadByAdmin: boolean('is_initial_query_read_by_admin').notNull().default(false),
    lastReplyPreview: text('last_reply_preview'),
    lastReplyAt: epochMs('last_reply_at'),
    lastSenderRole: userRole('last_sender_role'),
    lastSenderName: text('last_sender_name'),
    lastSenderId: text('last_sender_id'),
    rating: integer('rating'),
    ratingFeedback: text('rating_feedback'),
    ratingTags: text('rating_tags').array(),
    ratedAt: epochMs('rated_at'),
    reassignedToAdminId: text('reassigned_to_admin_id'),
    reassignedToAdminName: text('reassigned_to_admin_name'),
    reassignedFromAdminId: text('reassigned_from_admin_id'),
    reassignedFromAdminName: text('reassigned_from_admin_name'),
    reassignedInitialTicketId: text('reassigned_initial_ticket_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('queries_ticket_number_idx').on(t.ticketNumber),
    index('queries_student_idx').on(t.studentId, t.updatedAt),
    index('queries_expert_idx').on(t.expertId, t.updatedAt),
    index('queries_category_idx').on(t.categoryId),
    index('queries_status_idx').on(t.status),
  ]
);

// "Delete for me" (Firestore `deletedForUsers` array).
export const queryHiddenFor = pgTable(
  'query_hidden_for',
  {
    queryId: text('query_id')
      .notNull()
      .references(() => queries.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.queryId, t.userId] })]
);

export const messages = pgTable(
  'messages',
  {
    id: text('id').primaryKey(),
    queryId: text('query_id')
      .notNull()
      .references(() => queries.id, { onDelete: 'cascade' }),
    senderId: text('sender_id').references(() => users.id, { onDelete: 'set null' }),
    senderName: text('sender_name').notNull().default(''),
    senderRole: userRole('sender_role').notNull(),
    senderAvatarUrl: text('sender_avatar_url'),
    content: text('content').notNull().default(''),
    audioUrl: text('audio_url'),
    audioDuration: integer('audio_duration'),
    attachments: jsonb('attachments').$type<Attachment[]>().notNull().default([]),
    isNewQueryHeader: boolean('is_new_query_header').notNull().default(false),
    queryTitle: text('query_title'),
    isSystemMessage: boolean('is_system_message').notNull().default(false),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('messages_query_idx').on(t.queryId, t.createdAt)]
);

export const savedAnswers = pgTable(
  'saved_answers',
  {
    id: text('id').primaryKey(),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    queryId: text('query_id'),
    messageId: text('message_id'),
    queryTitle: text('query_title').notNull().default(''),
    categoryName: text('category_name').notNull().default(''),
    expertName: text('expert_name').notNull().default(''),
    questionText: text('question_text').notNull().default(''),
    answerText: text('answer_text').notNull().default(''),
    savedAt: epochMs('saved_at').notNull().default(sql`now()`),
  },
  (t) => [index('saved_answers_student_idx').on(t.studentId)]
);

// ---------------------------------------------------------------------------
// Notifications & audit
// ---------------------------------------------------------------------------

export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    message: text('message').notNull().default(''),
    type: text('type').notNull(),
    queryId: text('query_id'),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt)]
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id'),
    actorName: text('actor_name').notNull().default(''),
    actorRole: text('actor_role').notNull().default(''),
    action: text('action').notNull(),
    targetId: text('target_id'),
    targetType: text('target_type'),
    details: text('details'),
    timestamp: epochMs('timestamp').notNull().default(sql`now()`),
  },
  (t) => [index('audit_logs_timestamp_idx').on(t.timestamp)]
);

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

export const articles = pgTable(
  'articles',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    coverImage: text('cover_image').notNull().default(''),
    // Sanitized HTML (sanitized on write by the server).
    content: text('content').notNull().default(''),
    category: text('category').notNull().default(''),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    // Not a foreign key: starter articles reference authors that are not users.
    authorId: text('author_id').notNull(),
    authorName: text('author_name').notNull().default(''),
    authorRole: text('author_role').notNull().default(''),
    authorPhotoUrl: text('author_photo_url'),
    authorProfessionalTitle: text('author_professional_title'),
    authorQualification: text('author_qualification'),
    authorBio: text('author_bio'),
    readTimeMinutes: integer('read_time_minutes').notNull().default(1),
    viewsCount: integer('views_count').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('articles_created_idx').on(t.createdAt)]
);

export const articleLikes = pgTable(
  'article_likes',
  {
    articleId: text('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.userId] })]
);

export const savedArticles = pgTable(
  'saved_articles',
  {
    articleId: text('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    savedAt: epochMs('saved_at').notNull().default(sql`now()`),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.userId] })]
);

// ---------------------------------------------------------------------------
// Reviews & coffee treats
// ---------------------------------------------------------------------------

export const platformReviews = pgTable(
  'platform_reviews',
  {
    id: text('id').primaryKey(),
    studentId: text('student_id').references(() => users.id, { onDelete: 'set null' }),
    studentName: text('student_name').notNull(),
    studentEmail: text('student_email'),
    studentQualification: text('student_qualification').notNull().default(''),
    studentBoard: text('student_board'),
    studentAvatarUrl: text('student_avatar_url'),
    rating: integer('rating').notNull(),
    ratingFeedback: text('rating_feedback').notNull().default(''),
    ratingTags: text('rating_tags').array().notNull().default(sql`'{}'::text[]`),
    categoryName: text('category_name'),
    expertName: text('expert_name'),
    // 'pending' until a super admin approves it; only 'active' reviews are public.
    status: text('status').notNull().default('pending'),
    createdAt: createdAt(),
  },
  (t) => [index('platform_reviews_status_idx').on(t.status, t.createdAt)]
);

export const coffeeTreats = pgTable('coffee_treats', {
  id: text('id').primaryKey(),
  ticketId: text('ticket_id'),
  ticketNumber: text('ticket_number'),
  ticketTitle: text('ticket_title'),
  studentId: text('student_id').references(() => users.id, { onDelete: 'set null' }),
  studentName: text('student_name').notNull().default(''),
  studentEmail: text('student_email'),
  expertId: text('expert_id').references(() => users.id, { onDelete: 'set null' }),
  expertName: text('expert_name').notNull().default(''),
  expertTitle: text('expert_title'),
  amount: integer('amount').notNull(),
  paymentMethod: text('payment_method').notNull().default(''),
  accountNumber: text('account_number').notNull().default(''),
  accountTitle: text('account_title').notNull().default(''),
  screenshotUrl: text('screenshot_url').notNull().default(''),
  screenshotName: text('screenshot_name'),
  note: text('note'),
  status: text('status').notNull().default('submitted'),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Uploaded files & settings
// ---------------------------------------------------------------------------

// Files previously stored as base64 inside Firestore documents now live on disk
// (UPLOAD_DIR); this table records who uploaded them and what they are.
export const files = pgTable('files', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  storagePath: text('storage_path').notNull(),
  createdAt: createdAt(),
});

// Key/value app settings (e.g. `drive_config`).
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: updatedAt(),
});

// Monotonic ticket numbers instead of Math.random().
export const ticketNumberSeq = pgSequence('ticket_number_seq', { startWith: 100001 });
