#!/usr/bin/env bash
# Creates (or updates) the kids' app's Azure resources: web app (no staging slot) on the existing P0v3 plan, Key
# Vault with the server secrets, storage account with the research logs of the event (no longer written; the stored
# ones stay), and its own role in the office's Postgres with only what the kids' app needs (docs/budgets.md). Run it
# after the office's provision.sh and after the office has migrated the database: the grants name its tables (and
# re-run it after a migration adds a table the kids' app reads). Safe to re-run; re-running also re-uploads the
# secrets from .env. The image is set by the deploy workflow (.github/workflows/deploy.yml); the app pulls it from
# ACR with its managed identity.
# Usage: scripts/azure/provision.sh   (needs `az login` with Owner on the subscription, and Node)
set -euo pipefail

SUBSCRIPTION="Microsoft Azure Sponsorship"
RG="2026-digitalferien"
LOCATION="westeurope"
APP="ai-scratch"
PLAN_ID="/subscriptions/$(az account show -s "$SUBSCRIPTION" --query id -o tsv)/resourceGroups/ts-web-playground/providers/Microsoft.Web/serverfarms/ts-web-playground"
KV="kv-digiferien"
STORAGE="stdigiferien"
CONTAINER="logs"
ACR="acrars2025"
PLACEHOLDER_IMAGE="mcr.microsoft.com/appsvc/staticsite:latest"
ENV_FILE="$(dirname "$0")/../../.env"
REPO="$(cd "$(dirname "$0")/../../../.." && pwd)"
DB_HOST="ai-scratch-db.postgres.database.azure.com"
DATABASE="aiscratch"
ROLE="$APP" # the database role of the web app's managed identity
OFFICE_ROLE="ai-scratch-office" # owns the tables (the office migrates)
# the user-assigned identity the pool's federation rules trust (created by the office's provision.sh)
FED_APP_NAME="ai-scratch-anthropic-audience"
FED_IDENTITY="id-ai-scratch-anthropic"

az account set -s "$SUBSCRIPTION"
log() { echo "==> $*"; }

# Reads KEY=value from .env without sourcing it (values are never printed).
env_value() {
  local line
  line=$(grep -E "^$1=" "$ENV_FILE" | tail -1) || true
  local v="${line#*=}"
  v="${v%\"}"
  printf %s "${v#\"}"
}

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

ME=$(az ad signed-in-user show --query id -o tsv)
ME_UPN=$(az ad signed-in-user show --query userPrincipalName -o tsv)

log "Storage account $STORAGE"
az storage account create -g "$RG" -n "$STORAGE" -l "$LOCATION" --sku Standard_LRS --kind StorageV2 \
  --access-tier Hot --min-tls-version TLS1_2 --allow-blob-public-access false --allow-shared-key-access false \
  --https-only true -o none
az storage container-rm create -g "$RG" --storage-account "$STORAGE" -n "$CONTAINER" --public-access off -o none
STORAGE_ID=$(az storage account show -g "$RG" -n "$STORAGE" --query id -o tsv)
assign "$ME" "Storage Blob Data Reader" "$STORAGE_ID" User

log "Key Vault $KV"
if ! az keyvault show -g "$RG" -n "$KV" -o none 2>/dev/null; then
  az keyvault create -g "$RG" -n "$KV" -l "$LOCATION" --enable-rbac-authorization true -o none
fi
KV_ID=$(az keyvault show -g "$RG" -n "$KV" --query id -o tsv)
assign "$ME" "Key Vault Secrets Officer" "$KV_ID" User

log "Secrets from .env"
for pair in JEV_API_KEY:jev-api-key RESEND_API_KEY:resend-api-key; do
  value=$(env_value "${pair%%:*}")
  if [[ -z "$value" ]]; then
    echo "    WARNING: ${pair%%:*} is empty in .env, secret ${pair#*:} not set"
    continue
  fi
  retry az keyvault secret set --vault-name "$KV" -n "${pair#*:}" --file <(printf %s "$value") -o none
  echo "    ${pair#*:} set"
done

log "Web app $APP (plan ts-web-playground)"
if ! az webapp show -g "$RG" -n "$APP" -o none 2>/dev/null; then
  az webapp create -g "$RG" -p "$PLAN_ID" -n "$APP" --container-image-name "$PLACEHOLDER_IMAGE" \
    --assign-identity '[system]' -o none
fi

ACR_ID=$(az acr show -n "$ACR" --query id -o tsv)
FED_APP_ID=$(az ad app list --display-name "$FED_APP_NAME" --query "[0].appId" -o tsv)
FED_IDENTITY_ID=$(az identity show -g "$RG" -n "$FED_IDENTITY" --query id -o tsv)
FED_CLIENT_ID=$(az identity show -g "$RG" -n "$FED_IDENTITY" --query clientId -o tsv)
SETTINGS=(
  WEBSITES_PORT=3000
  WEBSITES_ENABLE_APP_SERVICE_STORAGE=false
  "PGHOST=$DB_HOST"
  "PGDATABASE=$DATABASE"
  "PGUSER=$ROLE"
  "KEY_ENCRYPTION_KEY=@Microsoft.KeyVault(VaultName=$KV;SecretName=key-encryption-key)"
  "JEV_API_KEY=@Microsoft.KeyVault(VaultName=$KV;SecretName=jev-api-key)"
  "RESEND_API_KEY=@Microsoft.KeyVault(VaultName=$KV;SecretName=resend-api-key)"
  "ANTHROPIC_FEDERATION_AUDIENCE=api://$FED_APP_ID"
  "ANTHROPIC_FEDERATION_CLIENT_ID=$FED_CLIENT_ID"
)
log "Configure $APP"
# the system-assigned identity logs in to the database and reads the vault; the user-assigned one is only for
# federation. Never set AZURE_CLIENT_ID: DefaultAzureCredential would then log in to the database as the other one
PRINCIPAL=$(az webapp identity assign -g "$RG" -n "$APP" --identities '[system]' "$FED_IDENTITY_ID" \
  --query principalId -o tsv)
assign "$PRINCIPAL" "Key Vault Secrets User" "$KV_ID"
assign "$PRINCIPAL" "AcrPull" "$ACR_ID"
az webapp update -g "$RG" -n "$APP" --https-only true --client-affinity-enabled true -o none
az webapp config set -g "$RG" -n "$APP" --always-on true --min-tls-version 1.2 --ftps-state Disabled \
  --http20-enabled true --generic-configurations '{"acrUseManagedIdentityCreds": true}' -o none
az webapp config appsettings set -g "$RG" -n "$APP" --settings "${SETTINGS[@]}" -o none
# codes come from the office now: no school codes, no key of the kids' app's own (test codes are never set on Azure)
az webapp config appsettings delete -g "$RG" -n "$APP" -o none \
  --setting-names ACCESS_CODES ANTHROPIC_API_KEY ANTHROPIC_WORKSPACE_ID TEST_CODES

log "Database role $ROLE (database $DATABASE)"
sql postgres <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$ROLE') THEN
    PERFORM pgaadauth_create_principal_with_oid('$ROLE', '$PRINCIPAL', 'service', false, false);
  END IF;
END \$\$;
GRANT CONNECT ON DATABASE "$DATABASE" TO "$ROLE";
SQL
# only what the kids' app reads and writes; granted as the tables' owner (you are a member of the office's role)
sql "$DATABASE" <<SQL
SET ROLE "$OFFICE_ROLE";
GRANT USAGE ON SCHEMA public TO "$ROLE";
GRANT SELECT ON access_code, anthropic_key, model_price TO "$ROLE";
GRANT SELECT (id, key_sealed) ON openrouter_key TO "$ROLE";
GRANT SELECT (user_id, free_budget_at) ON adult_profile TO "$ROLE";
GRANT SELECT (id, email, role, banned, ban_expires) ON "user" TO "$ROLE";
GRANT UPDATE (refused_at, refused_reason) ON anthropic_key TO "$ROLE";
GRANT SELECT, INSERT, UPDATE ON usage TO "$ROLE";
GRANT USAGE ON SEQUENCE usage_id_seq TO "$ROLE";
GRANT SELECT, INSERT ON budget_warning TO "$ROLE";
SQL

log "Done: https://$APP.azurewebsites.net"
