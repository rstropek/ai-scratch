CREATE TYPE "public"."access_code_source" AS ENUM('free', 'openrouter');--> statement-breakpoint
CREATE TABLE "access_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"owner_id" text NOT NULL,
	"source" "access_code_source" NOT NULL,
	"openrouter_key_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"ask_enabled" boolean DEFAULT true NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_code_source_key" CHECK (("access_code"."source" = 'openrouter') = ("access_code"."openrouter_key_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "budget_warning" (
	"budget" text NOT NULL,
	"month" text NOT NULL,
	"limit_usd" double precision NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_warning_budget_month_limit_usd_pk" PRIMARY KEY("budget","month","limit_usd")
);
--> statement-breakpoint
CREATE TABLE "model_price" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"input" double precision NOT NULL,
	"output" double precision NOT NULL,
	"cache_write" double precision NOT NULL,
	"cache_read" double precision NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "model_price_one_row" CHECK ("model_price"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "openrouter_key" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"label" text NOT NULL,
	"key_sealed" text NOT NULL,
	"key_fingerprint" text NOT NULL,
	"key_hint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"code_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"source" "access_code_source" NOT NULL,
	"pool_key_id" uuid,
	"openrouter_key_id" uuid,
	"month" text NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	"input_tokens" bigint DEFAULT 0 NOT NULL,
	"output_tokens" bigint DEFAULT 0 NOT NULL,
	"cache_write_tokens" bigint DEFAULT 0 NOT NULL,
	"cache_read_tokens" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_code_month_entry" UNIQUE NULLS NOT DISTINCT("code_id","month","pool_key_id")
);
--> statement-breakpoint
ALTER TABLE "anthropic_key" RENAME COLUMN "cap_eur_month" TO "cap_month";--> statement-breakpoint
ALTER TABLE "anthropic_key" ADD COLUMN "refused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "anthropic_key" ADD COLUMN "refused_reason" text;--> statement-breakpoint
ALTER TABLE "access_code" ADD CONSTRAINT "access_code_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_code" ADD CONSTRAINT "access_code_openrouter_key_id_openrouter_key_id_fk" FOREIGN KEY ("openrouter_key_id") REFERENCES "public"."openrouter_key"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_price" ADD CONSTRAINT "model_price_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "openrouter_key" ADD CONSTRAINT "openrouter_key_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_code_code_idx" ON "access_code" USING btree ("code");--> statement-breakpoint
CREATE INDEX "access_code_owner_idx" ON "access_code" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "access_code_ends_idx" ON "access_code" USING btree ("ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "openrouter_key_owner_fingerprint_idx" ON "openrouter_key" USING btree ("owner_id","key_fingerprint");--> statement-breakpoint
CREATE INDEX "usage_month_idx" ON "usage" USING btree ("month");