# Anthropic Workload Identity Federation (WIF)

Calling Claude without an API key: an Azure managed identity's Entra token is exchanged for a short-lived
Anthropic token. A second kind of pool entry, next to keys ([key-pool.md](key-pool.md#federations),
[platform-plan.md](platform-plan.md#federated-pool-entries-workload-identity-federation)). **Proven end to end on
2026-11-01** with a throwaway container in Azure (managed identity → Entra → exchange → one Haiku call); the office
adds and checks federated entries since the same day, the kids' app uses them once it draws on the pool.

Anthropic's guide: <https://platform.claude.com/docs/en/manage-claude/wif-providers/azure>. Reference (errors,
env vars, validation): <https://platform.claude.com/docs/en/manage-claude/wif-reference>.

## The chain

- **Azure:** managed identity `id-ai-scratch-anthropic` (user-assigned, `2026-digitalferien`), client ID
  `2e1957f9-8a61-4d62-bf9e-8c609932e374`, object ID `d2e3392b-3640-4f2b-be31-47bafae63d44`. The office's
  provision.sh attaches it next to the web app's system-assigned identity.
- **Entra:** app registration `ai-scratch-anthropic-audience`, app ID `095dcf0d-0152-4de4-82b2-0cf51019cd56`,
  identifier URI `api://<APP_ID>`, v2 tokens, with a service principal. It exists only so Entra issues tokens
  for that audience (without it: `AADSTS50001`/`AADSTS500011`). provision.sh creates both.
- **Anthropic** (Rainer's org `16c29832-2434-4718-a036-07dd4846877c`): issuer `rainer-entra`, rule
  `fdrl_01XiXjNwgFMpW5PXMZ6W6ogq` (`ai-scratch-azure`), service account `svac_01Gi6Kw95sBeRDFT5iVLcc4X`
  (`ai-scratch`, no API key), workspace `wrkspc_01XhRSQeQVSYRQyCVHoVMhtb`. None of these IDs is secret.
- **The service account is Anthropic's side, not Entra's:** Anthropic doesn't know Azure identities; the rule
  maps "this issuer + this `oid`" to a member of the org, which carries the role, the workspaces and the usage.
  It has no key, so the rule is the only way in. Archive the rule to cut access.

## Traps

- **Issuer: maximum token lifetime 25 hours, not 24.** Managed identity tokens carry `exp − iat` = **86,700 s**
  (24 h + 5 min). Anthropic's guide says 86,400, which rejects every token with the opaque
  `401 authentication_error "Authentication failed"`. The **Authentication events** tab in the Console shows the
  real reason.
- **Issuer: JTI replay protection off.** Entra access tokens have no `jti` (they carry `uti`), and Azure hands
  out the same cached token for up to a day, so each re-exchange presents the same JWT.
- **Issuer: choose v2.0** (`https://login.microsoftonline.com/<TENANT_ID>/v2.0`, OIDC discovery). The wizard
  defaults to v1.
- **Rule: "Application (client) ID" is the audience app registration**, not the managed identity's client ID.
  The rule matches the identity's `oid` (= `sub`); the tenant is pinned by the issuer URL. Enable it in one
  workspace, not "all".
- **`az ad app update --set api.requestedAccessTokenVersion=2` fails** on a fresh registration ("Couldn't find
  'api'"); PATCH the application through Microsoft Graph (`az rest`) instead.
- **Where the Entra token comes from:** App Service, Functions and Container Apps use `IDENTITY_ENDPOINT` with
  the `X-IDENTITY-HEADER` header (`api-version=2019-08-01`); IMDS (`169.254.169.254`) only on VMs and Container
  Instances. Pass the identity's `client_id`: our web apps also have a system-assigned identity.
- **Never set `AZURE_CLIENT_ID` on the web app:** the database's `DefaultAzureCredential` would pick the federation
  identity. The office passes the client ID to `ManagedIdentityCredential` itself (`ANTHROPIC_FEDERATION_CLIENT_ID`).

## In the office

- **Settings:** `ANTHROPIC_FEDERATION_AUDIENCE` (`api://<APP_ID>`) switches federation on; without it every
  federated entry is refused with "kein Token". `ANTHROPIC_FEDERATION_CLIENT_ID` picks the managed identity (Azure);
  without it the Azure CLI's login is used (local debugging), in `ANTHROPIC_FEDERATION_TENANT_ID` if your default
  tenant is another. `lib/entra-token.ts`; both credentials cache the token.
- **Every check builds a new client,** so it exchanges once per save. The kids' app should keep one client per
  entry instead: the SDK re-exchanges only shortly before the Anthropic token runs out.
- **e2e:** the fake Anthropic plays App Service's identity endpoint (`IDENTITY_ENDPOINT`, `IDENTITY_HEADER`) and
  the token exchange, so the real `ManagedIdentityCredential` runs in CI.

## Local debugging (your own user)

- **The app registration has a delegated scope `user_impersonation` and pre-authorizes the Azure CLI**
  (`04b07795-8ddb-461a-bbee-02f9e1bf7b46`); provision.sh sets both. Then once:
  `az login --tenant <TENANT_ID> --scope api://<APP_ID>/.default`. A plain `az account get-access-token` keeps
  failing with `AADSTS65001` (no consent) until that login, even after the pre-authorization: the CLI caches the
  refusal.
- **A second rule for your user,** never your user in the Azure rule: in Rainer's org `ai-scratch-local-rainer`
  (`fdrl_017TdN2iqkum4VLSZEtERD6M`), same issuer and audience, matching your user's `oid` claim, target `ai-scratch`,
  Default workspace only (so the office's form can leave service account and workspace empty).
- **For a user, `sub` is not the object ID:** Entra issues a pairwise `sub` per app. (For a managed identity
  `sub` = `oid`.) Guests have the `oid` of their guest object in the tenant, not their home one.
- **The wizard puts the object ID into the subject prefix too:** for a user every exchange then fails with
  `match_subject_prefix` (Authentication events). **Delete the subject prefix** in the rule (Rainer, 2026-11-01:
  it can simply be removed); the required claim `oid = <object ID>` pins the rule to you on its own.
- **The Console's pages:** Keys & access → Workload identity (`/settings/workload-identity-federation`), with the
  tabs Issuers, Rules and Authentication events; a rule's details show its match, required claims and workspaces.
- **User tokens last about 87 minutes** (`exp − iat` ≈ 5,200 s), well under the issuer's 25 h; `azp` is the Azure
  CLI. Then set `ANTHROPIC_FEDERATION_AUDIENCE` (and the tenant) in the office's `.env` and add the entry with your
  local rule's ID: the local database holds local entries only.

## The SDK

- `@anthropic-ai/sdk` 1.3.0: `new Anthropic({ credentials: oidcFederationProvider({ identityTokenProvider,
  federationRuleId, organizationId, serviceAccountId, workspaceId, baseURL, fetch }) })`, imported from
  `@anthropic-ai/sdk/lib/credentials/oidc-federation`. The client caches the Anthropic token and re-exchanges
  before it runs out, calling `identityTokenProvider` again.
- The token is workspace-scoped at the exchange; the `anthropic-workspace-id` header doesn't apply.
- A failed exchange throws `WorkloadIdentityError` (with `statusCode`), not an `APIError`.
- `credentials` excludes `apiKey`; never set `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` in a process that should
  federate, they take precedence over the federation env vars.

## Repeating the spike

A Container Instance with the identity runs a small script: get the Entra token from IMDS
(`resource=api://<APP_ID>`, `client_id=<MI client ID>`), print its claims (never the token), make one
`max_tokens: 1` call through the SDK as above, then delete the container. Use an image from
`mcr.microsoft.com` (e.g. `devcontainers/javascript-node:24-bookworm`): Docker Hub refuses anonymous pulls from
ACI at times (`RegistryErrorResponse`). Read the output with `az container logs --follow`; without `--follow` it
can come back empty.
