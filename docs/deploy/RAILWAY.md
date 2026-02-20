# Deploy Mr.Market on Railway (SQLite + Redis)

This guide deploys:
- **server/** (NestJS) as a Railway **Service**
- **interface/** (SvelteKit) either as Railway service (Node) or as static hosting elsewhere
- **Redis** as a Railway plugin/add-on (for Bull)
- **SQLite** as a file on a **persistent volume**

> Notes
> - Railway works well for long-running Node services.
> - To keep **SQLite**, you must use a **volume**; otherwise the DB file will be lost on redeploy.

## 1) Create the server service
1. Create a new Railway project
2. Add a service from GitHub repo
3. Set the **root** to `server/` (or set build/start commands accordingly)

### Build / start
If using Nixpacks:
- Build: `bun install --frozen-lockfile && bun run build`
- Start: `bun run migration:run && bun run start:prod`

Or use the existing `server/Dockerfile`.

### Volume (required for SQLite)
- Create a volume
- Mount it to (example): `/var/data`
- Set env: `DATABASE_PATH=/var/data/mr_market.db`

### Redis (required for Bull)
- Add Railway Redis
- Set env: `REDIS_URL=<railway redis url>`

### Required env vars (production)
- `NODE_ENV=production`
- `ADMIN_PASSWORD=...`
- `JWT_SECRET=...`
- `ENCRYPTION_PRIVATE_KEY=...`

Plus any Mixin/exchange keys you need.

## 2) Deploy frontend
Options:

### Option A (recommended): Vercel for interface
- Build with `ADAPTER=node` or `ADAPTER=static` (static only if the app can be fully prerendered)
- Set env vars:
  - `PUBLIC_MRM_BACKEND_URL=https://<your-railway-server-domain>`
  - `PUBLIC_MRM_SOCKET_URL=https://<your-railway-server-domain>`

### Option B: Railway for interface (Node)
- Deploy `interface/` as a separate service
- Use `ADAPTER=node`

## 3) Smoke test
- Frontend loads
- Backend `/docs` and `/health/system-status` respond
- WebSocket namespace `/market` connects (Socket.IO)
