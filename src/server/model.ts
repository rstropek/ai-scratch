// The model for a request. School codes use Anthropic directly with Rainer's key (workspace header). A
// parent's own key goes through OpenRouter's Anthropic-compatible Messages API: the same SDK, provider
// options, prompt caching and signed thinking, only another base URL, the key as Bearer token and
// OpenRouter's model name.
import { createAnthropic } from '@ai-sdk/anthropic';
import { APICallError, type LanguageModel, RetryError } from 'ai';
import type { Context } from 'hono';
import type { KeyProblem } from '../shared/access.ts';
import { BUDGET_EMPTY, type Credential, credentialOf, type KeyChecker } from './access.ts';
import type { ChatDeps } from './chat.ts';
import type { Config } from './config.ts';
import { recordCall } from './stats.ts';
import { type CallContext, createLoggingFetch } from './wire-log.ts';

export const modelFor = (config: Config, credential: Credential, fetch: typeof globalThis.fetch): LanguageModel =>
  credential.kind === 'openrouter'
    ? createAnthropic({ baseURL: config.openRouterUrl, authToken: credential.key, fetch })(config.openRouterModel)
    : createAnthropic({
        apiKey: config.anthropicApiKey,
        headers: config.anthropicWorkspaceId ? { 'anthropic-workspace-id': config.anthropicWorkspaceId } : {},
        fetch,
      })(config.model);

export const KEY_INVALID = 'Dieser OpenRouter-Schlüssel gilt nicht mehr. Frag deine Eltern nach einem gültigen.';

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

/**
 * A model call refused because of the parent's key: German text for the kid (and the status for a JSON
 * answer), or undefined for any other error. OpenRouter answers 402 without credits and 403 with a
 * `limit_source` for a spent key, guardrail or workspace budget (a 403 for moderation has none); a 402 for
 * requests in flight is temporary. The key checker then refuses the key for a while.
 */
export const keyRefusal = (
  e: unknown,
  credential: Credential,
  keys: KeyChecker,
): { status: 401 | 402; error: string } | undefined => {
  if (credential.kind !== 'openrouter') return undefined;
  const api = apiErrorOf(e);
  const source = limitSourceOf(api?.responseBody);
  const problem: KeyProblem | undefined =
    (api?.statusCode === 402 && source !== 'openrouter_in_flight_budget') || (api?.statusCode === 403 && source)
      ? 'empty'
      : api?.statusCode === 401
        ? 'unknown'
        : undefined;
  if (!problem) return undefined;
  keys.refuse(credential.key, problem);
  return problem === 'empty' ? { status: 402, error: BUDGET_EMPTY } : { status: 401, error: KEY_INVALID };
};

/**
 * The model for a request with its call log, and what a refused key means for the kid. Only school codes
 * count in /api/stats: parents pay OpenRouter themselves, the stats watch Rainer's Anthropic budget.
 */
export const requestModel = (
  c: Context,
  { config, sink, stats, keys, fetch }: Pick<ChatDeps, 'config' | 'sink' | 'stats' | 'keys' | 'fetch'>,
  ctx: CallContext,
): { model: LanguageModel; refusal: (e: unknown) => ReturnType<typeof keyRefusal> } => {
  const credential = credentialOf(c);
  const count = credential.kind === 'school' ? recordCall : () => {};
  return {
    model: modelFor(
      config,
      credential,
      createLoggingFetch(sink, ctx, (_record, usage, ok) => count(stats, usage, ok), fetch),
    ),
    refusal: (e) => keyRefusal(e, credential, keys),
  };
};
