// Teacher applications: submitting one (screened by Jev), the admin's decision, and the admin's account list.
// A factory-free module over its dependencies, so tests run it on PGlite.
import { type Database, schema } from '@ai-scratch/db';
import { and, asc, desc, eq, exists, ilike, inArray, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { ApplicationScreener, JevVerdict, RefusalReason } from './jev.ts';
import type { Mailer } from './mail.ts';
import type { FieldErrors } from './registration.ts';
import type { AdultKind } from './registration-token.ts';
import { MAX_JEV_CHECKS, SCHOOL_NAME_MAX, SCHOOL_URL_MAX, SUMMARY_MAX, SUMMARY_MIN } from './rules.ts';
import { GRADES, type Grade, texts } from './texts.ts';

const { adultProfile, teacherApplication, user } = schema;

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected';

/** what is stored about Jev with an application */
export type JevRecord = Omit<JevVerdict, 'reasons'> & { skipped?: 'cap' | 'disabled' };

export type ApplicationField = 'schoolName' | 'schoolUrl' | 'grades' | 'summary';

export interface ApplicationInput {
  schoolName: string;
  schoolUrl: string;
  grades: string[];
  summary: string;
}

const isGrade = (grade: string): grade is Grade => Object.hasOwn(GRADES, grade);

/** "www.schule.at" → "https://www.schule.at/"; undefined when it can't be a website */
export const normalizeUrl = (raw: string): string | undefined => {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > SCHOOL_URL_MAX) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    if (!/^[^.]+(\.[^.]+)+$/.test(url.hostname)) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
};

export const validateApplication = (
  input: ApplicationInput,
): { ok: true; value: ApplicationInput } | { ok: false; fieldErrors: FieldErrors<ApplicationField> } => {
  const schoolName = input.schoolName.trim();
  const schoolUrl = normalizeUrl(input.schoolUrl);
  const grades = [...new Set(input.grades)].filter(isGrade);
  const summary = input.summary.trim();
  const fieldErrors: FieldErrors<ApplicationField> = {};
  if (schoolName.length < 2 || schoolName.length > SCHOOL_NAME_MAX)
    fieldErrors.schoolName = texts.validation.schoolName;
  if (!schoolUrl) fieldErrors.schoolUrl = texts.validation.schoolUrl;
  if (grades.length === 0) fieldErrors.grades = texts.validation.grades;
  if (summary.length < SUMMARY_MIN) fieldErrors.summary = texts.validation.summaryShort(SUMMARY_MIN);
  else if (summary.length > SUMMARY_MAX) fieldErrors.summary = texts.validation.summaryLong(SUMMARY_MAX);
  if (Object.keys(fieldErrors).length > 0 || !schoolUrl) return { ok: false, fieldErrors };
  return { ok: true, value: { schoolName, schoolUrl, grades, summary } };
};

const stripWww = (host: string) => host.replace(/^www\./, '');

/** A hint for the admin when the email's domain doesn't belong to the school's website (not a gate). */
export const domainMismatch = (email: string, schoolUrl: string): { emailDomain: string; host: string } | undefined => {
  const emailDomain = email.split('@')[1]?.toLowerCase() ?? '';
  let host: string;
  try {
    host = stripWww(new URL(schoolUrl).hostname.toLowerCase());
  } catch {
    return undefined;
  }
  const domain = stripWww(emailDomain);
  const related = domain === host || domain.endsWith(`.${host}`) || host.endsWith(`.${domain}`);
  return related ? undefined : { emailDomain, host };
};

export const gradeLabels = (grades: string[]) => grades.map((g) => (isGrade(g) ? GRADES[g] : g)).join(', ');

export interface ApplicantState {
  /** undefined for accounts without a profile (the seeded admin) */
  kind?: AdultKind;
  latest?: { status: ApplicationStatus; createdAt: Date };
}

export const applicantState = async (db: Database, userId: string): Promise<ApplicantState> => {
  const profile = await db.query.adultProfile.findFirst({
    where: eq(adultProfile.userId, userId),
    columns: { kind: true },
  });
  const latest = await db.query.teacherApplication.findFirst({
    where: eq(teacherApplication.userId, userId),
    columns: { status: true, createdAt: true },
    orderBy: desc(teacherApplication.createdAt),
  });
  return { kind: profile?.kind, latest };
};

/** whether the account may send an application now (none open, not already a teacher) */
export const canApply = (state: ApplicantState) =>
  state.kind !== undefined && state.latest?.status !== 'pending' && state.latest?.status !== 'accepted';

/** an accepted application makes a teacher; everyone else is treated like a parent */
export const isTeacher = (state: ApplicantState) => state.latest?.status === 'accepted';

export interface ApplicationDeps {
  db: Database;
  mailer: Mailer;
  /** undefined when Jev is switched off */
  screen?: ApplicationScreener;
  adminNotifyEmail: string;
  baseURL: string;
}

export type SubmitResult =
  | { ok: true }
  | { ok: false; fieldErrors: FieldErrors<ApplicationField> }
  | { ok: false; refused: RefusalReason[] }
  | { ok: false; notAllowed: true };

/** Counts one Jev check against the account's cap; false when the cap is used up. */
const takeJevCheck = async (db: Database, userId: string) => {
  const rows = await db
    .update(adultProfile)
    .set({ jevChecks: sql`${adultProfile.jevChecks} + 1` })
    .where(and(eq(adultProfile.userId, userId), sql`${adultProfile.jevChecks} < ${MAX_JEV_CHECKS}`))
    .returning({ userId: adultProfile.userId });
  return rows.length > 0;
};

const jevSummary = (jev: JevRecord) => {
  const a = texts.admin.account;
  if (jev.skipped === 'cap') return a.jevCapped;
  if (jev.skipped === 'disabled') return a.jevDisabled;
  if (jev.error) return a.jevFailed(jev.error);
  return a.jevPassed(jev.model ?? 'Jev');
};

const isUniqueViolation = (error: unknown): boolean => {
  const e = error as { code?: unknown; cause?: unknown };
  return e?.code === '23505' || (e?.cause !== undefined && isUniqueViolation(e.cause));
};

export const submitApplication = async (
  deps: ApplicationDeps,
  applicant: { id: string; name: string; email: string },
  input: ApplicationInput,
): Promise<SubmitResult> => {
  if (!canApply(await applicantState(deps.db, applicant.id))) return { ok: false, notAllowed: true };
  const valid = validateApplication(input);
  if (!valid.ok) return valid;
  const application = valid.value;

  let jev: JevRecord;
  if (!deps.screen) jev = { skipped: 'disabled' };
  else if (!(await takeJevCheck(deps.db, applicant.id))) jev = { skipped: 'cap' };
  else {
    const { reasons, ...rest } = await deps.screen(application);
    if (reasons.length > 0) return { ok: false, refused: reasons };
    jev = rest;
  }

  try {
    await deps.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(teacherApplication)
        .values({ userId: applicant.id, ...application, jev })
        .returning({ id: teacherApplication.id });
      if (!row) throw new Error('teacher application not inserted');
      await tx.update(adultProfile).set({ kind: 'teacher' }).where(eq(adultProfile.userId, applicant.id));
    });
  } catch (error) {
    // a second tab sent one at the same time: one open application per account
    if (isUniqueViolation(error)) return { ok: false, notAllowed: true };
    throw error;
  }

  const mismatch = domainMismatch(applicant.email, application.schoolUrl);
  try {
    await deps.mailer({
      to: deps.adminNotifyEmail,
      ...texts.mail.newApplication({
        name: applicant.name,
        email: applicant.email,
        schoolName: application.schoolName,
        schoolUrl: application.schoolUrl,
        grades: gradeLabels(application.grades),
        summary: application.summary,
        jev: jevSummary(jev),
        domainHint: mismatch && texts.admin.account.domainMismatch(mismatch.emailDomain, mismatch.host),
        url: `${deps.baseURL}/admin/accounts/${applicant.id}`,
      }),
    });
  } catch (error) {
    // the application is stored and listed under "Offene Anträge" anyway
    console.error('applications: mail to the admin failed', error);
  }
  return { ok: true };
};

export type DecideResult = { result: 'done'; mailed: boolean } | { result: 'stale' };

/** Accepts or rejects an open application and tells the applicant by email. */
export const decideApplication = async (
  deps: Pick<ApplicationDeps, 'db' | 'mailer' | 'baseURL'>,
  adminId: string,
  applicationId: string,
  decision: 'accepted' | 'rejected',
  note: string,
): Promise<DecideResult> => {
  const [decided] = await deps.db
    .update(teacherApplication)
    .set({ status: decision, decidedAt: new Date(), decidedBy: adminId, note: note.trim() || null })
    .where(and(eq(teacherApplication.id, applicationId), eq(teacherApplication.status, 'pending')))
    .returning({ userId: teacherApplication.userId });
  if (!decided) return { result: 'stale' };
  const applicant = await deps.db.query.user.findFirst({
    where: eq(user.id, decided.userId),
    columns: { name: true, email: true },
  });
  if (!applicant) return { result: 'done', mailed: false };
  const mail = decision === 'accepted' ? texts.mail.accepted : texts.mail.rejected;
  try {
    await deps.mailer({ to: applicant.email, ...mail(applicant.name, deps.baseURL) });
    return { result: 'done', mailed: true };
  } catch (error) {
    console.error('applications: mail to the applicant failed', error);
    return { result: 'done', mailed: false };
  }
};

export const ACCOUNT_FILTERS = ['pending', 'teachers', 'parents', 'all'] as const;
export type AccountFilter = (typeof ACCOUNT_FILTERS)[number];
export const parseFilter = (value: unknown): AccountFilter => ACCOUNT_FILTERS.find((f) => f === value) ?? 'pending';

/** parent: never applied; missing: registered as a teacher without an application yet */
export type AccountStatus = 'parent' | 'missing' | ApplicationStatus;

export interface AccountRow {
  userId: string;
  name: string;
  email: string;
  registeredAt: Date;
  kind: AdultKind;
  status: AccountStatus;
  schoolName?: string;
  /** when the latest application came in */
  appliedAt?: Date;
}

const matches = (filter: AccountFilter, row: AccountRow) => {
  if (filter === 'pending') return row.status === 'pending';
  if (filter === 'teachers') return row.kind === 'teacher';
  if (filter === 'parents') return row.kind === 'parent';
  return true;
};

/**
 * The admin's account list with the counts per filter. Loads all matching profiles at once: hundreds of
 * accounts, not millions.
 */
export const listAccounts = async (
  db: Database,
  filter: AccountFilter,
  search = '',
): Promise<{ rows: AccountRow[]; counts: Record<AccountFilter, number> }> => {
  const q = search.trim();
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const profiles = await db
    .select({
      userId: adultProfile.userId,
      kind: adultProfile.kind,
      registeredAt: adultProfile.createdAt,
      name: user.name,
      email: user.email,
    })
    .from(adultProfile)
    .innerJoin(user, eq(user.id, adultProfile.userId))
    .where(
      q
        ? or(
            ilike(user.name, pattern),
            ilike(user.email, pattern),
            exists(
              db
                .select({ one: sql`1` })
                .from(teacherApplication)
                .where(
                  and(
                    eq(teacherApplication.userId, adultProfile.userId),
                    ilike(teacherApplication.schoolName, pattern),
                  ),
                ),
            ),
          )
        : undefined,
    )
    .orderBy(desc(adultProfile.createdAt));
  const ids = profiles.map((p) => p.userId);
  const applications = ids.length
    ? await db
        .select({
          userId: teacherApplication.userId,
          status: teacherApplication.status,
          schoolName: teacherApplication.schoolName,
          createdAt: teacherApplication.createdAt,
        })
        .from(teacherApplication)
        .where(inArray(teacherApplication.userId, ids))
        .orderBy(asc(teacherApplication.createdAt))
    : [];
  const latest = new Map(applications.map((a) => [a.userId, a])); // ascending: the last one wins
  const all: AccountRow[] = profiles.map((p) => {
    const application = latest.get(p.userId);
    return {
      ...p,
      status: application?.status ?? (p.kind === 'teacher' ? 'missing' : 'parent'),
      schoolName: application?.schoolName,
      appliedAt: application?.createdAt,
    };
  });
  const counts = Object.fromEntries(
    ACCOUNT_FILTERS.map((f) => [f, all.filter((row) => matches(f, row)).length]),
  ) as Record<AccountFilter, number>;
  const rows = all.filter((row) => matches(filter, row));
  // open applications are a queue: oldest first
  if (filter === 'pending') rows.sort((a, b) => (a.appliedAt?.getTime() ?? 0) - (b.appliedAt?.getTime() ?? 0));
  return { rows, counts };
};

export const getAccount = async (db: Database, userId: string) => {
  const profile = await db
    .select({
      userId: adultProfile.userId,
      kind: adultProfile.kind,
      termsVersion: adultProfile.termsVersion,
      termsAcceptedAt: adultProfile.termsAcceptedAt,
      aiConsentAt: adultProfile.aiConsentAt,
      jevChecks: adultProfile.jevChecks,
      registeredAt: adultProfile.createdAt,
      name: user.name,
      email: user.email,
    })
    .from(adultProfile)
    .innerJoin(user, eq(user.id, adultProfile.userId))
    .where(eq(adultProfile.userId, userId));
  const account = profile[0];
  if (!account) return undefined;
  const decider = alias(user, 'decider');
  const applications = await db
    .select({
      id: teacherApplication.id,
      schoolName: teacherApplication.schoolName,
      schoolUrl: teacherApplication.schoolUrl,
      grades: teacherApplication.grades,
      summary: teacherApplication.summary,
      status: teacherApplication.status,
      jev: teacherApplication.jev,
      createdAt: teacherApplication.createdAt,
      decidedAt: teacherApplication.decidedAt,
      decidedBy: decider.name,
      note: teacherApplication.note,
    })
    .from(teacherApplication)
    .leftJoin(decider, eq(decider.id, teacherApplication.decidedBy))
    .where(eq(teacherApplication.userId, userId))
    .orderBy(desc(teacherApplication.createdAt));
  return {
    ...account,
    applications: applications.map((a) => ({
      ...a,
      jev: a.jev as JevRecord | null,
      jevSummary: a.jev ? jevSummary(a.jev as JevRecord) : undefined,
    })),
  };
};

export type AccountDetail = NonNullable<Awaited<ReturnType<typeof getAccount>>>;
