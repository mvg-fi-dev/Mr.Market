# Deploy Mr.Market on Render (SQLite + Redis)

This guide deploys:
- **server/** (NestJS) as a Render **Web Service**
- **interface/** (SvelteKit) as a Render **Static Site**
- **Redis** as a Render managed Redis (for Bull)
- **SQLite** stays as a file on a Render persistent disk

> Why Render?
> - supports persistent disks (needed for SQLite file)
> - supports long-running services (needed for workers, websockets)

## 0) Prerequisites
- A Render account
- This repo connected to Render (GitHub)

## 1) Create Redis
1. Render dashboard → New → **Redis**
2. Create it
3. Copy its internal URL (Render provides a `redis://...` URL)

We will use it as `REDIS_URL`.

## 2) Deploy server (Web Service)
1. Render dashboard → New → **Web Service**
2. Select this repo
3. **Root Directory**: `server`
4. **Runtime**: Docker
5. **Plan**: at least Starter (for disk)

### Disk (required for SQLite)
Add a persistent disk:
- Mount path: `/var/data`
- Size: your choice

Set env:
- `DATABASE_PATH=/var/data/mr_market.db`

### Required env vars
Set these at minimum (production should not rely on auto-generated secrets):
- `NODE_ENV=production`
- `PORT=3000` (Render sets this; keep consistent)

- `ADMIN_PASSWORD=...`
- `JWT_SECRET=...` (random long string)
- `ENCRYPTION_PRIVATE_KEY=...`

- `REDIS_URL=...` (from step 1)

Optional:
- `COINGECKO_API_KEY=...`
- all Mixin / exchange keys depending on what features you want enabled

### Build / Start
Render will build the Dockerfile in `server/`.

The `server/Dockerfile` runs:
- build
- migrations
- start:prod

### Notes
- WebSocket (Socket.IO) shares the same port as HTTP.
- Do NOT set `WS_PORT` on Render.

## 3) Deploy interface (Static Site)
1. Render dashboard → New → **Static Site**
2. Select this repo
3. **Root Directory**: `interface`
4. **Build Command**: `bun install --frozen-lockfile && bun run build`
5. **Publish Directory**:
   - If using adapter-static: `build`
   - If using adapter-auto/node: not compatible with Static Site

### Choose a frontend adapter
To deploy as Static Site, set the interface adapter to static.

Recommended:
- set env `ADAPTER=static` in Render Static Site

And ensure the project uses adapter-static when `ADAPTER=static`.

### Env vars
Set at least:
- `PUBLIC_MRM_BACKEND_URL=https://<your-server>.onrender.com`
- `PUBLIC_MRM_SOCKET_URL=https://<your-server>.onrender.com`
- `PUBLIC_APP_URL=https://<your-frontend>.onrender.com`

## 4) Smoke test
- Frontend loads
- Create order flow hits backend
- `/health/system-status` returns OK
- Admin → Health page shows real status (tick loop, queues)

