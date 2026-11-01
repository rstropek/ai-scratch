// The admin's Anthropic key pool (keys and federations) on an in-memory Postgres (PGlite) with the real migrations,
// and the check against a fake Anthropic (the SDK with a stand-in fetch).
import { randomBytes } from 'node:crypto';
import { createKeyBox, type Database, schema } from '@ai-scratch/db';
import { createTestDb } from '@ai-scratch/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addFederation,
  addKey,
  type Credential,
  createAnthropicKeyChecker,
  deleteKey,
  entryHint,
  type FederationInput,
  getKey,
  type KeyCheck,
  type KeyDeps,
  type KeyInput,
  listKeys,
  updateFederation,
  updateKey,
  validateFederation,
  validateKey,
} from './anthropic-keys.ts';
import { texts } from './texts.ts';

const v = texts.admin.keys.validation;

let db: Database;
let close: () => Promise<void>;
let deps: KeyDeps;
let answer: KeyCheck;
const checked: Credential[] = [];

const ADMIN = 'admin';
const box = createKeyBox(randomBytes(32));

beforeAll(async () => {
  const test = await createTestDb();
  db = test.db;
  close = test.close;
  deps = {
    db,
    box,
    check: async (credential) => {
      checked.push(credential);
      return answer;
    },
  };
  await db.insert(schema.user).values({ id: ADMIN, name: 'Rainer', email: 'rainer@example.com', role: 'admin' });
});
afterAll(() => close());
beforeEach(async () => {
  answer = { ok: true };
  checked.length = 0;
  await db.delete(schema.anthropicKey);
});

let n = 0;
const newKey = () => `sk-ant-api03-${(++n).toString().padStart(4, '0')}abcdefghijklmnop`;

const input = (overrides: Partial<KeyInput> = {}): KeyInput => ({
  donor: 'CoderDojo Linz',
  key: newKey(),
  workspaceId: '',
  capEurMonth: '50',
  priority: '10',
  active: true,
  ...overrides,
});

const stored = async (id: string) => {
  const [row] = await db.select().from(schema.anthropicKey).where(eq(schema.anthropicKey.id, id));
  if (!row) throw new Error(`no key ${id}`);
  return row;
};

const opened = async (id: string) => box.open(id, (await stored(id)).keySealed ?? '');

/** deps whose check passes after deleting the entry, as another tab would while Anthropic answers */
const deletingCheck = (id: string): KeyDeps => ({
  ...deps,
  check: async () => {
    await deleteKey(db, id);
    return { ok: true };
  },
});

const ORG = '16c29832-2434-4718-a036-07dd4846877c';
const RULE = 'fdrl_01XiXjNwgFMpW5PXMZ6W6ogq';
const SERVICE_ACCOUNT = 'svac_01Gi6Kw95sBeRDFT5iVLcc4X';
const WORKSPACE = 'wrkspc_01XhRSQeQVSYRQyCVHoVMhtb';

const federationInput = (overrides: Partial<FederationInput> = {}): FederationInput => ({
  donor: 'Rainer',
  organizationId: ORG,
  federationRuleId: RULE,
  serviceAccountId: SERVICE_ACCOUNT,
  workspaceId: WORKSPACE,
  capEurMonth: '200',
  priority: '100',
  active: true,
  ...overrides,
});

const federationCredential = {
  kind: 'federation',
  organizationId: ORG,
  federationRuleId: RULE,
  serviceAccountId: SERVICE_ACCOUNT,
  workspaceId: WORKSPACE,
} as const;

describe('validateKey', () => {
  it('names every field that is wrong', () => {
    const result = validateKey(
      {
        donor: ' ',
        key: 'sk-ant-admin01-abcdefghijkl',
        workspaceId: 'ws_1',
        capEurMonth: '0',
        priority: '1.5',
        active: true,
      },
      { keyRequired: true },
    );
    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        donor: v.donor(100),
        key: v.adminKey,
        workspaceId: v.workspaceId,
        capEurMonth: v.cap(10_000),
        priority: v.priority(1000),
      },
    });
  });

  it('refuses something that is not an Anthropic key', () => {
    for (const key of ['sk-or-v1-abcdefghijklmnop', 'sk-ant-api03 with spaces', ''])
      expect(validateKey(input({ key }), { keyRequired: true })).toMatchObject({ fieldErrors: { key: v.key } });
  });

  it('lets an edit leave the key empty and trims the rest', () => {
    const result = validateKey(
      input({ key: '', donor: '  Rainer ', workspaceId: ' wrkspc_01XhRSQabcdefMhtb ', capEurMonth: ' 25 ' }),
      { keyRequired: false },
    );
    expect(result).toEqual({
      ok: true,
      value: {
        donor: 'Rainer',
        key: undefined,
        workspaceId: 'wrkspc_01XhRSQabcdefMhtb',
        capEurMonth: 25,
        priority: 10,
        active: true,
      },
    });
  });
});

describe('addKey', () => {
  it('checks the key with Anthropic and stores it sealed, with its hint', async () => {
    const key = newKey();
    const result = await addKey(deps, ADMIN, input({ key, workspaceId: 'wrkspc_01XhRSQabcdefMhtb' }));
    if (!result.ok) throw new Error(JSON.stringify(result));
    expect(checked).toEqual([{ kind: 'key', key, workspaceId: 'wrkspc_01XhRSQabcdefMhtb' }]);
    const row = await stored(result.id);
    expect(row.keySealed).not.toContain(key);
    expect(await opened(result.id)).toBe(key);
    expect(row).toMatchObject({
      kind: 'key',
      keyHint: `…${key.slice(-4)}`,
      donor: 'CoderDojo Linz',
      capEurMonth: 50,
      createdBy: ADMIN,
    });
  });

  it('stores nothing when Anthropic refuses the key', async () => {
    answer = { ok: false, reason: 'rejected', message: 'workspace required' };
    expect(await addKey(deps, ADMIN, input())).toEqual({ ok: false, check: answer });
    expect(await listKeys(db)).toEqual([]);
  });

  it('refuses a key that is in the pool already, without asking Anthropic', async () => {
    const key = newKey();
    await addKey(deps, ADMIN, input({ key }));
    checked.length = 0;
    expect(await addKey(deps, ADMIN, input({ key, donor: 'Someone else' }))).toEqual({
      ok: false,
      fieldErrors: { key: v.duplicate },
    });
    expect(checked).toEqual([]);
  });

  it('refuses a key another save added while Anthropic was checking this one', async () => {
    const key = newKey();
    // the other save wins the race during the check: the unique index refuses this one
    const racing: KeyDeps = {
      ...deps,
      check: async () => {
        const other = await addKey(deps, ADMIN, input({ key, donor: 'Other tab' }));
        if (!other.ok) throw new Error(JSON.stringify(other));
        return { ok: true };
      },
    };
    expect(await addKey(racing, ADMIN, input({ key }))).toEqual({ ok: false, fieldErrors: { key: v.duplicate } });
    expect((await listKeys(db)).map((row) => row.donor)).toEqual(['Other tab']);
  });
});

describe('updateKey', () => {
  const add = async (overrides: Partial<KeyInput> = {}) => {
    const key = overrides.key ?? newKey();
    const result = await addKey(deps, ADMIN, input({ ...overrides, key }));
    if (!result.ok) throw new Error(JSON.stringify(result));
    checked.length = 0;
    return { id: result.id, key };
  };

  it('changes donor, cap, priority and pauses without asking Anthropic', async () => {
    const { id, key } = await add();
    const result = await updateKey(
      deps,
      ADMIN,
      id,
      input({ key: '', donor: 'Rainer', capEurMonth: '20', priority: '1', active: false }),
    );
    expect(result).toEqual({ ok: true, id });
    expect(checked).toEqual([]);
    const row = await stored(id);
    expect(row).toMatchObject({ donor: 'Rainer', capEurMonth: 20, priority: 1, active: false, updatedBy: ADMIN });
    expect(await opened(id)).toBe(key);
  });

  it('checks the stored key again when its workspace changes', async () => {
    const { id, key } = await add();
    answer = { ok: false, reason: 'rejected', message: 'unknown workspace' };
    expect(await updateKey(deps, ADMIN, id, input({ key: '', workspaceId: 'wrkspc_01WrongWorkspace01' }))).toEqual({
      ok: false,
      check: answer,
    });
    expect(checked).toEqual([{ kind: 'key', key, workspaceId: 'wrkspc_01WrongWorkspace01' }]);
    expect((await stored(id)).workspaceId).toBeNull();
  });

  it('replaces the key after checking the new one', async () => {
    const { id } = await add();
    const replacement = newKey();
    expect(await updateKey(deps, ADMIN, id, input({ key: replacement }))).toEqual({ ok: true, id });
    expect(checked).toEqual([{ kind: 'key', key: replacement, workspaceId: null }]);
    expect(await opened(id)).toBe(replacement);
    expect((await stored(id)).keyHint).toBe(`…${replacement.slice(-4)}`);
  });

  it('refuses another key of the pool as the replacement', async () => {
    const first = await add();
    const second = await add();
    expect(await updateKey(deps, ADMIN, second.id, input({ key: first.key }))).toEqual({
      ok: false,
      fieldErrors: { key: v.duplicate },
    });
  });

  it('reports a key that is gone, and a malformed id', async () => {
    expect(await updateKey(deps, ADMIN, crypto.randomUUID(), input({ key: '' }))).toEqual({
      ok: false,
      notFound: true,
    });
    expect(await updateKey(deps, ADMIN, 'not-a-uuid', input({ key: '' }))).toEqual({ ok: false, notFound: true });
  });

  it('reports a key deleted while Anthropic was checking it', async () => {
    const { id } = await add();
    expect(await updateKey(deletingCheck(id), ADMIN, id, input())).toEqual({ ok: false, notFound: true });
  });

  it('leaves a federation alone', async () => {
    const federation = await addFederation(deps, ADMIN, federationInput());
    if (!federation.ok) throw new Error(JSON.stringify(federation));
    expect(await updateKey(deps, ADMIN, federation.id, input())).toEqual({ ok: false, notFound: true });
  });
});

describe('validateFederation', () => {
  it('names every ID that is wrong', () => {
    expect(
      validateFederation(
        federationInput({
          organizationId: 'org-1',
          federationRuleId: 'rule_1',
          serviceAccountId: 'sa',
          workspaceId: 'ws',
        }),
      ),
    ).toEqual({
      ok: false,
      fieldErrors: {
        organizationId: v.organizationId,
        federationRuleId: v.federationRuleId,
        serviceAccountId: v.serviceAccountId,
        workspaceId: v.workspaceId,
      },
    });
  });

  it('trims, and leaves the service account and the workspace optional', () => {
    expect(
      validateFederation(
        federationInput({
          organizationId: ` ${ORG.toUpperCase()} `,
          federationRuleId: ` ${RULE} `,
          serviceAccountId: ' ',
          workspaceId: '',
        }),
      ),
    ).toEqual({
      ok: true,
      value: {
        donor: 'Rainer',
        organizationId: ORG,
        federationRuleId: RULE,
        serviceAccountId: null,
        workspaceId: null,
        capEurMonth: 200,
        priority: 100,
        active: true,
      },
    });
  });
});

describe('addFederation', () => {
  it('checks the federation with Anthropic and stores its IDs, without any key', async () => {
    const result = await addFederation(deps, ADMIN, federationInput());
    if (!result.ok) throw new Error(JSON.stringify(result));
    expect(checked).toEqual([federationCredential]);
    expect(await stored(result.id)).toMatchObject({
      kind: 'federation',
      donor: 'Rainer',
      organizationId: ORG,
      federationRuleId: RULE,
      serviceAccountId: SERVICE_ACCOUNT,
      workspaceId: WORKSPACE,
      keySealed: null,
      keyFingerprint: null,
      keyHint: null,
      createdBy: ADMIN,
    });
    const row = await getKey(db, result.id);
    expect(row && entryHint(row)).toBe('fdrl_…6ogq');
  });

  it('stores nothing when Anthropic refuses the exchange', async () => {
    answer = { ok: false, reason: 'exchange', message: 'Token exchange failed with status 401' };
    expect(await addFederation(deps, ADMIN, federationInput())).toEqual({ ok: false, check: answer });
    expect(await listKeys(db)).toEqual([]);
  });

  it('refuses the same rule for the same workspace, also without one, but not for another workspace', async () => {
    await addFederation(deps, ADMIN, federationInput());
    await addFederation(deps, ADMIN, federationInput({ workspaceId: '' }));
    checked.length = 0;
    const duplicate = { ok: false, fieldErrors: { federationRuleId: v.federationDuplicate } };
    expect(await addFederation(deps, ADMIN, federationInput({ donor: 'again' }))).toEqual(duplicate);
    expect(await addFederation(deps, ADMIN, federationInput({ workspaceId: '' }))).toEqual(duplicate);
    expect(checked).toEqual([]);
    const other = await addFederation(deps, ADMIN, federationInput({ workspaceId: 'wrkspc_01OtherWorkspace99' }));
    expect(other.ok).toBe(true);
  });

  it('refuses a federation another save added while Anthropic was checking this one', async () => {
    const racing: KeyDeps = {
      ...deps,
      check: async () => {
        const other = await addFederation(deps, ADMIN, federationInput({ donor: 'Other tab' }));
        if (!other.ok) throw new Error(JSON.stringify(other));
        return { ok: true };
      },
    };
    expect(await addFederation(racing, ADMIN, federationInput())).toEqual({
      ok: false,
      fieldErrors: { federationRuleId: v.federationDuplicate },
    });
  });
});

describe('updateFederation', () => {
  const add = async () => {
    const result = await addFederation(deps, ADMIN, federationInput());
    if (!result.ok) throw new Error(JSON.stringify(result));
    checked.length = 0;
    return result.id;
  };

  it('changes donor, cap, priority and pauses without asking Anthropic', async () => {
    const id = await add();
    const result = await updateFederation(
      deps,
      ADMIN,
      id,
      federationInput({ donor: 'Rainer S.', capEurMonth: '50', active: false }),
    );
    expect(result).toEqual({ ok: true, id });
    expect(checked).toEqual([]);
    expect(await stored(id)).toMatchObject({ donor: 'Rainer S.', capEurMonth: 50, active: false, updatedBy: ADMIN });
  });

  it('checks again when an ID changes, and keeps the old IDs when Anthropic refuses', async () => {
    const id = await add();
    answer = { ok: false, reason: 'exchange', message: 'no match' };
    expect(await updateFederation(deps, ADMIN, id, federationInput({ serviceAccountId: '' }))).toEqual({
      ok: false,
      check: answer,
    });
    expect(checked).toEqual([{ ...federationCredential, serviceAccountId: null }]);
    expect((await stored(id)).serviceAccountId).toBe(SERVICE_ACCOUNT);
  });

  it('reports a federation deleted while Anthropic was checking it', async () => {
    const id = await add();
    expect(await updateFederation(deletingCheck(id), ADMIN, id, federationInput({ serviceAccountId: '' }))).toEqual({
      ok: false,
      notFound: true,
    });
  });

  it('leaves a key alone, and reports a federation that is gone', async () => {
    const key = await addKey(deps, ADMIN, input());
    if (!key.ok) throw new Error(JSON.stringify(key));
    expect(await updateFederation(deps, ADMIN, key.id, federationInput())).toEqual({ ok: false, notFound: true });
    expect(await updateFederation(deps, ADMIN, crypto.randomUUID(), federationInput())).toEqual({
      ok: false,
      notFound: true,
    });
  });
});

describe('the list and deleting', () => {
  it('lists active keys first, then by priority, then the oldest', async () => {
    const low = await addKey(deps, ADMIN, input({ donor: 'low', priority: '1' }));
    const paused = await addKey(deps, ADMIN, input({ donor: 'paused', priority: '99', active: false }));
    const high = await addKey(deps, ADMIN, input({ donor: 'high', priority: '50' }));
    const alsoLow = await addKey(deps, ADMIN, input({ donor: 'also low', priority: '1' }));
    expect([low, paused, high, alsoLow].every((r) => r.ok)).toBe(true);
    expect((await listKeys(db)).map((key) => key.donor)).toEqual(['high', 'low', 'also low', 'paused']);
  });

  it('never hands out the sealed key or its fingerprint', async () => {
    const result = await addKey(deps, ADMIN, input());
    if (!result.ok) throw new Error('not added');
    const row = await getKey(db, result.id);
    expect(Object.keys(row ?? {})).not.toContain('keySealed');
    expect(Object.keys(row ?? {})).not.toContain('keyFingerprint');
    expect(Object.keys((await listKeys(db))[0] ?? {})).not.toContain('keySealed');
  });

  it('deletes a key once', async () => {
    const result = await addKey(deps, ADMIN, input());
    if (!result.ok) throw new Error('not added');
    expect(await deleteKey(db, result.id)).toBe(true);
    expect(await deleteKey(db, result.id)).toBe(false);
    expect(await deleteKey(db, 'not-a-uuid')).toBe(false);
    expect(await getKey(db, result.id)).toBeUndefined();
  });
});

describe('createAnthropicKeyChecker', () => {
  const requests: Request[] = [];
  const respond = (status: number, body: unknown) => async (url: string | URL | Request, init?: RequestInit) => {
    requests.push(new Request(url, init));
    // a long retry-after: the checker must not wait for it
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', 'retry-after': '600' },
    });
  };
  const error = (type: string, message: string) => ({ type: 'error', error: { type, message } });
  const check = (status: number, body: unknown, workspaceId: string | null = null) =>
    createAnthropicKeyChecker({ baseURL: 'https://anthropic.test', fetch: respond(status, body) as typeof fetch })({
      kind: 'key',
      key: 'sk-ant-api03-test',
      workspaceId,
    });

  beforeEach(() => {
    requests.length = 0;
  });

  it('sends the key, and the workspace when there is one', async () => {
    const message = {
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      content: [],
      model: 'm',
      stop_reason: 'max_tokens',
    };
    expect(await check(200, message, 'wrkspc_01XhRSQabcdefMhtb')).toEqual({ ok: true });
    // SDK 1.x sends the key as a bearer token
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer sk-ant-api03-test');
    expect(requests[0]?.headers.get('anthropic-workspace-id')).toBe('wrkspc_01XhRSQabcdefMhtb');
    await check(200, message);
    expect(requests[1]?.headers.get('anthropic-workspace-id')).toBeNull();
  });

  it('tells an unknown key, a refused one and a rejected call apart', async () => {
    expect(await check(401, error('authentication_error', 'invalid x-api-key'))).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(await check(403, error('permission_error', 'not allowed'))).toMatchObject({
      ok: false,
      reason: 'forbidden',
      message: expect.stringContaining('not allowed'),
    });
    expect(await check(400, error('invalid_request_error', 'Your credit balance is too low'))).toMatchObject({
      ok: false,
      reason: 'rejected',
      message: expect.stringContaining('credit balance'),
    });
    expect(await check(402, error('billing_error', 'Check your billing details'))).toMatchObject({
      ok: false,
      reason: 'rejected',
      message: expect.stringContaining('billing details'),
    });
  });

  it('counts a busy key as working, and an outage as unreachable', async () => {
    expect(await check(429, error('rate_limit_error', 'slow down'))).toEqual({ ok: true });
    expect(requests).toHaveLength(1); // no retry, no sleeping for retry-after
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await check(529, error('overloaded_error', 'overloaded'))).toEqual({ ok: false, reason: 'unreachable' });
    expect(logged).toHaveBeenCalledOnce();
    logged.mockRestore();
  });
});

describe('createAnthropicKeyChecker with a federation', () => {
  const requests: { url: string; headers: Headers; body: string }[] = [];
  const message = {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    content: [],
    model: 'm',
    stop_reason: 'max_tokens',
  };
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  /** the token endpoint answers with `exchange`, the Messages API with 200 */
  const fakeFetch = (exchange: () => Response) =>
    (async (url: string | URL | Request, init?: RequestInit) => {
      const request = new Request(url, init);
      requests.push({ url: request.url, headers: request.headers, body: await request.text() });
      return request.url.endsWith('/v1/oauth/token') ? exchange() : json(200, message);
    }) as typeof fetch;
  const check = (exchange: () => Response, identityToken?: () => Promise<string>) =>
    createAnthropicKeyChecker({
      baseURL: 'https://anthropic.test',
      fetch: fakeFetch(exchange),
      ...(identityToken && { identityToken }),
    })(federationCredential);
  const exchanged = () => json(200, { access_token: 'sk-ant-oat-fake', expires_in: 600, token_type: 'Bearer' });

  beforeEach(() => {
    requests.length = 0;
  });

  it('exchanges the identity token for an Anthropic one, then calls Claude with it', async () => {
    expect(await check(exchanged, async () => 'entra.jwt.token')).toEqual({ ok: true });
    const [exchange, call] = requests;
    expect(exchange?.url).toBe('https://anthropic.test/v1/oauth/token');
    expect(JSON.parse(exchange?.body ?? '')).toEqual({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: 'entra.jwt.token',
      federation_rule_id: RULE,
      organization_id: ORG,
      service_account_id: SERVICE_ACCOUNT,
      workspace_id: WORKSPACE,
    });
    expect(call?.url).toBe('https://anthropic.test/v1/messages');
    expect(call?.headers.get('authorization')).toBe('Bearer sk-ant-oat-fake');
  });

  it("passes on Anthropic's reason when the exchange is refused", async () => {
    const refused = () => json(401, { error: 'invalid_grant', error_description: 'no rule matched' });
    expect(await check(refused, async () => 'entra.jwt.token')).toMatchObject({
      ok: false,
      reason: 'exchange',
      message: expect.stringContaining('401'),
    });
    expect(requests).toHaveLength(1);
  });

  it('reports a missing identity token, and a server without federation, as identity', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      await check(exchanged, async () => {
        throw new Error('az login needed');
      }),
    ).toEqual({ ok: false, reason: 'identity' });
    expect(logged).toHaveBeenCalledOnce();
    logged.mockRestore();
    expect(await check(exchanged)).toEqual({ ok: false, reason: 'identity' });
    expect(requests).toEqual([]);
  });

  it('counts a broken or busy token endpoint as unreachable, not as a refused rule', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const status of [503, 429])
      expect(
        await check(
          () => json(status, { error: 'unavailable' }),
          async () => 'entra.jwt.token',
        ),
      ).toEqual({
        ok: false,
        reason: 'unreachable',
      });
    logged.mockRestore();
  });
});
