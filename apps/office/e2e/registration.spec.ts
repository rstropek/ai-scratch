import { texts } from '../lib/texts.ts';
import { expect, newPerson, test } from './fixtures.ts';
import { ageTerms, linkIn, mailTo, PASSWORD, registerAccount, signIn, uniqueEmail } from './helpers.ts';
import { E2E_ADMIN } from './settings.ts';

const h = texts.home;

test('a parent registers, confirms the address and lands signed in on the start page', async ({ page }) => {
  const email = uniqueEmail('parent');
  const link = await registerAccount(page, { email, kind: 'parent', firstName: 'Paula', lastName: 'Eltern' });
  await expect(page.getByRole('heading', { name: h.greeting('Paula Eltern') })).toBeVisible();
  await expect(page.getByRole('heading', { name: h.application.none.title })).toBeVisible();

  // the link works once
  await page.goto(link);
  await expect(page.getByRole('heading', { name: texts.confirm.existsTitle })).toBeVisible();
});

test('registering an address that has an account mails a note, not a link', async ({ page }) => {
  await page.goto('/register');
  const r = texts.register;
  await page.getByLabel(r.email).fill(E2E_ADMIN.email);
  await page.getByLabel(r.kindLabels.teacher).check();
  await page.getByLabel(r.adult).check();
  await page.getByRole('checkbox', { name: new RegExp(r.termsAfter.trim()) }).check();
  await page.getByRole('checkbox', { name: new RegExp(r.aiConsentLink) }).check();
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, { timeout: 15_000 });
  await page.getByRole('button', { name: r.submit }).click();
  await expect(page.getByRole('heading', { name: r.sentTitle })).toBeVisible();
  const mail = await mailTo(E2E_ADMIN.email, texts.mail.exists('').subject);
  expect(mail.text).toContain('/forgot-password');
});

test('the form names what is missing', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel(texts.register.email).fill('kaputt@');
  await page.getByRole('button', { name: texts.register.submit }).click();
  await expect(page.getByText(texts.validation.email)).toBeVisible();
  await expect(page.getByText(texts.validation.kind)).toBeVisible();
  await expect(page.getByText(texts.validation.terms)).toBeVisible();
  await expect(page.getByLabel(texts.register.email)).toHaveValue('kaputt@');
});

test('a broken confirmation link says so', async ({ page }) => {
  await page.goto('/register/confirm?t=not-a-token');
  await expect(page.getByRole('heading', { name: texts.confirm.invalidTitle })).toBeVisible();
  await expect(page.getByRole('link', { name: texts.confirm.again })).toHaveAttribute('href', '/register');
});

test('a teacher applies, the admin accepts, and the teacher is confirmed', async ({ page, browser, baseURL }) => {
  const email = uniqueEmail('teacher');
  const name = `Thomas Gruber ${Date.now().toString(36)}`;
  await registerAccount(page, { email, kind: 'teacher', firstName: 'Thomas', lastName: name.slice(7) });
  await expect(page).toHaveURL(/\/apply$/);
  const a = texts.apply;
  await page.getByLabel(a.schoolName).fill('BRG Seestraße');
  await page.getByLabel(a.schoolUrl).fill('www.brg-seestrasse.at');
  await page.getByLabel(texts.apply.gradeLabels.unterstufe).check();
  await page.getByLabel(a.summary).fill('Einmal pro Woche in zwei 3. Klassen in Digitaler Grundbildung.');
  await page.getByRole('button', { name: a.submit }).click();
  await expect(page.getByText(h.sent)).toBeVisible();
  await expect(page.getByRole('heading', { name: h.application.pending.title })).toBeVisible();

  const notice = await mailTo(E2E_ADMIN.email, `Neuer Antrag: ${name}, BRG Seestraße`);
  expect(notice.text).toContain('example.com passt nicht');

  const admin = await newPerson(browser, baseURL);
  await signIn(admin, E2E_ADMIN.email, E2E_ADMIN.password);
  await admin.goto(linkIn(notice, '/admin/accounts/'));
  await expect(admin.getByRole('heading', { name })).toBeVisible();
  await admin.getByLabel(texts.admin.account.note).fill('Website geprüft');
  await admin.getByRole('button', { name: texts.admin.account.accept }).click();
  await expect(admin.getByText(texts.admin.account.acceptedBanner)).toBeVisible();
  await expect(admin.getByText(texts.admin.status.accepted)).toBeVisible();
  await mailTo(email, texts.mail.accepted('', '').subject);

  await page.reload();
  await expect(page.getByRole('heading', { name: h.application.accepted.title })).toBeVisible();
  await admin.close();
});

test('the admin rejects an application, and the teacher may apply again', async ({ page, browser, baseURL }) => {
  const email = uniqueEmail('rejected');
  const name = `Clara Nein ${Date.now().toString(36)}`;
  await registerAccount(page, { email, kind: 'teacher', firstName: 'Clara', lastName: name.slice(6) });
  await page.getByLabel(texts.apply.schoolName).fill('MS Lindenweg');
  await page.getByLabel(texts.apply.schoolUrl).fill('ms-lindenweg.at');
  await page.getByLabel(texts.apply.gradeLabels.oberstufe).check();
  await page.getByLabel(texts.apply.summary).fill('Im Informatik-Wahlfach mit einer kleinen Gruppe.');
  await page.getByRole('button', { name: texts.apply.submit }).click();
  await expect(page.getByRole('heading', { name: h.application.pending.title })).toBeVisible();

  const admin = await newPerson(browser, baseURL);
  await signIn(admin, E2E_ADMIN.email, E2E_ADMIN.password);
  await admin.goto('/admin');
  const row = admin.getByRole('row').filter({ hasText: name });
  await expect(row).toBeVisible();
  await row.getByRole('link', { name: new RegExp(texts.admin.review) }).click();
  await admin.getByRole('button', { name: texts.admin.account.reject }).click();
  const dialog = admin.getByRole('dialog', { name: texts.admin.account.rejectTitle });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: texts.admin.account.reject }).click();
  await expect(admin.getByText(texts.admin.account.rejectedBanner)).toBeVisible();
  const mail = await mailTo(email, texts.mail.rejected('', '').subject);
  expect(mail.text).toContain('OpenRouter');

  await page.reload();
  await expect(page.getByRole('heading', { name: h.application.rejected.title })).toBeVisible();
  await expect(page.getByRole('link', { name: h.application.applyAgain })).toBeVisible();
  await admin.close();
});

test('the admin list filters parents and teachers', async ({ page, browser, baseURL }) => {
  const parentName = `Pia Filter ${Date.now().toString(36)}`;
  await registerAccount(page, {
    email: uniqueEmail('filter'),
    kind: 'parent',
    firstName: 'Pia',
    lastName: parentName.slice(4),
  });
  await expect(page.getByRole('heading', { name: h.greeting(parentName) })).toBeVisible();

  const admin = await newPerson(browser, baseURL);
  await signIn(admin, E2E_ADMIN.email, E2E_ADMIN.password);
  await admin.goto('/admin?filter=parents');
  const filters = admin.getByRole('navigation', { name: texts.admin.filterLabel });
  await expect(filters.getByRole('link', { name: new RegExp(texts.admin.filters.parents) })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(admin.getByRole('row').filter({ hasText: parentName })).toBeVisible();
  await filters.getByRole('link', { name: new RegExp(texts.admin.filters.teachers) }).click();
  await expect(admin).toHaveURL(/filter=teachers/);
  await expect(admin.getByRole('row').filter({ hasText: parentName })).toHaveCount(0);
  await admin.getByLabel(texts.admin.searchLabel).fill(parentName);
  await admin.getByRole('button', { name: texts.admin.searchSubmit }).click();
  await expect(admin.getByText(texts.admin.empty.search(parentName))).toBeVisible();
  await admin.close();
});

test('only admins see the account list', async ({ page }) => {
  await registerAccount(page, { email: uniqueEmail('nosy'), kind: 'parent', firstName: 'Nora', lastName: 'Neugier' });
  await expect(page.getByRole('heading', { name: h.greeting('Nora Neugier') })).toBeVisible();
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: texts.admin.forbiddenTitle })).toBeVisible();
});

test('a forgotten password is reset through the mailed link', async ({ page }) => {
  const email = uniqueEmail('forgetful');
  await registerAccount(page, { email, kind: 'parent', firstName: 'Fritz', lastName: 'Vergesslich' });
  await expect(page.getByRole('heading', { name: h.greeting('Fritz Vergesslich') })).toBeVisible();
  await page.getByRole('button', { name: texts.shell.signOut }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole('link', { name: texts.login.forgot }).click();
  await page.getByLabel(texts.forgot.email).fill(email);
  await page.getByRole('button', { name: texts.forgot.submit }).click();
  await expect(page.getByRole('heading', { name: texts.forgot.sentTitle })).toBeVisible();
  const mail = await mailTo(email, texts.mail.resetPassword('').subject);
  await page.goto(linkIn(mail, '/api/auth/reset-password/'));
  await expect(page).toHaveURL(/\/reset-password\?token=/);
  await page.getByLabel(texts.reset.password, { exact: true }).fill(`${PASSWORD} neu`);
  await page.getByLabel(texts.reset.passwordRepeat).fill(`${PASSWORD} neu`);
  await page.getByRole('button', { name: texts.reset.submit }).click();
  await expect(page.getByRole('heading', { name: texts.reset.doneTitle })).toBeVisible();

  await signIn(page, email, `${PASSWORD} neu`);
  await expect(page.getByRole('heading', { name: h.greeting('Fritz Vergesslich') })).toBeVisible();
});

test('after a new version of the terms, the account agrees again before anything else', async ({ page }) => {
  const email = uniqueEmail('consent');
  await registerAccount(page, { email, kind: 'parent', firstName: 'Vera', lastName: 'Version' });
  await expect(page.getByRole('heading', { name: h.greeting('Vera Version') })).toBeVisible();
  await ageTerms(email);

  await page.goto('/');
  await expect(page).toHaveURL(/\/consent$/);
  await expect(page.getByRole('heading', { name: texts.consent.title })).toBeVisible();
  await page.goto('/apply');
  await expect(page).toHaveURL(/\/consent$/);

  await page.getByRole('button', { name: texts.consent.submit }).click();
  await expect(page.getByText(texts.validation.terms)).toBeVisible();
  await page.getByRole('checkbox', { name: new RegExp(texts.register.termsAfter.trim()) }).check();
  await page.getByRole('checkbox', { name: new RegExp(texts.register.aiConsentLink) }).check();
  await page.getByRole('button', { name: texts.consent.submit }).click();
  await expect(page.getByRole('heading', { name: h.greeting('Vera Version') })).toBeVisible();
  await page.goto('/consent');
  await expect(page).toHaveURL(/\/$/);
});
