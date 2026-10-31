// Every test (and every extra page) talks to the office from its own client address, like teachers at
// different schools: better-auth's sign-in limit and the registration limits count per IP.
import { type Browser, type BrowserContext, test as base } from '@playwright/test';

let counter = 0;
const nextIp = () => {
  counter++;
  return `10.${process.pid % 250}.${Math.floor(counter / 250) % 250}.${(counter % 250) + 1}`;
};

/** App Service's header for the client's address; only on requests to the office, not to Cloudflare */
export const giveOwnIp = async (context: BrowserContext, baseURL: string) => {
  const ip = nextIp();
  const origin = new URL(baseURL).origin;
  await context.route(
    (url) => url.origin === origin,
    (route) => route.continue({ headers: { ...route.request().headers(), 'x-client-ip': ip } }),
  );
};

export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    await giveOwnIp(context, baseURL ?? '');
    await use(context);
  },
});

/** a second person in the same test (the admin), with an address of their own */
export const newPerson = async (browser: Browser, baseURL: string | undefined) => {
  const context = await browser.newContext({ baseURL });
  await giveOwnIp(context, baseURL ?? '');
  return context.newPage();
};

export { expect } from '@playwright/test';
