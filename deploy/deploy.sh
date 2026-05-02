#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  VelumX Deploy Script                                          ║
# ║  Run as the 'velumx' user to build + start both services       ║
# ║  Also used by CI/CD to re-deploy on push                       ║
# ╚══════════════════════════════════════════════════════════════════╝

set -euo pipefail

REPO_DIR="$HOME/VelumX"
RELAYER_DIR="$REPO_DIR/VelumX-Relayer/relayer"
DASHBOARD_DIR="$REPO_DIR/VelumX-Relayer/dashboard"
ECOSYSTEM="$REPO_DIR/VelumX-Relayer/ecosystem.config.cjs"

echo "══════════════════════════════════════"
echo "  VelumX Deploy"
echo "══════════════════════════════════════"
echo ""

# Pull latest code
cd "$REPO_DIR"
echo "→ Pulling latest code..."
git pull origin main 2>/dev/null || echo "  (skipped — not a git checkout or no remote)"

# ── Build Relayer ──────────────────────────────────────────────────
echo ""
echo "→ Building Relayer..."
cd "$RELAYER_DIR"
npm install --production=false  # need devDeps for build (typescript, prisma)
npx prisma generate
npm run build
echo "✓ Relayer built"

# ── Build Dashboard ───────────────────────────────────────────────
echo ""
echo "→ Building Dashboard..."
cd "$DASHBOARD_DIR"
npm install --production=false
npx prisma generate
npm run build
echo "✓ Dashboard built"

# ── Start / Restart PM2 ───────────────────────────────────────────
echo ""
echo "→ Starting services with PM2..."

# Check if processes are already managed by PM2
if pm2 describe velumx-relayer > /dev/null 2>&1; then
    echo "  Restarting existing PM2 processes..."
    pm2 restart "$ECOSYSTEM"
else
    echo "  Starting PM2 processes for the first time..."
    pm2 start "$ECOSYSTEM"
fi

# Save PM2 state for reboot persistence
pm2 save

echo ""
echo "══════════════════════════════════════"
echo "  Deploy Complete!"
echo "══════════════════════════════════════"
echo ""
pm2 status
echo ""
echo "Logs:  pm2 logs"
echo "Mon:   pm2 monit"
echo ""
