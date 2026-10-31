#!/usr/bin/env bash
# Creates (or updates) the Entra app that GitHub Actions logs in as (OIDC, no secret) and stores its ids as
# repository variables. Only workflows running on main can log in. Safe to re-run.
# Usage: scripts/azure/github-identity.sh   (needs `az login` with Owner on the subscription and `gh auth login`)
set -euo pipefail

SUBSCRIPTION="Microsoft Azure Sponsorship"
REPO="rstropek/ai-scratch"
APP_NAME="gh-ai-scratch-deploy"
RG="2026-digitalferien"
WEBAPP="ai-scratch"
ACR="acrars2025"

az account set -s "$SUBSCRIPTION"
log() { echo "==> $*"; }

log "Entra app $APP_NAME"
CLIENT_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv)
if [[ -z "$CLIENT_ID" ]]; then
  CLIENT_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
fi
SP_ID=$(az ad sp show --id "$CLIENT_ID" --query id -o tsv 2>/dev/null || az ad sp create --id "$CLIENT_ID" --query id -o tsv)

log "Federated credential for $REPO main"
# GitHub decides the subject format (newer repos: immutable, with owner and repo ids); ask it instead of guessing
SUBJECT="$(gh api "repos/$REPO/actions/oidc/customization/sub" --jq .sub_claim_prefix):ref:refs/heads/main"
CREDENTIAL="{
  \"name\": \"main\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"$SUBJECT\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}"
if [[ -z "$(az ad app federated-credential list --id "$CLIENT_ID" --query "[?name=='main'].name" -o tsv)" ]]; then
  az ad app federated-credential create --id "$CLIENT_ID" -o none --parameters "$CREDENTIAL"
else
  az ad app federated-credential update --id "$CLIENT_ID" --federated-credential-id main -o none --parameters "$CREDENTIAL"
fi
echo "    subject $SUBJECT"

log "Roles: AcrPush on $ACR, Website Contributor on $WEBAPP"
assign() {
  az role assignment create --assignee-object-id "$SP_ID" --assignee-principal-type ServicePrincipal \
    --role "$1" --scope "$2" -o none
}
assign AcrPush "$(az acr show -n "$ACR" --query id -o tsv)"
assign "Website Contributor" "$(az webapp show -g "$RG" -n "$WEBAPP" --query id -o tsv)"

log "Repository variables"
gh variable set AZURE_CLIENT_ID -R "$REPO" -b "$CLIENT_ID"
gh variable set AZURE_TENANT_ID -R "$REPO" -b "$(az account show --query tenantId -o tsv)"
gh variable set AZURE_SUBSCRIPTION_ID -R "$REPO" -b "$(az account show --query id -o tsv)"
log "Done"
