#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  VelumX VPS Setup Script                                       ║
# ║  Run this ONCE on a fresh Contabo VPS (Ubuntu 22.04/24.04)     ║
# ║  as root or with sudo                                          ║
# ╚══════════════════════════════════════════════════════════════════╝

set -euo pipefail

echo "══════════════════════════════════════"
echo "  VelumX VPS Setup — Phase 1: System"
echo "══════════════════════════════════════"

# 1. System updates
apt update && apt upgrade -y
apt install -y ufw fail2ban curl git build-essential nginx certbot python3-certbot-nginx

# 2. Firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (Let's Encrypt + redirect)
ufw allow 443/tcp   # HTTPS
echo "y" | ufw enable
echo "✓ Firewall configured (SSH, HTTP, HTTPS)"

# 3. Node.js 20 LTS
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    echo "✓ Node.js $(node -v) installed"
else
    echo "✓ Node.js $(node -v) already installed"
fi

# 4. PM2
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    echo "✓ PM2 installed"
else
    echo "✓ PM2 already installed"
fi

# 5. Create deploy user
if ! id "velumx" &>/dev/null; then
    adduser velumx --disabled-password --gecos ""
    usermod -aG sudo velumx
    echo "✓ User 'velumx' created"
else
    echo "✓ User 'velumx' already exists"
fi

# 6. Create log directory
mkdir -p /home/velumx/logs
chown velumx:velumx /home/velumx/logs

echo ""
echo "══════════════════════════════════════"
echo "  Phase 1 Complete!"
echo "══════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Set up SSH key for 'velumx' user:"
echo "     mkdir -p /home/velumx/.ssh"
echo "     cp ~/.ssh/authorized_keys /home/velumx/.ssh/"
echo "     chown -R velumx:velumx /home/velumx/.ssh"
echo ""
echo "  2. Switch to velumx user and run deploy.sh:"
echo "     su - velumx"
echo "     bash ~/VelumX/VelumX-Relayer/deploy/deploy.sh"
echo ""
