// npm run seed:admin: creates Rainer's admin account, or gives it the role and a new password. Asks for the password.
// The database comes from the environment (.env, or PGHOST/PGDATABASE/PGUSER for Azure with your `az login`).
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { createDb, createPool } from '@ai-scratch/db';
import { ADMIN_EMAIL, ensureAdmin } from '../lib/admin-seed.ts';
import { createAuth, throwawaySecret } from '../lib/auth.ts';

// readline echoes what is typed; this output swallows it while the password is entered
let muted = false;
const output = new Writable({
  write(chunk, encoding, done) {
    if (!muted) stdout.write(chunk, encoding);
    done();
  },
});
const rl = createInterface({ input: stdin, output, terminal: stdin.isTTY });
// an iterator keeps lines that arrive early (piped input), unlike rl.question()
const lines = rl[Symbol.asyncIterator]();
const ask = async (question: string, hidden = false) => {
  stdout.write(question);
  muted = hidden;
  const { value } = await lines.next();
  muted = false;
  if (hidden) stdout.write('\n');
  const line = String(value ?? '');
  return hidden ? line : line.trim();
};

const email = (await ask(`E-Mail [${ADMIN_EMAIL}]: `)) || ADMIN_EMAIL;
const name = (await ask('Name [Rainer Stropek]: ')) || 'Rainer Stropek';
const password = await ask('Passwort: ', true);
if ((await ask('Passwort wiederholen: ', true)) !== password) throw new Error('The passwords differ');
rl.close();

const pool = createPool();
try {
  const auth = createAuth({
    db: createDb(pool),
    secret: throwawaySecret(),
    baseURL: 'http://localhost',
  });
  console.log(`${email}: ${await ensureAdmin(auth, { email, name, password })}`);
} finally {
  await pool.end();
}
