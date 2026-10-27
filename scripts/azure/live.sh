#!/usr/bin/env bash
# After the event: removes what the teacher page used on Azure (the Blob container `live` with live.json and
# the Locker cards, its roles, the LIVE_BLOB_URL setting). The video page no longer needs any of it.
# Deploy the code without the teacher page first: the old code reads its videos from that container.
# Removing the setting restarts both slots. Delete this script once it has run.
set -euo pipefail

SUBSCRIPTION="Microsoft Azure Sponsorship"
RG="2026-digitalferien"
APP="ai-scratch"
SLOT="staging"
STORAGE="stdigiferien"
CONTAINER="live"

az account set -s "$SUBSCRIPTION"
log() { echo "==> $*"; }

STORAGE_ID=$(az storage account show -g "$RG" -n "$STORAGE" --query id -o tsv)
SCOPE="$STORAGE_ID/blobServices/default/containers/$CONTAINER"
ME=$(az ad signed-in-user show --query id -o tsv)
principals() {
  az webapp identity show -g "$RG" -n "$APP" --query principalId -o tsv
  az webapp identity show -g "$RG" -n "$APP" --slot "$SLOT" --query principalId -o tsv
}

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
