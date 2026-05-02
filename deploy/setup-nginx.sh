#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  VelumX Nginx + SSL Setup                                      ║
# ║  Run as root AFTER DNS A records point to this VPS              ║
# ╚══════════════════════════════════════════════════════════════════╝

set -euo pipefail

DEPLOY_DIR="/home/velumx/VelumX/VelumX-Relayer/deploy/nginx"
EMAIL="${1:-admin@velumx.xyz}"

echo "══════════════════════════════════════"
echo "  VelumX Nginx + SSL Setup"
echo "══════════════════════════════════════"
echo ""

# 1. Copy Nginx configs
echo "→ Installing Nginx site configs..."
cp "$DEPLOY_DIR/velumx-relayer.conf" /etc/nginx/sites-available/velumx-relayer
cp "$DEPLOY_DIR/velumx-dashboard.conf" /etc/nginx/sites-available/velumx-dashboard

# 2. Enable sites
ln -sf /etc/nginx/sites-available/velumx-relayer /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/velumx-dashboard /etc/nginx/sites-enabled/

# 3. Remove default site
rm -f /etc/nginx/sites-enabled/default

# 4. Test Nginx config
echo "→ Testing Nginx configuration..."
nginx -t

# 5. Reload Nginx
systemctl reload nginx
echo "✓ Nginx configured and reloaded"

# 6. SSL certificates
echo ""
echo "→ Obtaining SSL certificates..."
certbot --nginx \
  -d api.velumx.xyz \
  -d dashboard.velumx.xyz \
  --non-interactive \
  --agree-tos \
  -m "$EMAIL"

echo ""
echo "✓ SSL certificates installed!"
echo ""
echo "Verify:"
echo "  curl https://api.velumx.xyz/health"
echo "  curl -I https://dashboard.velumx.xyz"
echo ""
