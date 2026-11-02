CREATE TYPE "public"."account_status" AS ENUM('active', 'deactivated');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('assigned', 'unassigned', 'reassigned');--> statement-breakpoint
CREATE TYPE "public"."query_status" AS ENUM('open', 'in_progress', 'replied', 'waiting_for_student', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'normal_admin', 'expert_admin', 'super_admin');--> statement-breakpoint
CREATE SEQUENCE "public"."ticket_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 100001 CACHE 1;--> statement-breakpoint
CREATE TABLE "article_likes" (
	"article_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_likes_article_id_user_id_pk" PRIMARY KEY("article_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cover_image" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"author_id" text NOT NULL,
	"author_name" text DEFAULT '' NOT NULL,
	"author_role" text DEFAULT '' NOT NULL,
	"author_photo_url" text,
	"author_professional_title" text,
	"author_qualification" text,
	"author_bio" text,
	"read_time_minutes" integer DEFAULT 1 NOT NULL,
	"views_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_name" text DEFAULT '' NOT NULL,
	"actor_role" text DEFAULT '' NOT NULL,
	"action" text NOT NULL,
	"target_id" text,
	"target_type" text,
	"details" text,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text,
	"color" text,
	"subcategories" text[] DEFAULT '{}'::text[] NOT NULL,
	"primary_admin_id" text,
	"backup_admin_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_admins" (
	"category_id" text NOT NULL,
	"admin_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_admins_category_id_admin_id_pk" PRIMARY KEY("category_id","admin_id")
);
--> statement-breakpoint
CREATE TABLE "coffee_treats" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text,
	"ticket_number" text,
	"ticket_title" text,
	"student_id" text,
	"student_name" text DEFAULT '' NOT NULL,
	"student_email" text,
	"expert_id" text,
	"expert_name" text DEFAULT '' NOT NULL,
	"expert_title" text,
	"amount" integer NOT NULL,
	"payment_method" text DEFAULT '' NOT NULL,
	"account_number" text DEFAULT '' NOT NULL,
	"account_title" text DEFAULT '' NOT NULL,
	"screenshot_url" text DEFAULT '' NOT NULL,
	"screenshot_name" text,
	"note" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"query_id" text NOT NULL,
	"sender_id" text,
	"sender_name" text DEFAULT '' NOT NULL,
	"sender_role" "user_role" NOT NULL,
	"sender_avatar_url" text,
	"content" text DEFAULT '' NOT NULL,
	"audio_url" text,
	"audio_duration" integer,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_new_query_header" boolean DEFAULT false NOT NULL,
	"query_title" text,
	"is_system_message" boolean DEFAULT false NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"type" text NOT NULL,
	"query_id" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text,
	"student_name" text NOT NULL,
	"student_email" text,
	"student_qualification" text DEFAULT '' NOT NULL,
	"student_board" text,
	"student_avatar_url" text,
	"rating" integer NOT NULL,
	"rating_feedback" text DEFAULT '' NOT NULL,
	"rating_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"category_name" text,
	"expert_name" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queries" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_number" text NOT NULL,
	"student_id" text,
	"student_name" text DEFAULT '' NOT NULL,
	"student_email" text DEFAULT '' NOT NULL,
	"student_phone" text,
	"student_qualification" text DEFAULT '' NOT NULL,
	"student_board" text,
	"student_avatar_url" text,
	"category_id" text,
	"category_name" text DEFAULT '' NOT NULL,
	"expert_id" text,
	"expert_email" text,
	"expert_name" text DEFAULT '' NOT NULL,
	"expert_role" text DEFAULT '' NOT NULL,
	"expert_title" text,
	"expert_avatar_url" text,
	"title" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"audio_url" text,
	"audio_duration" integer,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "query_status" DEFAULT 'open' NOT NULL,
	"assignment_status" "assignment_status" DEFAULT 'assigned' NOT NULL,
	"has_unread_student_reply" boolean DEFAULT false NOT NULL,
	"has_unread_admin_reply" boolean DEFAULT false NOT NULL,
	"is_initial_query_read_by_admin" boolean DEFAULT false NOT NULL,
	"last_reply_preview" text,
	"last_reply_at" timestamp with time zone,
	"last_sender_role" "user_role",
	"last_sender_name" text,
	"last_sender_id" text,
	"rating" integer,
	"rating_feedback" text,
	"rating_tags" text[],
	"rated_at" timestamp with time zone,
	"reassigned_to_admin_id" text,
	"reassigned_to_admin_name" text,
	"reassigned_from_admin_id" text,
	"reassigned_from_admin_name" text,
	"reassigned_initial_ticket_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "query_hidden_for" (
	"query_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "query_hidden_for_query_id_user_id_pk" PRIMARY KEY("query_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "saved_answers" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"query_id" text,
	"message_id" text,
	"query_title" text DEFAULT '' NOT NULL,
	"category_name" text DEFAULT '' NOT NULL,
	"expert_name" text DEFAULT '' NOT NULL,
	"question_text" text DEFAULT '' NOT NULL,
	"answer_text" text DEFAULT '' NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_articles" (
	"article_id" text NOT NULL,
	"user_id" text NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_articles_article_id_user_id_pk" PRIMARY KEY("article_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_algo" text DEFAULT 'scrypt' NOT NULL,
	"password_hash" text,
	"password_salt" text,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"display_name" text NOT NULL,
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"qualification" text,
	"qualification_detail" text,
	"board" text,
	"phone_number" text,
	"professional_title" text,
	"short_description" text,
	"photo_url" text,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"rating_sum" integer DEFAULT 0 NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"last_active_at" timestamp with time zone,
	"last_reply_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "article_likes" ADD CONSTRAINT "article_likes_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_likes" ADD CONSTRAINT "article_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_primary_admin_id_users_id_fk" FOREIGN KEY ("primary_admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_backup_admin_id_users_id_fk" FOREIGN KEY ("backup_admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_admins" ADD CONSTRAINT "category_admins_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_admins" ADD CONSTRAINT "category_admins_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coffee_treats" ADD CONSTRAINT "coffee_treats_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coffee_treats" ADD CONSTRAINT "coffee_treats_expert_id_users_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_query_id_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_reviews" ADD CONSTRAINT "platform_reviews_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queries" ADD CONSTRAINT "queries_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queries" ADD CONSTRAINT "queries_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queries" ADD CONSTRAINT "queries_expert_id_users_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_hidden_for" ADD CONSTRAINT "query_hidden_for_query_id_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_hidden_for" ADD CONSTRAINT "query_hidden_for_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_answers" ADD CONSTRAINT "saved_answers_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_articles" ADD CONSTRAINT "saved_articles_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_articles" ADD CONSTRAINT "saved_articles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articles_created_idx" ON "articles" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "category_admins_admin_idx" ON "category_admins" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "messages_query_idx" ON "messages" USING btree ("query_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "platform_reviews_status_idx" ON "platform_reviews" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "queries_ticket_number_idx" ON "queries" USING btree ("ticket_number");--> statement-breakpoint
CREATE INDEX "queries_student_idx" ON "queries" USING btree ("student_id","updated_at");--> statement-breakpoint
CREATE INDEX "queries_expert_idx" ON "queries" USING btree ("expert_id","updated_at");--> statement-breakpoint
CREATE INDEX "queries_category_idx" ON "queries" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "queries_status_idx" ON "queries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "saved_answers_student_idx" ON "saved_answers" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");