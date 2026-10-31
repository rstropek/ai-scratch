#!/usr/bin/env bash
# Creates (or updates) the Azure resources for the event: web app + staging slot on the existing P0v3 plan,
# Key Vault with the server secrets, storage account with the research logs of the event (no longer written;
# the stored ones stay). Safe to re-run; re-running also
# re-uploads the secrets from .env (e.g. after swapping in the event key or the real access codes).
# The image is set by the deploy workflow (.github/workflows/deploy.yml). Both slots pull from ACR with their
# managed identity: a swap restarts staging with production's settings, so production needs the flag too.
# Usage: scripts/azure/provision.sh   (needs `az login` with Owner on the subscription)
set -euo pipefail

SUBSCRIPTION="Microsoft Azure Sponsorship"
RG="2026-digitalferien"
LOCATION="westeurope"
APP="ai-scratch"
SLOT="staging"
PLAN_ID="/subscriptions/$(az account show -s "$SUBSCRIPTION" --query id -o tsv)/resourceGroups/ts-web-playground/providers/Microsoft.Web/serverfarms/ts-web-playground"
KV="kv-digiferien"
STORAGE="stdigiferien"
CONTAINER="logs"
ACR="acrars2025"
PLACEHOLDER_IMAGE="mcr.microsoft.com/appsvc/staticsite:latest"
ENV_FILE="$(dirname "$0")/../../.env"

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

ME=$(az ad signed-in-user show --query id -o tsv)

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
for pair in ANTHROPIC_API_KEY:anthropic-api-key JEV_API_KEY:jev-api-key ACCESS_CODES:access-codes RESEND_API_KEY:resend-api-key; do
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
if ! az webapp show -g "$RG" -n "$APP" --slot "$SLOT" -o none 2>/dev/null; then
  log "Slot $SLOT"
  az webapp deployment slot create -g "$RG" -n "$APP" --slot "$SLOT" --configuration-source "$APP" -o none
fi

ACR_ID=$(az acr show -n "$ACR" --query id -o tsv)
SETTINGS=(
  WEBSITES_PORT=3000
  WEBSITES_ENABLE_APP_SERVICE_STORAGE=false
  "ANTHROPIC_WORKSPACE_ID=$(env_value ANTHROPIC_WORKSPACE_ID)"
  "ANTHROPIC_API_KEY=@Microsoft.KeyVault(VaultName=$KV;SecretName=anthropic-api-key)"
  "JEV_API_KEY=@Microsoft.KeyVault(VaultName=$KV;SecretName=jev-api-key)"
  "ACCESS_CODES=@Microsoft.KeyVault(VaultName=$KV;SecretName=access-codes)"
)
for slot in "" "$SLOT"; do
  target=(-g "$RG" -n "$APP")
  [[ -n "$slot" ]] && target+=(--slot "$slot")
  log "Configure ${slot:-production}"
  principal=$(az webapp identity assign "${target[@]}" --query principalId -o tsv)
  assign "$principal" "Key Vault Secrets User" "$KV_ID"
  assign "$principal" "AcrPull" "$ACR_ID"
  az webapp update "${target[@]}" --https-only true --client-affinity-enabled true -o none
  az webapp config set "${target[@]}" --always-on true --min-tls-version 1.2 --ftps-state Disabled \
    --http20-enabled true --generic-configurations '{"acrUseManagedIdentityCreds": true}' -o none
  az webapp config appsettings set "${target[@]}" --settings "${SETTINGS[@]}" -o none
done

log "Done: https://$APP.azurewebsites.net and https://$APP-$SLOT.azurewebsites.net"
