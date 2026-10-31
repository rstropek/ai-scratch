#!/usr/bin/env bash
# Creates (or updates) the office's Azure resources: the Postgres server (shared with the kids' app later), one
# database per slot with an Entra role for the slot's managed identity, the web app + staging slot on the existing
# P0v3 plan, its Key Vault secret and app settings. Safe to re-run. The image is set by the deploy workflow.
# Usage: apps/office/scripts/azure/provision.sh   (needs `az login` with Owner on the subscription, and Node)
set -euo pipefail

SUBSCRIPTION="Microsoft Azure Sponsorship"
RG="2026-digitalferien"
# westeurope and germanywestcentral refuse new Postgres servers for this subscription (docs/deployment.md)
DB_LOCATION="northeurope"
DB_SERVER="ai-scratch-db"
DB_HOST="$DB_SERVER.postgres.database.azure.com"
APP="ai-scratch-office"
SLOT="staging"
PLAN_ID="/subscriptions/$(az account show -s "$SUBSCRIPTION" --query id -o tsv)/resourceGroups/ts-web-playground/providers/Microsoft.Web/serverfarms/ts-web-playground"
KV="kv-digiferien"
ACR="acrars2025"
PLACEHOLDER_IMAGE="mcr.microsoft.com/appsvc/staticsite:latest"
REPO="$(cd "$(dirname "$0")/../../../.." && pwd)"

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
if ! az keyvault secret show --vault-name "$KV" -n office-auth-secret -o none 2>/dev/null; then
  log "Secret office-auth-secret"
  az keyvault secret set --vault-name "$KV" -n office-auth-secret --file <(openssl rand -base64 32) -o none
fi

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
  WEBSITES_PORT=3100
  WEBSITES_ENABLE_APP_SERVICE_STORAGE=false
  "PGHOST=$DB_HOST"
  "BETTER_AUTH_SECRET=@Microsoft.KeyVault(VaultName=$KV;SecretName=office-auth-secret)"
)
for slot in production "$SLOT"; do
  target=(-g "$RG" -n "$APP")
  if [[ "$slot" == production ]]; then
    database=aiscratch role="$APP" url="https://office.ai-scratch.dev"
  else
    target+=(--slot "$slot")
    database="aiscratch_$slot" role="$APP-$slot" url="https://$APP-$slot.azurewebsites.net"
  fi
  log "Configure $slot (database $database, role $role)"
  principal=$(az webapp identity assign "${target[@]}" --query principalId -o tsv)
  assign "$principal" "Key Vault Secrets User" "$KV_ID"
  assign "$principal" "AcrPull" "$ACR_ID"
  az webapp update "${target[@]}" --https-only true --client-affinity-enabled false -o none
  az webapp config set "${target[@]}" --always-on true --min-tls-version 1.2 --ftps-state Disabled \
    --http20-enabled true --generic-configurations '{"acrUseManagedIdentityCreds": true}' -o none
  az webapp config appsettings set "${target[@]}" --settings "${SETTINGS[@]}" -o none
  # sticky: they stay with the slot when a swap moves the code
  az webapp config appsettings set "${target[@]}" -o none \
    --slot-settings "PGDATABASE=$database" "PGUSER=$role" "BETTER_AUTH_URL=$url"

  az postgres flexible-server db create -g "$RG" -s "$DB_SERVER" -n "$database" -o none
  # the slot's identity logs in as $role and owns its database (and so the tables its migrations create);
  # you become a member of the role, so the seed script and your queries can work in the database too
  sql postgres <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$role') THEN
    PERFORM pgaadauth_create_principal_with_oid('$role', '$principal', 'service', false, false);
  END IF;
END \$\$;
GRANT "$role" TO "$ME_UPN";
ALTER DATABASE "$database" OWNER TO "$role";
REVOKE CONNECT ON DATABASE "$database" FROM PUBLIC;
SQL
  # Azure's new databases give schema public to azure_pg_admin, not to the database's owner
  sql "$database" <<SQL
ALTER SCHEMA public OWNER TO "$role";
SQL
done

log "GitHub deploys (the Entra app of apps/app/scripts/azure/github-identity.sh)"
GH_SP=$(az ad sp list --display-name gh-ai-scratch-deploy --query "[0].id" -o tsv)
assign "$GH_SP" "Website Contributor" "$(az webapp show -g "$RG" -n "$APP" --query id -o tsv)"

log "Done: https://$APP.azurewebsites.net and https://$APP-$SLOT.azurewebsites.net"
