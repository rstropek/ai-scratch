CREATE TABLE "anthropic_key" (
	"id" uuid PRIMARY KEY NOT NULL,
	"donor" text NOT NULL,
	"key_sealed" text NOT NULL,
	"key_fingerprint" text NOT NULL,
	"key_hint" text NOT NULL,
	"workspace_id" text,
	"cap_eur_month" integer NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "anthropic_key" ADD CONSTRAINT "anthropic_key_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anthropic_key" ADD CONSTRAINT "anthropic_key_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "anthropic_key_fingerprint_idx" ON "anthropic_key" USING btree ("key_fingerprint");