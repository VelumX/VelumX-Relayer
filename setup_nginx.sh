#!/bin/bash
# VelumX Nginx Subdomain Setup Script

cat <<'CONFIG' | sudo tee /etc/nginx/sites-available/velumx
# ── Relayer API (api.velumx.xyz) ──────────────────────────
server {
    listen 80;
    server_name api.velumx.xyz;

    location / {
        proxy_pass http://localhost:4000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# ── Dashboard (dashboard.velumx.xyz) ──────────────────────
server {
    listen 80;
    server_name dashboard.velumx.xyz;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
CONFIG

sudo nginx -t && sudo systemctl reload nginx
echo "✅ Nginx subdomains configured!"
