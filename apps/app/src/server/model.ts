// The model for a request, by who pays (access.ts): a pool entry of the free budget (a key, or a federation's token
// for our Azure identity), the code owner's own OpenRouter key (OpenRouter's Anthropic-compatible Messages API: the
// same SDK, provider options, prompt caching and signed thinking, only another base URL, the key as Bearer token
// and OpenRouter's model name), or ANTHROPIC_API_KEY for test codes. After each call its usage is written.

import {
  cachedToken,
  federationProvider,
  type IdentityTokenProvider,
  OAUTH_BETA,
  WorkloadIdentityError,
} from '@ai-scratch/anthropic';
import type { KeyBox, PoolEntry, Tokens } from '@ai-scratch/db';
import { createAnthropic } from '@ai-sdk/anthropic';
import { APICallError, type LanguageModel, RetryError } from 'ai';
import type { Context } from 'hono';
import { type Access, type AppEnv, type KeyProblem, type Route, refusedFor, TRY_AGAIN, UNAVAILABLE } from './access.ts';
import type { ChatDeps } from './chat.ts';
import type { Config } from './config.ts';
import type { AnthropicUsage } from './cost.ts';
import { recordCall } from './stats.ts';
import { type CallContext, type CallRecord, createLoggingFetch } from './wire-log.ts';

type Made = { ok: true; model: LanguageModel } | { ok: false; status: 503; error: string };

export interface Models {
  create(route: Route, access: Access, fetch: typeof globalThis.fetch): Promise<Made>;
}

/** Without `identityToken` (no ANTHROPIC_FEDERATION_AUDIENCE here) federated entries can't be used. */
export const createModels = ({
  config,
  box,
  identityToken,
  baseFetch = fetch,
  entryOf,
  refuse,
}: {
  config: Config;
  box: KeyBox | undefined;
  identityToken: IdentityTokenProvider | undefined;
  /** for the federation's token exchange */
  baseFetch?: typeof fetch;
  /** the snapshot's pool entry a route names (budget.ts) */
  entryOf: (entryId: string) => PoolEntry | undefined;
  /** marks a pool entry refused (budget.ts) */
  refuse: (entryId: string, reason: string) => void;
}): Models => {
  const anthropicUrl = `${config.anthropicBaseUrl}/v1`;
  /** one token source per federated entry, kept for the process; a changed rule gets a new one */
  const federations = new Map<string, () => Promise<string>>();
  const federationToken = (entry: PoolEntry, identity: IdentityTokenProvider) => {
    const id = [
      entry.id,
      entry.organizationId,
      entry.federationRuleId,
      entry.serviceAccountId,
      entry.workspaceId,
    ].join();
    let token = federations.get(id);
    if (!token) {
      token = cachedToken(
        federationProvider(
          {
            organizationId: entry.organizationId ?? '',
            federationRuleId: entry.federationRuleId ?? '',
            serviceAccountId: entry.serviceAccountId,
            workspaceId: entry.workspaceId,
          },
          { identityToken: identity, baseURL: config.anthropicBaseUrl, fetch: baseFetch },
        ),
      );
      federations.set(id, token);
    }
    return token();
  };

  const poolModel = async (entry: PoolEntry, fetch: typeof globalThis.fetch): Promise<Made> => {
    if (entry.kind === 'key') {
      if (!box || !entry.keySealed) throw new Error('pool: a key entry without its sealed key or KEY_ENCRYPTION_KEY');
      return {
        ok: true,
        model: createAnthropic({
          baseURL: anthropicUrl,
          apiKey: box.open(entry.id, entry.keySealed),
          headers: entry.workspaceId ? { 'anthropic-workspace-id': entry.workspaceId } : {},
          fetch,
        })(config.model),
      };
    }
    if (!identityToken) {
      console.error(`pool: entry ${entry.id} is a federation, but ANTHROPIC_FEDERATION_AUDIENCE isn't set`);
      return { ok: false, status: 503, error: UNAVAILABLE };
    }
    try {
      const authToken = await federationToken(entry, identityToken);
      return {
        ok: true,
        model: createAnthropic({ baseURL: anthropicUrl, authToken, headers: { 'anthropic-beta': OAUTH_BETA }, fetch })(
          config.model,
        ),
      };
    } catch (error) {
      // the donor's rule refuses our identity: the entry is skipped from now on; anything else may pass
      if (
        error instanceof WorkloadIdentityError &&
        error.statusCode &&
        error.statusCode < 500 &&
        error.statusCode !== 429
      ) {
        refuse(entry.id, error.message);
        return { ok: false, status: 503, error: TRY_AGAIN };
      }
      console.error(`pool: no federation token for entry ${entry.id}`, error);
      return { ok: false, status: 503, error: UNAVAILABLE };
    }
  };

  return {
    create: async (route, access, fetch) => {
      if (route.kind === 'test')
        return {
          ok: true,
          model: createAnthropic({
            baseURL: anthropicUrl,
            apiKey: config.anthropicApiKey,
            headers: config.anthropicWorkspaceId ? { 'anthropic-workspace-id': config.anthropicWorkspaceId } : {},
            fetch,
          })(config.model),
        };
      if (access.kind !== 'code') throw new Error('model: a code route without a code');
      const { grant } = access;
      if (route.kind === 'openrouter') {
        if (!box || !grant.keySealed || !grant.openrouterKeyId)
          throw new Error('model: an own-key code without its sealed key or KEY_ENCRYPTION_KEY');
        const key = box.open(grant.openrouterKeyId, grant.keySealed);
        return {
          ok: true,
          model: createAnthropic({ baseURL: config.openRouterUrl, authToken: key, fetch })(config.openRouterModel),
        };
      }
      const entry = entryOf(route.entryId);
      if (!entry) return { ok: false, status: 503, error: TRY_AGAIN };
      return poolModel(entry, fetch);
    },
  };
};

const apiErrorOf = (e: unknown): APICallError | undefined => {
  if (APICallError.isInstance(e)) return e;
  if (RetryError.isInstance(e)) return apiErrorOf(e.lastError);
  return undefined;
};

/** where OpenRouter says a spent budget came from (error.metadata.limit_source) */
const limitSourceOf = (body: string | undefined): string | undefined => {
  try {
    const source = JSON.parse(body ?? '')?.error?.metadata?.limit_source;
    return typeof source === 'string' ? source : undefined;
  } catch {
    return undefined;
  }
};

/** OpenRouter answers 402 without credits and 403 with a `limit_source` for a spent key, guardrail or workspace budget (a 403 for moderation has none); a 402 for requests in flight is temporary */
const keyProblemOf = (api: APICallError | undefined): KeyProblem | undefined => {
  const source = limitSourceOf(api?.responseBody);
  if ((api?.statusCode === 402 && source !== 'openrouter_in_flight_budget') || (api?.statusCode === 403 && source))
    return 'empty';
  return api?.statusCode === 401 ? 'invalid' : undefined;
};

/** Anthropic refuses the entry itself: a bad key, billing, a spend limit, no permission, no credit left */
const entryRefused = (api: APICallError | undefined): boolean =>
  api?.statusCode === 401 ||
  api?.statusCode === 402 ||
  api?.statusCode === 403 ||
  (api?.statusCode === 400 && /credit balance/i.test(api.responseBody ?? ''));

export type CallRefusal = { status: 402 | 403 | 503; error: string };

/**
 * A model call failed because of who pays: German text for the kid (and the status for a JSON answer), or
 * undefined for any other error. A refused pool entry is skipped from now on; a refused own key for a minute.
 */
export const callRefusal = (
  e: unknown,
  route: Route,
  access: Access,
  { budget, refusedKeys }: Pick<ChatDeps, 'budget' | 'refusedKeys'>,
): CallRefusal | undefined => {
  const api = apiErrorOf(e);
  if (route.kind === 'pool' && entryRefused(api)) {
    budget?.refuse(route.entryId, `${api?.statusCode}: ${(api?.responseBody ?? api?.message ?? '').slice(0, 300)}`);
    return { status: 503, error: TRY_AGAIN };
  }
  if (route.kind !== 'openrouter' || access.kind !== 'code') return undefined;
  const problem = keyProblemOf(api);
  if (!problem) return undefined;
  if (access.grant.openrouterKeyId) refusedKeys.set(access.grant.openrouterKeyId, problem);
  return refusedFor(`key-${problem}`, access.grant, new Date());
};

/** a call's tokens; a cut call (the kid's "Stopp", a closed tab, the output guard) has no final usage: it counts as its max_tokens */
export const tokensOf = (record: Pick<CallRecord, 'request' | 'aborted'>, usage: AnthropicUsage): Tokens => {
  const maxTokens = typeof record.request.max_tokens === 'number' ? record.request.max_tokens : 0;
  const output = usage.output_tokens ?? 0;
  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: record.aborted ? Math.max(output, maxTokens) : output,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
  };
};

/**
 * The model for a request with its call log and usage, and what a refusal means for the kid. /api/stats counts the
 * pool's and the test codes' calls: own OpenRouter keys are their owners' money.
 */
export const requestModel = async (
  c: Context<AppEnv>,
  deps: Pick<ChatDeps, 'sink' | 'stats' | 'budget' | 'refusedKeys' | 'models' | 'fetch'>,
  ctx: CallContext,
): Promise<
  { ok: true; model: LanguageModel; refusal: (e: unknown) => CallRefusal | undefined } | Exclude<Made, { ok: true }>
> => {
  const access = c.get('access');
  const route = c.get('route');
  const fetch = createLoggingFetch(
    deps.sink,
    ctx,
    (record, usage, ok) => {
      if (route.kind !== 'openrouter') recordCall(deps.stats, usage, ok);
      if (ok && access.kind === 'code')
        deps.budget?.record(access.grant, route.kind === 'pool' ? route.entryId : null, tokensOf(record, usage));
    },
    deps.fetch,
  );
  const made = await deps.models.create(route, access, fetch);
  if (!made.ok) return made;
  return { ok: true, model: made.model, refusal: (e) => callRefusal(e, route, access, deps) };
};
