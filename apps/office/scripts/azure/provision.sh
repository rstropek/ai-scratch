#!/usr/bin/env bash
# Creates (or updates) the office's Azure resources: the Postgres server (shared with the kids' app later), the
# database with an Entra role for the web app's managed identity, the web app on the existing P0v3 plan (no staging
# slot: CI deploys straight to production), its Key Vault secrets and app settings, and the Azure side of Anthropic's
# federation (docs/anthropic-federation.md). Safe to re-run. The image is set by the deploy workflow.
# Usage: apps/office/scripts/azure/provision.sh   (needs `az login` with Owner on the subscription, and Node)
set -euo pipefail

SUBSCRIPTION="Microsoft Azure Sponsorship"
RG="2026-digitalferien"
# westeurope and germanywestcentral refuse new Postgres servers for this subscription (docs/deployment.md)
DB_LOCATION="northeurope"
DB_SERVER="ai-scratch-db"
DB_HOST="$DB_SERVER.postgres.database.azure.com"
APP="ai-scratch-office"
DATABASE="aiscratch"
ROLE="$APP" # the database role of the web app's managed identity
URL="https://office.ai-scratch.dev"
PLAN_ID="/subscriptions/$(az account show -s "$SUBSCRIPTION" --query id -o tsv)/resourceGroups/ts-web-playground/providers/Microsoft.Web/serverfarms/ts-web-playground"
KV="kv-digiferien"
ACR="acrars2025"
PLACEHOLDER_IMAGE="mcr.microsoft.com/appsvc/staticsite:latest"
# the Turnstile widget of office.ai-scratch.dev (public; its secret is turnstile-secret-key in the vault)
TURNSTILE_SITE_KEY="0x4AAAAAAFt9P51346HQ8eXj"
REPO="$(cd "$(dirname "$0")/../../../.." && pwd)"
# Anthropic's federation: the app registration our tokens are issued for, and the user-assigned identity the pool's
# federation rules trust (the kids' app gets the same one when it uses the pool)
FED_APP_NAME="ai-scratch-anthropic-audience"
FED_IDENTITY="id-ai-scratch-anthropic"
AZURE_CLI_APP_ID="04b07795-8ddb-461a-bbee-02f9e1bf7b46" # Microsoft's public client ID of the Azure CLI

az account set -s "$SUBSCRIPTION"
log() { echo "==> $*"; }

# Role assignments take a while to propagate; retries a data-plane command for up to two minutes.
retry() {
  for _ in $(seq 12); do
    if "$@" 2>/dev/null; then return 0; fi
    sleep 10
  done
  "$@"
}

assign() { # principal, role, scope
  az role assignment create --assignee-object-id "$1" --assignee-principal-type "${4:-ServicePrincipal}" \
    --role "$2" --scope "$3" -o none
}

# SQL from stdin as you (the server's Entra admin), with an Entra token from your az login
sql() { # database
  PGHOST="$DB_HOST" PGDATABASE="$1" PGUSER="$ME_UPN" node "$REPO/packages/db/src/sql-cli.ts"
}

ME_ID=$(az ad signed-in-user show --query id -o tsv)
ME_UPN=$(az ad signed-in-user show --query userPrincipalName -o tsv)

log "Postgres server $DB_SERVER ($DB_LOCATION, Burstable B1ms, 32 GiB)"
if ! az postgres flexible-server show -g "$RG" -n "$DB_SERVER" -o none 2>/dev/null; then
  az postgres flexible-server create -g "$RG" -n "$DB_SERVER" -l "$DB_LOCATION" --version 17 \
    --tier Burstable --sku-name Standard_B1ms --storage-size 32 --backup-retention 7 \
    --microsoft-entra-auth Enabled --password-auth Disabled \
    --admin-object-id "$ME_ID" --admin-display-name "$ME_UPN" --admin-type User \
    --public-access 0.0.0.0 --yes -o none
fi
# public endpoint (TLS), but only the firewall's addresses get in
az postgres flexible-server update -g "$RG" -n "$DB_SERVER" --public-access Enabled -o none
# no VNet: Azure services may connect (they still need an Entra role), plus the machine running this script
az postgres flexible-server firewall-rule create -g "$RG" -s "$DB_SERVER" -n azure-services \
  --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 -o none
MY_IP=$(curl -sf https://api.ipify.org)
az postgres flexible-server firewall-rule create -g "$RG" -s "$DB_SERVER" -n admin-workstation \
  --start-ip-address "$MY_IP" --end-ip-address "$MY_IP" -o none

KV_ID=$(az keyvault show -g "$RG" -n "$KV" --query id -o tsv)
# uploaded by apps/app/scripts/azure/provision.sh (resend-api-key, jev-api-key) and by hand (turnstile-secret-key)
for secret in resend-api-key jev-api-key turnstile-secret-key; do
  az keyvault secret show --vault-name "$KV" -n "$secret" --query name -o none ||
    { echo "Missing Key Vault secret $secret (docs/deployment.md)" >&2; exit 1; }
done
if ! az keyvault secret show --vault-name "$KV" -n office-auth-secret -o none 2>/dev/null; then
  log "Secret office-auth-secret"
  az keyvault secret set --vault-name "$KV" -n office-auth-secret --file <(openssl rand -base64 32) -o none
fi
# seals the Anthropic key pool in the database; the kids' app reads it too. Created once and never replaced: a new
# value makes every stored key unreadable (docs/key-pool.md)
if ! az keyvault secret show --vault-name "$KV" -n key-encryption-key -o none 2>/dev/null; then
  log "Secret key-encryption-key"
  az keyvault secret set --vault-name "$KV" -n key-encryption-key --file <(openssl rand -base64 32) -o none
fi

log "Anthropic federation: app registration $FED_APP_NAME, identity $FED_IDENTITY"
FED_APP_ID=$(az ad app list --display-name "$FED_APP_NAME" --query "[0].appId" -o tsv)
if [ -z "$FED_APP_ID" ]; then
  FED_APP_ID=$(az ad app create --display-name "$FED_APP_NAME" --sign-in-audience AzureADMyOrg --query appId -o tsv)
fi
FED_APP_OBJECT=$(az ad app show --id "$FED_APP_ID" --query id -o tsv)
# a delegated scope with the Azure CLI pre-authorized: `az login --scope api://<APP_ID>/.default` then gets you a
# token for local debugging. The scope keeps its ID across runs (Graph refuses to replace an enabled one)
FED_SCOPE_ID=$(az ad app show --id "$FED_APP_ID" \
  --query "api.oauth2PermissionScopes[?value=='user_impersonation'].id | [0]" -o tsv)
# a new GUID from openssl (needed above anyway), so the script also runs on macOS
FED_SCOPE_ID=${FED_SCOPE_ID:-$(openssl rand -hex 16 | sed -E 's/(.{8})(.{4})(.{4})(.{4})(.{12})/\1-\2-\3-\4-\5/')}
graph_patch() { # body
  az rest --method PATCH --url "https://graph.microsoft.com/v1.0/applications/$FED_APP_OBJECT" \
    --headers "Content-Type=application/json" --body "$1" -o none
}
# `az ad app update --set api.…` fails on a fresh registration ("Couldn't find 'api'"); Graph takes it. v2 tokens:
# the issuer registered at Anthropic is the v2.0 one
graph_patch "{\"identifierUris\": [\"api://$FED_APP_ID\"], \"api\": {\"requestedAccessTokenVersion\": 2,
  \"oauth2PermissionScopes\": [{\"id\": \"$FED_SCOPE_ID\", \"value\": \"user_impersonation\", \"type\": \"User\",
    \"isEnabled\": true, \"adminConsentDisplayName\": \"Call Claude via Anthropic federation\",
    \"adminConsentDescription\": \"Get a token for the Anthropic federation audience (local debugging).\",
    \"userConsentDisplayName\": \"Call Claude via Anthropic federation\",
    \"userConsentDescription\": \"Get a token for the Anthropic federation audience (local debugging).\"}]}}"
# a separate call: Graph refuses to pre-authorize a scope that the same request creates
graph_patch "{\"api\": {\"preAuthorizedApplications\": [{\"appId\": \"$AZURE_CLI_APP_ID\",
  \"delegatedPermissionIds\": [\"$FED_SCOPE_ID\"]}]}}"
az ad sp show --id "$FED_APP_ID" -o none 2>/dev/null || az ad sp create --id "$FED_APP_ID" -o none
az identity show -g "$RG" -n "$FED_IDENTITY" -o none 2>/dev/null || az identity create -g "$RG" -n "$FED_IDENTITY" -o none
FED_IDENTITY_ID=$(az identity show -g "$RG" -n "$FED_IDENTITY" --query id -o tsv)
FED_CLIENT_ID=$(az identity show -g "$RG" -n "$FED_IDENTITY" --query clientId -o tsv)

log "Web app $APP (plan ts-web-playground)"
if ! az webapp show -g "$RG" -n "$APP" -o none 2>/dev/null; then
  az webapp create -g "$RG" -p "$PLAN_ID" -n "$APP" --container-image-name "$PLACEHOLDER_IMAGE" \
    --assign-identity '[system]' -o none
fi

ACR_ID=$(az acr show -n "$ACR" --query id -o tsv)
log "Configure $APP (database $DATABASE, role $ROLE)"
# the system-assigned identity logs in to the database and reads the vault; the user-assigned one is only for
# federation. Never set AZURE_CLIENT_ID: DefaultAzureCredential would then log in to the database as the other one
PRINCIPAL=$(az webapp identity assign -g "$RG" -n "$APP" --identities '[system]' "$FED_IDENTITY_ID" \
  --query principalId -o tsv)
assign "$PRINCIPAL" "Key Vault Secrets User" "$KV_ID"
assign "$PRINCIPAL" "AcrPull" "$ACR_ID"
az webapp update -g "$RG" -n "$APP" --https-only true --client-affinity-enabled false -o none
az webapp config set -g "$RG" -n "$APP" --always-on true --min-tls-version 1.2 --ftps-state Disabled \
  --http20-enabled true --generic-configurations '{"acrUseManagedIdentityCreds": true}' -o none
az webapp config appsettings set -g "$RG" -n "$APP" -o none --settings \
  WEBSITES_PORT=3100 \
  WEBSITES_ENABLE_APP_SERVICE_STORAGE=false \
  "PGHOST=$DB_HOST" \
  "PGDATABASE=$DATABASE" \
  "PGUSER=$ROLE" \
  "BETTER_AUTH_URL=$URL" \
  "BETTER_AUTH_SECRET=@Microsoft.KeyVault(VaultName=$KV;SecretName=office-auth-secret)" \
  "RESEND_API_KEY=@Microsoft.KeyVault(VaultName=$KV;SecretName=resend-api-key)" \
  "TURNSTILE_SITE_KEY=$TURNSTILE_SITE_KEY" \
  "TURNSTILE_SECRET_KEY=@Microsoft.KeyVault(VaultName=$KV;SecretName=turnstile-secret-key)" \
  "JEV_API_KEY=@Microsoft.KeyVault(VaultName=$KV;SecretName=jev-api-key)" \
  "KEY_ENCRYPTION_KEY=@Microsoft.KeyVault(VaultName=$KV;SecretName=key-encryption-key)" \
  "ANTHROPIC_FEDERATION_AUDIENCE=api://$FED_APP_ID" \
  "ANTHROPIC_FEDERATION_CLIENT_ID=$FED_CLIENT_ID"

az postgres flexible-server db create -g "$RG" -s "$DB_SERVER" -n "$DATABASE" -o none
# the web app's identity logs in as $ROLE and owns the database (and so the tables its migrations create);
# you become a member of the role, so the seed script and your queries can work in the database too
sql postgres <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$ROLE') THEN
    PERFORM pgaadauth_create_principal_with_oid('$ROLE', '$PRINCIPAL', 'service', false, false);
  END IF;
END \$\$;
GRANT "$ROLE" TO "$ME_UPN";
ALTER DATABASE "$DATABASE" OWNER TO "$ROLE";
REVOKE CONNECT ON DATABASE "$DATABASE" FROM PUBLIC;
SQL
# Azure's new databases give schema public to azure_pg_admin, not to the database's owner
sql "$DATABASE" <<SQL
ALTER SCHEMA public OWNER TO "$ROLE";
SQL

log "GitHub deploys (the Entra app of apps/app/scripts/azure/github-identity.sh)"
GH_SP=$(az ad sp list --display-name gh-ai-scratch-deploy --query "[0].id" -o tsv)
assign "$GH_SP" "Website Contributor" "$(az webapp show -g "$RG" -n "$APP" --query id -o tsv)"

log "Done: https://$APP.azurewebsites.net (domain: domain.sh)"
echo "Federation rules at Anthropic match: issuer https://login.microsoftonline.com/$(az account show --query tenantId -o tsv)/v2.0,"
echo "audience $FED_APP_ID, oid $(az identity show -g "$RG" -n "$FED_IDENTITY" --query principalId -o tsv)"
