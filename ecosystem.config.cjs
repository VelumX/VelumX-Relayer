/**
 * PM2 Ecosystem Configuration for VelumX VPS Deployment
 * Manages both the Relayer (Express) and Dashboard (Next.js) processes.
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 restart all
 *   pm2 logs
 *   pm2 monit
 */
module.exports = {
  apps: [
    // ── Relayer (Express, port 4000) ──────────────────────────
    {
      name: 'velumx-relayer',
      script: 'dist/index.js',
      cwd: '/home/velumx/VelumX/VelumX-Relayer/relayer',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      max_memory_restart: '1G',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/home/velumx/logs/relayer-error.log',
      out_file: '/home/velumx/logs/relayer-out.log',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 5000
    },

    // ── Dashboard (Next.js SSR, port 3000) ────────────────────
    {
      name: 'velumx-dashboard',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: '/home/velumx/VelumX/VelumX-Relayer/dashboard',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      max_memory_restart: '1G',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/home/velumx/logs/dashboard-error.log',
      out_file: '/home/velumx/logs/dashboard-out.log',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 5000
    }
  ]
};
