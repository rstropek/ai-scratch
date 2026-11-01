// The pool of donated Anthropic access: the admin maintains it in the office, the kids' app draws on it. An entry is
// a key, stored sealed (key-box.ts), or a federation (docs/anthropic-federation.md): no key, only the IDs of the
// donor's federation rule, none of them secret. Everything else is plain.
import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth.ts';

export const anthropicKeyKind = pgEnum('anthropic_key_kind', ['key', 'federation']);

export const anthropicKey = pgTable(
  'anthropic_key',
  {
    id: uuid('id').primaryKey(),
    kind: anthropicKeyKind('kind').default('key').notNull(),
    /** who donated the credits behind the entry ("Rainer", "CoderDojo Linz") */
    donor: text('donor').notNull(),
    /** a key: the key, sealed with the row's id (key-box.ts) */
    keySealed: text('key_sealed'),
    /** a key: its keyed hash, so the same key can't be added twice */
    keyFingerprint: text('key_fingerprint'),
    /** a key: its last characters, so the admin can tell keys apart */
    keyHint: text('key_hint'),
    /** a federation: the donor's Anthropic organisation (a UUID) */
    organizationId: text('organization_id'),
    /** a federation: the rule that trusts our Azure identity (`fdrl_…`) */
    federationRuleId: text('federation_rule_id'),
    /** a federation: the service account the calls run as (`svac_…`); empty when the rule names one itself */
    serviceAccountId: text('service_account_id'),
    /**
     * a key: sent as `anthropic-workspace-id`; only keys that aren't bound to a workspace need it (personal and
     * service account keys). A federation: the workspace the token is minted for; empty lets Anthropic pick the
     * rule's only workspace
     */
    workspaceId: text('workspace_id'),
    /** the most the pool spends through this entry per calendar month (Vienna time), in whole dollars */
    capMonth: integer('cap_month').notNull(),
    /** higher first: entries are used up one after another, not in rotation */
    priority: integer('priority').default(0).notNull(),
    /** paused entries are never used */
    active: boolean('active').default(true).notNull(),
    /** when Anthropic last refused the entry (billing, spend limit, invalid key): the kids' app skips it then */
    refusedAt: timestamp('refused_at', { withTimezone: true }),
    /** Anthropic's message, for the admin */
    refusedReason: text('refused_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
  },
  (table) => [
    uniqueIndex('anthropic_key_fingerprint_idx').on(table.keyFingerprint),
    // the same rule twice for the same workspace (or both without one) would only count its spending twice
    uniqueIndex('anthropic_key_federation_idx')
      .on(table.federationRuleId, sql`coalesce(${table.workspaceId}, '')`)
      .where(sql`${table.kind} = 'federation'`),
    check(
      'anthropic_key_kind_columns',
      sql`(${table.kind} = 'key' AND ${table.keySealed} IS NOT NULL AND ${table.keyFingerprint} IS NOT NULL
          AND ${table.keyHint} IS NOT NULL AND ${table.organizationId} IS NULL AND ${table.federationRuleId} IS NULL
          AND ${table.serviceAccountId} IS NULL)
        OR (${table.kind} = 'federation' AND ${table.keySealed} IS NULL AND ${table.keyFingerprint} IS NULL
          AND ${table.keyHint} IS NULL AND ${table.organizationId} IS NOT NULL
          AND ${table.federationRuleId} IS NOT NULL)`,
    ),
  ],
);
