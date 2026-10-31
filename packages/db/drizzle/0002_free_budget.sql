ALTER TABLE "adult_profile" ADD COLUMN "free_budget_requested" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "adult_profile" ADD COLUMN "free_budget_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "adult_profile" ADD COLUMN "free_budget_by" text;--> statement-breakpoint
ALTER TABLE "adult_profile" ADD CONSTRAINT "adult_profile_free_budget_by_user_id_fk" FOREIGN KEY ("free_budget_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;