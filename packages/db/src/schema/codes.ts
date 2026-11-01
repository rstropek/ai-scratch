// Access codes and what they spend (docs/budgets.md): the adults' own OpenRouter keys, the codes they create from
// the free budget or such a key, the usage of every call, the model's price, and the 80 % warnings already sent.
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth.ts';

/** where a code's AI calls are paid from: the donated pool (free budget) or the owner's own OpenRouter key */
export const accessCodeSource = pgEnum('access_code_source', ['free', 'openrouter']);

/** a teacher's or parent's own OpenRouter key, sealed like the pool's keys (key-box.ts) */
export const openrouterKey = pgTable(
  'openrouter_key',
  {
    id: uuid('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    /** the key, sealed with the row's id */
    keySealed: text('key_sealed').notNull(),
    /** its keyed hash: the same key can't be added twice to one account */
    keyFingerprint: text('key_fingerprint').notNull(),
    /** its last characters, so the owner can tell keys apart */
    keyHint: text('key_hint').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('openrouter_key_owner_fingerprint_idx').on(table.ownerId, table.keyFingerprint)],
);

export const accessCode = pgTable(
  'access_code',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** lowercase (`tiger-apfel-48`), shown uppercase; unique among the codes that haven't expired */
    code: text('code').notNull(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    source: accessCodeSource('source').notNull(),
    /** the own key behind an `openrouter` code; deleting the key deletes its codes */
    openrouterKeyId: uuid('openrouter_key_id').references(() => openrouterKey.id, { onDelete: 'cascade' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    /** whether the "frage KI" block works with this code */
    askEnabled: boolean('ask_enabled').default(true).notNull(),
    /** the owner's note ("4b, Dienstag"); never shown to kids */
    comment: text('comment').default('').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('access_code_code_idx').on(table.code),
    index('access_code_owner_idx').on(table.ownerId),
    index('access_code_ends_idx').on(table.endsAt),
    check('access_code_source_key', sql`(${table.source} = 'openrouter') = (${table.openrouterKeyId} IS NOT NULL)`),
  ],
);

/**
 * Tokens per code, Vienna month and pool entry, added up after every call. No foreign keys: a row carries its
 * code's owner and source itself, so deleting a code, a key, a pool entry or an account never lowers a month's
 * sums. No cost either: cost is always tokens × the current price (`model_price`).
 */
export const usage = pgTable(
  'usage',
  {
    id: serial('id').primaryKey(),
    codeId: uuid('code_id').notNull(),
    ownerId: text('owner_id').notNull(),
    source: accessCodeSource('source').notNull(),
    /** the pool entry that served the calls; null for an own OpenRouter key */
    poolKeyId: uuid('pool_key_id'),
    /** the own key that paid; null for the free budget */
    openrouterKeyId: uuid('openrouter_key_id'),
    /** `2026-11`, the calendar month in Vienna */
    month: text('month').notNull(),
    calls: integer('calls').default(0).notNull(),
    inputTokens: bigint('input_tokens', { mode: 'number' }).default(0).notNull(),
    outputTokens: bigint('output_tokens', { mode: 'number' }).default(0).notNull(),
    cacheWriteTokens: bigint('cache_write_tokens', { mode: 'number' }).default(0).notNull(),
    cacheReadTokens: bigint('cache_read_tokens', { mode: 'number' }).default(0).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // an own key's rows have no pool entry: without NULLS NOT DISTINCT their upsert never finds its row
    unique('usage_code_month_entry').on(table.codeId, table.month, table.poolKeyId).nullsNotDistinct(),
    index('usage_month_idx').on(table.month),
  ],
);

/** the one model's price (Claude Haiku), dollars per million tokens; one row, set by the admin */
export const modelPrice = pgTable(
  'model_price',
  {
    id: integer('id').default(1).primaryKey(),
    input: doublePrecision('input').notNull(),
    output: doublePrecision('output').notNull(),
    /** a 5-minute cache write */
    cacheWrite: doublePrecision('cache_write').notNull(),
    cacheRead: doublePrecision('cache_read').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
  },
  (table) => [check('model_price_one_row', sql`${table.id} = 1`)],
);

/** an 80 % warning that went out; the instance whose insert wins sends it, so it goes out once */
export const budgetWarning = pgTable(
  'budget_warning',
  {
    /** `total`, or `pool:<entry id>` */
    budget: text('budget').notNull(),
    month: text('month').notNull(),
    /** the limit warned about: a raised limit warns again */
    limitUsd: doublePrecision('limit_usd').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.budget, table.month, table.limitUsd] })],
);
