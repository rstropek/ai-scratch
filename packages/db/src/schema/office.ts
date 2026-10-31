// The office's own tables: who registered as what, teacher applications, registration rate limits.
import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth.ts';

/** what someone registered (or later applied) as; only an accepted application makes a teacher */
export const adultKind = pgEnum('adult_kind', ['parent', 'teacher']);
export const applicationStatus = pgEnum('application_status', ['pending', 'accepted', 'rejected']);

/** one row per registered adult (the seeded admin has none) */
export const adultProfile = pgTable('adult_profile', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  kind: adultKind('kind').notNull(),
  termsVersion: text('terms_version').notNull(),
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }).notNull(),
  /** the separate consent to AI processing outside the EU */
  aiConsentAt: timestamp('ai_consent_at', { withTimezone: true }).notNull(),
  adultConfirmedAt: timestamp('adult_confirmed_at', { withTimezone: true }).notNull(),
  /** Jev checks of this account's applications so far (each costs money, so they are capped) */
  jevChecks: integer('jev_checks').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const teacherApplication = pgTable(
  'teacher_application',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    schoolName: text('school_name').notNull(),
    schoolUrl: text('school_url').notNull(),
    grades: text('grades').array().notNull(),
    summary: text('summary').notNull(),
    status: applicationStatus('status').default('pending').notNull(),
    /** Jev's answer, or why it wasn't asked */
    jev: jsonb('jev'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decidedBy: text('decided_by').references(() => user.id, { onDelete: 'set null' }),
    /** the admin's internal note on the decision; never sent to the applicant */
    note: text('note'),
  },
  (table) => [
    index('teacher_application_user_idx').on(table.userId),
    uniqueIndex('teacher_application_one_pending_idx').on(table.userId).where(sql`${table.status} = 'pending'`),
  ],
);

/** one row per registration request in the last hour; hashed, so no address is stored before its link is used */
export const registrationAttempt = pgTable(
  'registration_attempt',
  {
    id: serial('id').primaryKey(),
    ipHash: text('ip_hash').notNull(),
    emailHash: text('email_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('registration_attempt_ip_idx').on(table.ipHash, table.createdAt),
    index('registration_attempt_email_idx').on(table.emailHash, table.createdAt),
  ],
);

export const adultProfileRelations = relations(adultProfile, ({ one, many }) => ({
  user: one(user, { fields: [adultProfile.userId], references: [user.id] }),
  applications: many(teacherApplication),
}));

export const teacherApplicationRelations = relations(teacherApplication, ({ one }) => ({
  user: one(user, { fields: [teacherApplication.userId], references: [user.id] }),
  profile: one(adultProfile, { fields: [teacherApplication.userId], references: [adultProfile.userId] }),
}));
