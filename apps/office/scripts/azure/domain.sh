#!/usr/bin/env bash
# Points office.ai-scratch.dev at the office's production slot: CNAME + asuid TXT at Cloudflare (DNS only, no
# proxy), the host name on the web app, a free managed certificate bound with SNI. Safe to re-run.
# Usage: apps/office/scripts/azure/domain.sh   (after provision.sh; needs `az login` and the `cf` CLI logged in)
set -euo pipefail

RG="2026-digitalferien"
APP="ai-scratch-office"
ZONE="ai-scratch.dev"
HOST="office.$ZONE"
log() { echo "==> $*"; }
json() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log($1)})"; }

Z=$(cf zones list --name "$ZONE" | json 'j[0].id')
VERIFICATION_ID=$(az webapp show -g "$RG" -n "$APP" --query customDomainVerificationId -o tsv)

record() { # type, name, content
  if [[ -z "$(cf dns records list -z "$Z" | json "j.filter(r => r.type === '$1' && r.name === '$2').map(r => r.id).join(' ')")" ]]; then
    cf dns records create -z "$Z" --body "{\"type\":\"$1\",\"name\":\"$2\",\"content\":\"$3\",\"ttl\":1,\"proxied\":false}" >/dev/null
    echo "    $1 $2 created"
  fi
}

log "DNS at Cloudflare"
record CNAME "$HOST" "$APP.azurewebsites.net"
record TXT "asuid.$HOST" "$VERIFICATION_ID"

log "Host name $HOST"
for _ in $(seq 12); do # DNS needs a moment before App Service sees it
  az webapp config hostname add -g "$RG" --webapp-name "$APP" --hostname "$HOST" -o none 2>/dev/null && break
  sleep 10
done
az webapp config hostname list -g "$RG" --webapp-name "$APP" --query "[?name=='$HOST'].name" -o tsv | grep -q .

log "Managed certificate"
certificate() { # the managed certificate is named after the host; `az resource list` leaves out properties
  az resource show -g "$RG" --resource-type Microsoft.Web/certificates -n "$HOST" \
    --query properties.thumbprint -o tsv 2>/dev/null || true
}
# fails with a JSON error but still issues the certificate (docs/deployment.md)
[[ -n "$(certificate)" ]] || az webapp config ssl create -g "$RG" -n "$APP" --hostname "$HOST" -o none 2>/dev/null || true
for _ in $(seq 30); do
  thumbprint=$(certificate)
  [[ -n "$thumbprint" ]] && break
  sleep 10
done
az webapp config ssl bind -g "$RG" -n "$APP" --certificate-thumbprint "$thumbprint" --ssl-type SNI -o none
log "Done: https://$HOST"
