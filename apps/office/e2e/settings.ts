import path from 'node:path';

// its own database (compose.yaml creates it, CI's service container too): the setup resets the admin's password
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/aiscratch_e2e';

export const E2E_ADMIN = { email: 'admin@example.com', name: 'E2E Admin', password: 'e2e-admin-password' };

/** the server writes its mails here (MAIL_OUTBOX_DIR); the tests read the links from them */
export const E2E_OUTBOX = path.join(import.meta.dirname, '..', 'mail-outbox', 'e2e');
