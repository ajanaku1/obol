/**
 * PM2 process config for a persistent host (e.g. an Oracle Always Free VM).
 *
 * Two long-lived processes:
 *   - obol-data: the x402 data market on :4020 (internal only)
 *   - obol-web:  the Next.js app on :3000 (Caddy reverse-proxies 443 -> 3000)
 *
 * The agent itself is spawned per-run as a child process by the web app
 * (frontend/lib/runner.ts), so it needs no PM2 entry. Each process loads the
 * repo-root .env itself, so PM2 injects no secrets.
 *
 *   pm2 start ecosystem.config.cjs && pm2 save
 */
module.exports = {
  apps: [
    {
      name: "obol-data",
      cwd: __dirname,
      script: "npm",
      args: "run start --workspace=@obol/data",
      autorestart: true,
      max_restarts: 10,
      env: { NODE_ENV: "production" },
    },
    {
      name: "obol-web",
      cwd: __dirname,
      script: "npm",
      args: "run start --workspace=@obol/frontend",
      autorestart: true,
      max_restarts: 10,
      env: { NODE_ENV: "production" },
    },
  ],
};
