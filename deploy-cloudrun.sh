#!/usr/bin/env bash
# ==============================================================================
# LETON COFFEE - AUTOMATED CLOUD RUN BACKEND DEPLOYMENT SCRIPT
# ==============================================================================

set -e

SERVICE_NAME="leton-coffee-backend"
REGION="asia-southeast1"

echo "=========================================================="
echo "  Deploying Leton Coffee Backend to Google Cloud Run"
echo "  Service: $SERVICE_NAME"
echo "  Region:  $REGION"
echo "=========================================================="

gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "NODE_ENV=production,PORT=8080,VITE_SUPABASE_URL=https://galwyavdonfzuibrmswt.supabase.co,CORS_ORIGIN=https://leton-coffee-web.pages.dev"

echo "=========================================================="
echo "  Deployment Successful!"
echo "=========================================================="
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format 'value(status.url)')
echo "Service URL Aktual: $SERVICE_URL"
echo ""
echo "Langkah selanjutnya di Cloudflare Pages Dashboard:"
echo "1. Settings > Environment variables > Production"
echo "2. VITE_API_URL = $SERVICE_URL"
echo "3. Redeploy deployment terakhir di Cloudflare Pages"
echo "=========================================================="
