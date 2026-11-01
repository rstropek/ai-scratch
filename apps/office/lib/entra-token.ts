// The Entra token of the office's Azure identity, for Anthropic's federation (docs/anthropic-federation.md): the
// user-assigned managed identity on Azure, your `az login` on your machine (local debugging). Server-only.
import type { IdentityTokenProvider } from '@anthropic-ai/sdk/lib/credentials/types';
import { AzureCliCredential, ManagedIdentityCredential } from '@azure/identity';
import type { FederationEnv } from './env.ts';

export const createEntraTokenProvider = ({ audience, clientId, tenantId }: FederationEnv): IdentityTokenProvider => {
  // the client ID picks the user-assigned identity: without it, App Service hands out the system-assigned one
  const credential = clientId
    ? new ManagedIdentityCredential({ clientId })
    : new AzureCliCredential(tenantId ? { tenantId } : {});
  const scope = `${audience}/.default`;
  // both cache the token until shortly before it runs out
  return async () => (await credential.getToken(scope)).token;
};
