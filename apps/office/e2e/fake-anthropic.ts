// A stand-in for api.anthropic.com in the e2e tests (the office's ANTHROPIC_BASE_URL): it answers the key check
// by how the key starts, so no test spends money or needs a real key. Only the prefix counts: the tests' keys
// end in random text, which could contain these words.
//   sk-ant-bad-…   unknown key (401)
//   sk-ant-usr-…   a personal key: needs an anthropic-workspace-id header (400 without)
//   anything else works
// It also stands in for a federation: App Service's identity endpoint (the office's IDENTITY_ENDPOINT) hands out a
// fake Entra token, and the token exchange swaps it for an Anthropic token unless the rule starts with fdrl_bad.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

export const FAKE_ANTHROPIC_PORT = 3121;

/** what the office's environment points at, for its federated check */
export const FAKE_IDENTITY = {
  endpoint: `http://127.0.0.1:${FAKE_ANTHROPIC_PORT}/identity`,
  header: 'e2e-identity-header',
  audience: 'api://e2e-audience',
  clientId: 'e2e-managed-identity',
};

/** an unsigned JWT: nobody here checks the signature */
const FAKE_ENTRA_TOKEN = [{ alg: 'none' }, { aud: FAKE_IDENTITY.audience, oid: 'e2e-oid' }, {}]
  .map((part) => Buffer.from(JSON.stringify(part)).toString('base64url'))
  .join('.');
const FAKE_ANTHROPIC_TOKEN = 'sk-ant-oat01-e2e-federated';

const bodyOf = async (req: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString();
};

const send = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

const error = (type: string, message: string) => ({ type: 'error', error: { type, message } });

if (import.meta.main) {
  createServer(async (req, res) => {
    if (req.url === '/healthz') return send(res, 200, { ok: true });
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/identity') {
      const asked =
        req.headers['x-identity-header'] === FAKE_IDENTITY.header &&
        url.searchParams.get('resource') === FAKE_IDENTITY.audience &&
        url.searchParams.get('client_id') === FAKE_IDENTITY.clientId;
      if (!asked) return send(res, 400, { error: 'invalid_request', error_description: 'wrong identity request' });
      return send(res, 200, {
        access_token: FAKE_ENTRA_TOKEN,
        expires_on: String(Math.floor(Date.now() / 1000) + 86_700),
        resource: FAKE_IDENTITY.audience,
        token_type: 'Bearer',
        client_id: FAKE_IDENTITY.clientId,
      });
    }
    if (req.method === 'POST' && url.pathname === '/v1/oauth/token') {
      const { assertion, federation_rule_id: rule } = JSON.parse(await bodyOf(req)) as Record<string, string>;
      if (assertion !== FAKE_ENTRA_TOKEN || String(rule).startsWith('fdrl_bad'))
        return send(res, 401, { error: 'invalid_grant', error_description: 'Authentication failed' });
      return send(res, 200, { access_token: FAKE_ANTHROPIC_TOKEN, expires_in: 600, token_type: 'Bearer' });
    }
    if (req.method !== 'POST' || url.pathname !== '/v1/messages') return send(res, 404, error('not_found_error', 'no'));
    const key = (req.headers.authorization ?? '').replace(/^Bearer /, '') || String(req.headers['x-api-key'] ?? '');
    if (key.startsWith('sk-ant-bad-')) return send(res, 401, error('authentication_error', 'invalid x-api-key'));
    if (key.startsWith('sk-ant-usr-') && !req.headers['anthropic-workspace-id'])
      return send(res, 400, error('invalid_request_error', 'anthropic-workspace-id header is required for this key'));
    send(res, 200, {
      id: 'msg_fake',
      type: 'message',
      role: 'assistant',
      model: 'claude-haiku-5-5',
      content: [],
      stop_reason: 'max_tokens',
      usage: { input_tokens: 8, output_tokens: 1 },
    });
  }).listen(FAKE_ANTHROPIC_PORT, '127.0.0.1');
}
