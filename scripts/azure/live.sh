#!/usr/bin/env bash
# TEMPORARY (Digitalferien 2026): puts the teacher page's data (the git-ignored folder live/: live.json and the
# Locker cards) into the Blob container `live` and points both slots at it (src/server/live.ts).
# Setting LIVE_BLOB_URL restarts the app: run this before the event, never during it.
# Re-running only re-uploads the files; the server picks up a new live.json within a minute.
# Usage: scripts/azure/live.sh            set up and upload
#        scripts/azure/live.sh --remove   after the event: setting, roles and container gone
set -euo pipefail

SUBSCRIPTION="Microsoft Azure Sponsorship"
RG="2026-digitalferien"
APP="ai-scratch"
SLOT="staging"
STORAGE="stdigiferien"
CONTAINER="live"
DIR="$(dirname "$0")/../../live"

az account set -s "$SUBSCRIPTION"
log() { echo "==> $*"; }

STORAGE_ID=$(az storage account show -g "$RG" -n "$STORAGE" --query id -o tsv)
SCOPE="$STORAGE_ID/blobServices/default/containers/$CONTAINER"
ME=$(az ad signed-in-user show --query id -o tsv)
principals() {
  az webapp identity show -g "$RG" -n "$APP" --query principalId -o tsv
  az webapp identity show -g "$RG" -n "$APP" --slot "$SLOT" --query principalId -o tsv
}

if [[ "${1:-}" == "--remove" ]]; then
  for slot in "" "$SLOT"; do
    target=(-g "$RG" -n "$APP")
    [[ -n "$slot" ]] && target+=(--slot "$slot")
    log "Remove LIVE_BLOB_URL from ${slot:-production}"
    az webapp config appsettings delete "${target[@]}" --setting-names LIVE_BLOB_URL -o none
  done
  for principal in $(principals) "$ME"; do
    az role assignment delete --assignee "$principal" --scope "$SCOPE" 2>/dev/null || true
  done
  log "Delete container $CONTAINER"
  az storage container-rm delete -g "$RG" --storage-account "$STORAGE" -n "$CONTAINER" --yes -o none
  exit 0
fi

[[ -f "$DIR/live.json" ]] || { echo "No live/live.json: put the page's data there first." >&2; exit 1; }

log "Container $CONTAINER"
az storage container-rm create -g "$RG" --storage-account "$STORAGE" -n "$CONTAINER" --public-access off -o none
az role assignment create --assignee-object-id "$ME" --assignee-principal-type User \
  --role "Storage Blob Data Contributor" --scope "$SCOPE" -o none
for principal in $(principals); do
  az role assignment create --assignee-object-id "$principal" --assignee-principal-type ServicePrincipal \
    --role "Storage Blob Data Reader" --scope "$SCOPE" -o none
done

log "Upload live/ (retried while the new role propagates)"
for i in $(seq 12); do
  if az storage blob upload-batch --auth-mode login --account-name "$STORAGE" -d "$CONTAINER" -s "$DIR" \
    --overwrite -o none 2>/dev/null; then
    break
  fi
  [[ $i == 12 ]] && { echo "Upload failed" >&2; exit 1; }
  sleep 10
done
az storage blob list --auth-mode login --account-name "$STORAGE" -c "$CONTAINER" --query "[].name" -o tsv

URL="https://$STORAGE.blob.core.windows.net/$CONTAINER"
for slot in "" "$SLOT"; do
  target=(-g "$RG" -n "$APP")
  [[ -n "$slot" ]] && target+=(--slot "$slot")
  current=$(az webapp config appsettings list "${target[@]}" --query "[?name=='LIVE_BLOB_URL'].value" -o tsv)
  if [[ "$current" != "$URL" ]]; then
    log "Set LIVE_BLOB_URL on ${slot:-production} (restarts it)"
    az webapp config appsettings set "${target[@]}" --settings "LIVE_BLOB_URL=$URL" -o none
  fi
done

log "Done: https://$APP.azurewebsites.net/digiferien-2026-live"
