CREATE TYPE "public"."anthropic_key_kind" AS ENUM('key', 'federation');--> statement-breakpoint
ALTER TABLE "anthropic_key" ALTER COLUMN "key_sealed" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "anthropic_key" ALTER COLUMN "key_fingerprint" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "anthropic_key" ALTER COLUMN "key_hint" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "anthropic_key" ADD COLUMN "kind" "anthropic_key_kind" DEFAULT 'key' NOT NULL;--> statement-breakpoint
ALTER TABLE "anthropic_key" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "anthropic_key" ADD COLUMN "federation_rule_id" text;--> statement-breakpoint
ALTER TABLE "anthropic_key" ADD COLUMN "service_account_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "anthropic_key_federation_idx" ON "anthropic_key" USING btree ("federation_rule_id",coalesce("workspace_id", '')) WHERE "anthropic_key"."kind" = 'federation';--> statement-breakpoint
ALTER TABLE "anthropic_key" ADD CONSTRAINT "anthropic_key_kind_columns" CHECK (("anthropic_key"."kind" = 'key' AND "anthropic_key"."key_sealed" IS NOT NULL AND "anthropic_key"."key_fingerprint" IS NOT NULL
          AND "anthropic_key"."key_hint" IS NOT NULL AND "anthropic_key"."organization_id" IS NULL AND "anthropic_key"."federation_rule_id" IS NULL
          AND "anthropic_key"."service_account_id" IS NULL)
        OR ("anthropic_key"."kind" = 'federation' AND "anthropic_key"."key_sealed" IS NULL AND "anthropic_key"."key_fingerprint" IS NULL
          AND "anthropic_key"."key_hint" IS NULL AND "anthropic_key"."organization_id" IS NOT NULL
          AND "anthropic_key"."federation_rule_id" IS NOT NULL));