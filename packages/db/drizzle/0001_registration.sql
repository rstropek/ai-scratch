CREATE TYPE "public"."adult_kind" AS ENUM('parent', 'teacher');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "adult_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"kind" "adult_kind" NOT NULL,
	"terms_version" text NOT NULL,
	"terms_accepted_at" timestamp with time zone NOT NULL,
	"ai_consent_at" timestamp with time zone NOT NULL,
	"adult_confirmed_at" timestamp with time zone NOT NULL,
	"jev_checks" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registration_attempt" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip_hash" text NOT NULL,
	"email_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"school_name" text NOT NULL,
	"school_url" text NOT NULL,
	"grades" text[] NOT NULL,
	"summary" text NOT NULL,
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"jev" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" text,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "adult_profile" ADD CONSTRAINT "adult_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_application" ADD CONSTRAINT "teacher_application_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_application" ADD CONSTRAINT "teacher_application_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "registration_attempt_ip_idx" ON "registration_attempt" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "registration_attempt_email_idx" ON "registration_attempt" USING btree ("email_hash","created_at");--> statement-breakpoint
CREATE INDEX "teacher_application_user_idx" ON "teacher_application" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_application_one_pending_idx" ON "teacher_application" USING btree ("user_id") WHERE "teacher_application"."status" = 'pending';