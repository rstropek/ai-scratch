// Provider API keys at rest: AES-256-GCM under KEY_ENCRYPTION_KEY, the one master key both apps read (the office
// stores keys, the kids' app uses them). The row's id goes in as associated data, so a sealed key copied onto
// another row doesn't open.
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';

type Env = Record<string, string | undefined>;

const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface KeyBox {
  seal: (rowId: string, plain: string) => string;
  open: (rowId: string, sealed: string) => string;
  /** a stable fingerprint that can't be turned back into the key: finds a key that was added twice */
  fingerprint: (plain: string) => string;
}

/** the master key: 32 random bytes, base64 (`openssl rand -base64 32`) */
export const parseMasterKey = (env: Env = process.env): Buffer => {
  const value = env.KEY_ENCRYPTION_KEY?.trim();
  if (!value) throw new Error('Missing environment variable KEY_ENCRYPTION_KEY');
  if (value.startsWith('@Microsoft.KeyVault('))
    throw new Error('KEY_ENCRYPTION_KEY is an unresolved Key Vault reference: check the vault and the app access');
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('KEY_ENCRYPTION_KEY must be 32 bytes, base64 (openssl rand -base64 32)');
  return key;
};

const derive = (master: Buffer, purpose: 'seal' | 'fingerprint') =>
  Buffer.from(hkdfSync('sha256', master, 'ai-scratch-keys', purpose, 32));

export const createKeyBox = (master: Buffer): KeyBox => {
  const sealKey = derive(master, 'seal');
  const fingerprintKey = derive(master, 'fingerprint');
  return {
    seal: (rowId, plain) => {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv('aes-256-gcm', sealKey, iv);
      cipher.setAAD(Buffer.from(rowId, 'utf8'));
      const sealed = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
      return `${VERSION}:${Buffer.concat([iv, sealed, cipher.getAuthTag()]).toString('base64url')}`;
    },
    open: (rowId, sealed) => {
      const [version, body] = sealed.split(':');
      if (version !== VERSION || !body) throw new Error('Unknown sealed key format');
      const raw = Buffer.from(body, 'base64url');
      if (raw.length <= IV_BYTES + TAG_BYTES) throw new Error('Sealed key too short');
      const decipher = createDecipheriv('aes-256-gcm', sealKey, raw.subarray(0, IV_BYTES));
      decipher.setAAD(Buffer.from(rowId, 'utf8'));
      decipher.setAuthTag(raw.subarray(raw.length - TAG_BYTES));
      return Buffer.concat([
        decipher.update(raw.subarray(IV_BYTES, raw.length - TAG_BYTES)),
        decipher.final(),
      ]).toString('utf8');
    },
    fingerprint: (plain) => createHmac('sha256', fingerprintKey).update(plain).digest('base64url'),
  };
};
