// The credentials behind the Anthropic key pool (docs/key-pool.md), shared so the office's check and the kids' calls
// use one implementation: a key as it is, a federation (docs/anthropic-federation.md) as a token that Anthropic
// mints for our Azure identity's Entra token. Server-only.
import { oidcFederationProvider } from '@anthropic-ai/sdk/lib/credentials/oidc-federation';
import { TokenCache } from '@anthropic-ai/sdk/lib/credentials/token-cache';
import type { AccessTokenProvider, IdentityTokenProvider } from '@anthropic-ai/sdk/lib/credentials/types';
import { AzureCliCredential, ManagedIdentityCredential } from '@azure/identity';

export { WorkloadIdentityError } from '@anthropic-ai/sdk/lib/credentials/types';
export type { AccessTokenProvider, IdentityTokenProvider };

type Env = Record<string, string | undefined>;

/** where our Azure identity's token for Anthropic's federation comes from */
export interface FederationEnv {
  /** the app registration the token is issued for, `api://<APP_ID>` */
  audience: string;
  /** the user-assigned managed identity's client ID (Azure); without it, your `az login` (local debugging) */
  clientId?: string;
  /** the Azure CLI's tenant, when your default one is another */
  tenantId?: string;
}

/** undefined when federation isn't set up on this server: federated pool entries can't be used then */
export const loadFederationEnv = (env: Env = process.env): FederationEnv | undefined => {
  const audience = env.ANTHROPIC_FEDERATION_AUDIENCE?.trim();
  if (!audience) return undefined;
  const clientId = env.ANTHROPIC_FEDERATION_CLIENT_ID?.trim();
  const tenantId = env.ANTHROPIC_FEDERATION_TENANT_ID?.trim();
  return { audience, ...(clientId && { clientId }), ...(tenantId && { tenantId }) };
};

/** the Entra token of our Azure identity: the user-assigned managed identity on Azure, your `az login` locally */
export const createEntraTokenProvider = ({ audience, clientId, tenantId }: FederationEnv): IdentityTokenProvider => {
  // the client ID picks the user-assigned identity: without it, App Service hands out the system-assigned one
  const credential = clientId
    ? new ManagedIdentityCredential({ clientId })
    : new AzureCliCredential(tenantId ? { tenantId } : {});
  const scope = `${audience}/.default`;
  // both cache the token until shortly before it runs out
  return async () => (await credential.getToken(scope)).token;
};

/** a federated pool entry: only IDs, none of them secret */
export interface Federation {
  organizationId: string;
  federationRuleId: string;
  serviceAccountId: string | null;
  workspaceId: string | null;
}

/** getting our identity's token failed: no managed identity, no `az login`, or Entra refused */
export class IdentityTokenError extends Error {}

/**
 * Exchanges our identity's token for a workspace-scoped Anthropic token on every call (wrap it in `cachedToken`
 * to keep the token until it runs out). A failure to get our own token throws IdentityTokenError.
 */
export const federationProvider = (
  federation: Federation,
  {
    identityToken,
    baseURL,
    fetch,
  }: { identityToken: IdentityTokenProvider; baseURL: string; fetch: typeof globalThis.fetch },
): AccessTokenProvider =>
  oidcFederationProvider({
    identityTokenProvider: async () => {
      try {
        return await identityToken();
      } catch (cause) {
        throw new IdentityTokenError('getting the identity token failed', { cause });
      }
    },
    organizationId: federation.organizationId,
    federationRuleId: federation.federationRuleId,
    serviceAccountId: federation.serviceAccountId ?? undefined,
    workspaceId: federation.workspaceId ?? undefined,
    baseURL,
    fetch,
  });

/** the token, refreshed shortly before it runs out; concurrent callers share one exchange */
export const cachedToken = (provider: AccessTokenProvider): (() => Promise<string>) => {
  const cache = new TokenCache(provider, (error) =>
    console.error('anthropic: refreshing a federation token failed', error),
  );
  return () => cache.getToken();
};

/** the `anthropic-beta` value a call with an OAuth bearer token (a federation's) must send */
export const OAUTH_BETA = 'oauth-2025-04-20';
