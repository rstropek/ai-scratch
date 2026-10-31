// The free budget (applications, the admin's decisions and switch) and the admin's list on an in-memory Postgres
// (PGlite) with the real migrations.
import { type Database, schema } from '@ai-scratch/db';
import { createTestDb } from '@ai-scratch/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fakeMailer } from '../test/fakes.ts';
import {
  type ApplicationDeps,
  type ApplicationInput,
  applicantState,
  decideApplication,
  domainMismatch,
  getAccount,
  listAccounts,
  normalizeUrl,
  submitApplication,
  switchFreeBudget,
  validateApplication,
} from './applications.ts';
import type { JevVerdict } from './jev.ts';
import { MAX_JEV_CHECKS } from './rules.ts';
import { texts } from './texts.ts';

let db: Database;
let close: () => Promise<void>;
let verdict: JevVerdict;
let screened = 0;
const mailer = fakeMailer();
let deps: ApplicationDeps;

const ADMIN = { id: 'admin', name: 'Rainer', email: 'rainer@example.com' };

beforeAll(async () => {
  const test = await createTestDb();
  db = test.db;
  close = test.close;
  deps = {
    db,
    mailer,
    screen: async () => {
      screened++;
      return verdict;
    },
    adminNotifyEmail: ADMIN.email,
    baseURL: 'http://localhost:3100',
  };
  await db.insert(schema.user).values({ id: ADMIN.id, name: ADMIN.name, email: ADMIN.email, role: 'admin' });
});
afterAll(() => close());
beforeEach(() => {
  verdict = { reasons: [], nouls: { not_genuine: 0.1, not_school: 0.1, abusive: 0 }, model: 'jev-test' };
  screened = 0;
  mailer.sent.length = 0;
});

let n = 0;
/** an account as the confirmation page leaves it; teachers ask for the free budget unless told otherwise */
const adult = async (
  kind: 'parent' | 'teacher',
  name = `Person ${++n}`,
  email = `p${n}@ms-lindenweg.at`,
  requested = kind === 'teacher',
) => {
  const id = `user-${++n}`;
  await db.insert(schema.user).values({ id, name, email, emailVerified: true, role: 'user' });
  const at = new Date();
  await db.insert(schema.adultProfile).values({
    userId: id,
    kind,
    freeBudgetRequested: requested,
    termsVersion: 'v1',
    termsAcceptedAt: at,
    aiConsentAt: at,
    adultConfirmedAt: at,
  });
  return { id, name, email };
};

const application: ApplicationInput = {
  schoolName: 'MS Lindenweg',
  schoolUrl: 'www.ms-lindenweg.at',
  grades: ['unterstufe'],
  summary: 'Ab November einmal pro Woche in zwei 2. Klassen in Digitaler Grundbildung.',
};

describe('validating an application', () => {
  it('normalizes the website and drops unknown grades', () => {
    expect(validateApplication({ ...application, grades: ['unterstufe', 'x', 'unterstufe'] })).toEqual({
      ok: true,
      value: { ...application, schoolUrl: 'https://www.ms-lindenweg.at/', grades: ['unterstufe'] },
    });
  });

  it('names what is missing', () => {
    expect(validateApplication({ schoolName: ' ', schoolUrl: 'keine', grades: [], summary: 'kurz' })).toEqual({
      ok: false,
      fieldErrors: {
        schoolName: texts.validation.schoolName,
        schoolUrl: texts.validation.schoolUrl,
        grades: texts.validation.grades,
        summary: texts.validation.summaryShort(20),
      },
    });
  });

  it('accepts only web addresses with a dotted host', () => {
    expect(normalizeUrl('http://schule.at/x')).toBe('http://schule.at/x');
    expect(normalizeUrl('ftp://schule.at')).toBeUndefined();
    expect(normalizeUrl('localhost')).toBeUndefined();
  });

  it('hints when the email domain does not belong to the website', () => {
    expect(domainMismatch('a@ms-lindenweg.at', 'https://www.ms-lindenweg.at/')).toBeUndefined();
    expect(domainMismatch('a@lehrer.ms-lindenweg.at', 'https://ms-lindenweg.at/')).toBeUndefined();
    expect(domainMismatch('a@gmail.com', 'https://www.ms-lindenweg.at/')).toEqual({
      emailDomain: 'gmail.com',
      host: 'ms-lindenweg.at',
    });
  });
});

describe('submitting an application', () => {
  it('stores it as open and mails the admin', async () => {
    const teacher = await adult('teacher', 'Sabine Leitner', 's.leitner@gmail.com');
    expect(await submitApplication(deps, teacher, application)).toEqual({ ok: true });
    expect(await applicantState(db, teacher.id)).toMatchObject({
      kind: 'teacher',
      requested: true,
      freeBudget: false,
      latest: { status: 'pending' },
    });
    const mail = mailer.last();
    expect(mail?.to).toBe(ADMIN.email);
    expect(mail?.subject).toBe('Neuer Antrag: Sabine Leitner, MS Lindenweg');
    expect(mail?.text).toContain('beantragt das Gratis-Budget');
    expect(mail?.text).toContain(`http://localhost:3100/admin/accounts/${teacher.id}`);
    expect(mail?.text).toContain('gmail.com passt nicht');
    expect(mail?.text).toContain('Bestanden (jev-test)');
  });

  it('says why Jev refused it and stores nothing', async () => {
    const teacher = await adult('teacher');
    verdict = { reasons: ['not_genuine'], nouls: { not_genuine: 0.95 }, model: 'jev-test' };
    expect(await submitApplication(deps, teacher, application)).toEqual({ ok: false, refused: ['not_genuine'] });
    expect((await applicantState(db, teacher.id)).latest).toBeUndefined();
    expect(mailer.sent).toEqual([]);
  });

  it('goes through when Jev fails', async () => {
    const teacher = await adult('teacher');
    verdict = { reasons: [], error: 'TimeoutError: timed out' };
    expect(await submitApplication(deps, teacher, application)).toEqual({ ok: true });
    expect(mailer.last()?.text).toContain('Nicht geprüft: Jev war nicht erreichbar');
  });

  it(`asks Jev at most ${MAX_JEV_CHECKS} times per account, then goes to the admin unchecked`, async () => {
    const teacher = await adult('teacher');
    verdict = { reasons: ['not_school'], nouls: { not_school: 0.9 } };
    for (let i = 0; i < MAX_JEV_CHECKS; i++)
      expect(await submitApplication(deps, teacher, application)).toEqual({ ok: false, refused: ['not_school'] });
    expect(await submitApplication(deps, teacher, application)).toEqual({ ok: true });
    expect(screened).toBe(MAX_JEV_CHECKS);
    const [row] = await db
      .select({ jev: schema.teacherApplication.jev })
      .from(schema.teacherApplication)
      .where(eq(schema.teacherApplication.userId, teacher.id));
    expect(row?.jev).toEqual({ skipped: 'cap' });
  });

  it('records when Jev is switched off', async () => {
    const teacher = await adult('teacher');
    expect(await submitApplication({ ...deps, screen: undefined }, teacher, application)).toEqual({ ok: true });
    expect(screened).toBe(0);
    expect(mailer.last()?.text).toContain(texts.admin.account.jevDisabled);
  });

  it('allows one application per account: none while it is open, none after a rejection', async () => {
    const teacher = await adult('teacher');
    expect(await submitApplication(deps, teacher, application)).toEqual({ ok: true });
    expect(await submitApplication(deps, teacher, application)).toEqual({ ok: false, notAllowed: true });
    const id = (await getAccount(db, teacher.id))?.applications[0]?.id ?? '';
    await decideApplication(deps, ADMIN.id, id, 'rejected', '');
    expect(await submitApplication(deps, teacher, application)).toEqual({ ok: false, notAllowed: true });
  });

  it('is only open to accounts that asked for the free budget at registration', async () => {
    const parent = await adult('parent');
    const teacher = await adult('teacher', undefined, undefined, false);
    expect(await submitApplication(deps, parent, application)).toEqual({ ok: false, notAllowed: true });
    expect(await submitApplication(deps, teacher, application)).toEqual({ ok: false, notAllowed: true });
    expect(await submitApplication(deps, ADMIN, application)).toEqual({ ok: false, notAllowed: true });
  });

  it('is not stored when the admin switched the budget on while Jev was checking', async () => {
    const teacher = await adult('teacher');
    const slowJev = async () => {
      await switchFreeBudget(deps, ADMIN.id, teacher.id, true);
      return verdict;
    };
    expect(await submitApplication({ ...deps, screen: slowJev }, teacher, application)).toEqual({
      ok: false,
      notAllowed: true,
    });
    expect(await getAccount(db, teacher.id)).toMatchObject({ status: 'granted', applications: [] });
  });

  it('is stored once when a second tab sent the same application while Jev was checking', async () => {
    const teacher = await adult('teacher');
    let first = true;
    const slowJev = async () => {
      if (first) {
        first = false;
        expect(await submitApplication(deps, teacher, application)).toEqual({ ok: true });
      }
      return verdict;
    };
    expect(await submitApplication({ ...deps, screen: slowJev }, teacher, application)).toEqual({
      ok: false,
      notAllowed: true,
    });
    expect((await getAccount(db, teacher.id))?.applications).toHaveLength(1);
  });

  it('is not needed once the admin switched the free budget on by hand', async () => {
    const teacher = await adult('teacher');
    await switchFreeBudget(deps, ADMIN.id, teacher.id, true);
    expect(await submitApplication(deps, teacher, application)).toEqual({ ok: false, notAllowed: true });
  });
});

describe('deciding an application', () => {
  it('accepts it once, switches the free budget on and mails the teacher', async () => {
    const teacher = await adult('teacher', 'Thomas Gruber', 't.gruber@brg.at');
    await submitApplication(deps, teacher, application);
    const id = (await getAccount(db, teacher.id))?.applications[0]?.id ?? '';
    mailer.sent.length = 0;
    expect(await decideApplication(deps, ADMIN.id, id, 'accepted', ' passt ')).toEqual({
      result: 'done',
      mailed: true,
    });
    expect(mailer.last()).toMatchObject({ to: 't.gruber@brg.at', subject: texts.mail.freeBudgetOn('', '').subject });
    expect(await decideApplication(deps, ADMIN.id, id, 'rejected', '')).toEqual({ result: 'stale' });
    const detail = await getAccount(db, teacher.id);
    expect(detail?.applications[0]).toMatchObject({ status: 'accepted', decidedBy: ADMIN.name, note: 'passt' });
    expect(detail).toMatchObject({ status: 'granted', freeBudgetBy: ADMIN.name });
    expect((await applicantState(db, teacher.id)).freeBudget).toBe(true);
  });

  it('rejects it with the mail that own OpenRouter keys still work, and leaves the budget off', async () => {
    const teacher = await adult('teacher');
    await submitApplication(deps, teacher, application);
    const id = (await getAccount(db, teacher.id))?.applications[0]?.id ?? '';
    mailer.sent.length = 0;
    await decideApplication(deps, ADMIN.id, id, 'rejected', '');
    expect(mailer.last()?.text).toContain('derzeit leider nicht freischalten');
    expect(mailer.last()?.text).toContain('OpenRouter');
    expect(mailer.last()?.text).not.toContain('Notiz');
    expect(await applicantState(db, teacher.id)).toMatchObject({ freeBudget: false, latest: { status: 'rejected' } });
  });

  it('keeps the decision when the mail fails', async () => {
    const teacher = await adult('teacher');
    await submitApplication(deps, teacher, application);
    const id = (await getAccount(db, teacher.id))?.applications[0]?.id ?? '';
    const failing = async () => {
      throw new Error('Resend down');
    };
    expect(await decideApplication({ ...deps, mailer: failing }, ADMIN.id, id, 'accepted', '')).toEqual({
      result: 'done',
      mailed: false,
    });
    expect((await applicantState(db, teacher.id)).latest?.status).toBe('accepted');
  });
});

describe('switching the free budget by hand', () => {
  it('switches it on for a parent with a mail, and off again without one', async () => {
    const parent = await adult('parent', 'Petra Dojo', 'petra@coderdojo.at');
    expect(await switchFreeBudget(deps, ADMIN.id, parent.id, true)).toEqual({ result: 'done', mailed: true });
    expect(mailer.last()).toMatchObject({ to: 'petra@coderdojo.at', subject: texts.mail.freeBudgetOn('', '').subject });
    expect(await getAccount(db, parent.id)).toMatchObject({ status: 'granted', freeBudgetBy: ADMIN.name });
    expect(await switchFreeBudget(deps, ADMIN.id, parent.id, true)).toEqual({ result: 'stale' });

    mailer.sent.length = 0;
    expect(await switchFreeBudget(deps, ADMIN.id, parent.id, false)).toEqual({ result: 'done' });
    expect(mailer.sent).toEqual([]);
    expect(await getAccount(db, parent.id)).toMatchObject({ status: 'none', freeBudgetAt: null, freeBudgetBy: null });
    expect(await switchFreeBudget(deps, ADMIN.id, parent.id, false)).toEqual({ result: 'stale' });
  });

  it('leaves an open application to its decision', async () => {
    const teacher = await adult('teacher');
    await submitApplication(deps, teacher, application);
    expect(await switchFreeBudget(deps, ADMIN.id, teacher.id, true)).toEqual({ result: 'stale' });
    expect((await applicantState(db, teacher.id)).freeBudget).toBe(false);
  });

  it('takes it away from an accepted teacher, who cannot apply again', async () => {
    const teacher = await adult('teacher');
    await submitApplication(deps, teacher, application);
    const id = (await getAccount(db, teacher.id))?.applications[0]?.id ?? '';
    await decideApplication(deps, ADMIN.id, id, 'accepted', '');
    expect(await switchFreeBudget(deps, ADMIN.id, teacher.id, false)).toEqual({ result: 'done' });
    expect((await getAccount(db, teacher.id))?.status).toBe('none');
    expect(await submitApplication(deps, teacher, application)).toEqual({ ok: false, notAllowed: true });
  });
});

describe('the account list', () => {
  it('filters by type and status, counts each filter and searches', async () => {
    const fresh = await createTestDb();
    try {
      const d = { ...deps, db: fresh.db };
      db = fresh.db;
      await db.insert(schema.user).values({ id: ADMIN.id, name: ADMIN.name, email: ADMIN.email, role: 'admin' });
      const parent = await adult('parent', 'Paula Eltern', 'paula@example.com');
      const missing = await adult('teacher', 'Max Fehlt', 'max@schule.at');
      const first = await adult('teacher', 'Anna Erste', 'anna@vs-dorf.at');
      const second = await adult('teacher', 'Bert Zweite', 'bert@brg.at');
      await submitApplication(d, first, { ...application, schoolName: 'VS Dorf' });
      await submitApplication(d, second, { ...application, schoolName: 'BRG Stadt' });
      const rejected = await adult('teacher', 'Clara Nein', 'clara@ms.at');
      await submitApplication(d, rejected, application);
      const id = (await getAccount(db, rejected.id))?.applications[0]?.id ?? '';
      await decideApplication(d, ADMIN.id, id, 'rejected', '');
      // a teacher who didn't ask, and a parent the admin gave the free budget by hand
      const quiet = await adult('teacher', 'Theo Still', 'theo@schule.at', false);
      const dojo = await adult('parent', 'Dora Dojo', 'dora@coderdojo.at');
      await switchFreeBudget(d, ADMIN.id, dojo.id, true);

      const pending = await listAccounts(db, 'pending');
      expect(pending.counts).toEqual({ pending: 2, freeBudget: 1, teachers: 5, parents: 2, all: 7 });
      // a queue: the oldest application first
      expect(pending.rows.map((r) => r.name)).toEqual(['Anna Erste', 'Bert Zweite']);
      expect((await listAccounts(db, 'freeBudget')).rows.map((r) => [r.userId, r.status])).toEqual([
        [dojo.id, 'granted'],
      ]);
      expect((await listAccounts(db, 'parents')).rows.map((r) => [r.userId, r.status])).toEqual([
        [dojo.id, 'granted'],
        [parent.id, 'none'],
      ]);
      const teachers = await listAccounts(db, 'teachers');
      expect(Object.fromEntries(teachers.rows.map((r) => [r.name, r.status]))).toEqual({
        'Theo Still': 'none',
        'Max Fehlt': 'missing',
        'Anna Erste': 'pending',
        'Bert Zweite': 'pending',
        'Clara Nein': 'rejected',
      });
      expect(teachers.rows.find((r) => r.userId === quiet.id)?.freeBudget).toBe(false);
      expect(teachers.rows.find((r) => r.userId === missing.id)?.schoolName).toBeUndefined();
      expect((await listAccounts(db, 'all', 'brg stadt')).rows.map((r) => r.name)).toEqual(['Bert Zweite']);
      expect((await listAccounts(db, 'all', 'PAULA')).rows.map((r) => r.name)).toEqual(['Paula Eltern']);
      expect((await listAccounts(db, 'all', '100%')).rows).toEqual([]);
    } finally {
      await fresh.close();
    }
  });
});
