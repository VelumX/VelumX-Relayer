#!/bin/bash
# Run as root: bash /tmp/harden-nginx.sh
set -euo pipefail

NGINX_CONF="/etc/nginx/nginx.conf"
REPO="/home/velumx/VelumX/VelumX-Relayer"

echo "=== VelumX Nginx Hardening ==="

# 1. Add rate limit zones + server_tokens to nginx.conf if not already there
if ! grep -q 'limit_req_zone' "$NGINX_CONF"; then
    # Insert before the first 'include' line inside the http block
    sed -i '/include \/etc\/nginx\/conf\.d/i\    server_tokens off;\n    keepalive_timeout 30s;\n    send_timeout 10s;\n    limit_req_zone $binary_remote_addr zone=relayer_api:10m rate=30r\/m;\n    limit_req_zone $binary_remote_addr zone=dashboard:10m rate=60r\/m;\n' "$NGINX_CONF"
    echo "✓ nginx.conf hardened"
else
    echo "✓ nginx.conf already has rate limit zones"
fi

# 2. Deploy hardened site configs
cp "$REPO/deploy/nginx/velumx-relayer.conf"   /etc/nginx/sites-available/velumx-relayer
cp "$REPO/deploy/nginx/velumx-dashboard.conf" /etc/nginx/sites-available/velumx-dashboard
echo "✓ Site configs deployed"

# 3. Test and reload
nginx -t && systemctl reload nginx
echo "✓ Nginx reloaded"

# 4. Verify sudoers works for velumx
su - velumx -c "sudo /usr/sbin/nginx -t" && echo "✓ Passwordless sudo confirmed for velumx"

echo ""
echo "=== Done. CI/CD is fully wired. ==="
