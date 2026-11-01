import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createKeyBox, parseMasterKey } from './key-box.ts';

const master = randomBytes(32);
const box = createKeyBox(master);
const KEY = 'sk-ant-api03-example-key';

describe('key box', () => {
  it('opens what it sealed, for the same row', () => {
    const sealed = box.seal('row-1', KEY);
    expect(sealed).not.toContain(KEY);
    expect(sealed.startsWith('v1:')).toBe(true);
    expect(box.open('row-1', sealed)).toBe(KEY);
  });

  it('seals the same key differently each time', () => {
    expect(box.seal('row-1', KEY)).not.toBe(box.seal('row-1', KEY));
  });

  it('refuses a sealed key copied onto another row', () => {
    expect(() => box.open('row-2', box.seal('row-1', KEY))).toThrow();
  });

  it('refuses a tampered or foreign sealed key', () => {
    const sealed = box.seal('row-1', KEY);
    const flipped = `${sealed.slice(0, -2)}${sealed.at(-2) === 'A' ? 'B' : 'A'}${sealed.at(-1)}`;
    expect(() => box.open('row-1', flipped)).toThrow();
    expect(() => createKeyBox(randomBytes(32)).open('row-1', sealed)).toThrow();
    expect(() => box.open('row-1', 'v2:abc')).toThrow();
  });

  it('fingerprints a key the same way every time, and differently under another master key', () => {
    expect(box.fingerprint(KEY)).toBe(createKeyBox(master).fingerprint(KEY));
    expect(box.fingerprint(KEY)).not.toBe(box.fingerprint(`${KEY}x`));
    expect(createKeyBox(randomBytes(32)).fingerprint(KEY)).not.toBe(box.fingerprint(KEY));
  });
});

describe('parseMasterKey', () => {
  it('takes 32 bytes in base64', () => {
    expect(parseMasterKey({ KEY_ENCRYPTION_KEY: master.toString('base64') }).equals(master)).toBe(true);
  });

  it('refuses a missing, short or unresolved key', () => {
    expect(() => parseMasterKey({})).toThrow(/KEY_ENCRYPTION_KEY/);
    expect(() => parseMasterKey({ KEY_ENCRYPTION_KEY: randomBytes(16).toString('base64') })).toThrow(/32 bytes/);
    expect(() =>
      parseMasterKey({ KEY_ENCRYPTION_KEY: '@Microsoft.KeyVault(VaultName=kv;SecretName=key-encryption-key)' }),
    ).toThrow(/Key Vault/);
  });
});
