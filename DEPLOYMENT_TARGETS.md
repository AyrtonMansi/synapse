# Synapse Deployment Targets

> Generated: 2026-02-24
> Target: Testnet/Staging
> Philosophy: Vercel for frontends, containers for stateful/long-lived services

---

## Frontend (Vercel)

### synapse-landing
- **Type:** Next.js 14 (Static Export)
- **Platform:** Vercel
- **Root Directory:** `synapse-landing/`
- **Build Command:** `npm run build`
- **Output:** `dist/` (static)
- **Domain:** `synapse.example.com`

### services/web-ui
- **Type:** Vite + React SPA
- **Platform:** Vercel
- **Root Directory:** `services/web-ui/`
- **Build Command:** `npm ci && npm run build`
- **Output:** `dist/`
- **Domain:** `app.example.com`
- **Env Vars:**
  - `VITE_API_URL=https://api.example.com`
  - `VITE_WS_URL=wss://ws.example.com`

---

## Backend Services (Containers)

### gateway-api
- **Type:** Fastify HTTP API
- **Platform:** Fly.io / Render / Railway (or EC2)
- **Runtime:** Node 20 Alpine
- **Port:** 3001
- **Protocol:** HTTP/REST
- **Domain:** `api.example.com`
- **Notes:** Stateless, can scale horizontally

### router
- **Type:** Fastify + WebSocket
- **Platform:** Fly.io (always-on)
- **Runtime:** Node 20 Alpine  
- **Port:** 3002
- **Protocol:** WebSocket (ws:// internally, wss:// externally)
- **Domain:** `ws.example.com`
- **Notes:** Long-lived WS connections, cannot use serverless

### coordinator
- **Type:** Service-to-service coordinator
- **Platform:** Fly.io / same host as router
- **Runtime:** Node 20 Alpine
- **Port:** 3003
- **Protocol:** HTTP + internal comms
- **Notes:** Not yet fully implemented (no package.json)

### settlement
- **Type:** Daemon/batch processor
- **Platform:** Fly.io / same host
- **Runtime:** Node 20 Alpine
- **Protocol:** Internal only
- **Notes:** Cron-like settlement daemon, no package.json yet

---

## Infrastructure

### Single-Host Option (Fastest)
- One Linux VM (4GB+ RAM)
- Docker Compose with all backend services
- Nginx reverse proxy + Let's Encrypt
- Total cost: ~$10-20/month (Hetzner, DigitalOcean)

### PaaS Option (More Robust)
- Fly.io: gateway-api, router, coordinator, settlement as separate apps
- Fly.io volumes for persistence
- Auto-scaling for gateway-api
- Total cost: ~$20-40/month

### Database
- SQLite (gateway-api local): `/app/data/gateway.db`
- No external DB needed for testnet

---

## Domain Mapping

| Subdomain | Target | Purpose |
|-----------|--------|---------|
| `synapse.example.com` | Vercel (landing) | Marketing site |
| `app.example.com` | Vercel (web-ui) | Operator dashboard |
| `api.example.com` | Container host | REST API |
| `ws.example.com` | Container host | WebSocket router |

---

## Environment Variables

### Vercel (synapse-landing)
_None needed for static site_

### Vercel (web-ui)
```
VITE_API_URL=https://api.example.com
VITE_WS_URL=wss://ws.example.com
VITE_CHAIN_ID=31337  # or 1 for mainnet later
```

### Container Host (all services)
```
# Shared
NODE_ENV=production
LOG_LEVEL=info

# gateway-api
PORT=3001
ROUTER_URL=http://router:3002
DATABASE_URL=/app/data/gateway.db
CORS_ORIGINS=https://app.example.com,https://synapse.example.com

# router
PORT=3002
COORIDNATOR_URL=http://coordinator:3003

# coordinator
PORT=3003
ROUTER_URL=http://router:3002

# settlement
SETTLEMENT_INTERVAL_MS=60000
COORIDNATOR_URL=http://coordinator:3003
```

---

## Decision Log

1. **Why not Kubernetes?** Overkill for testnet. Single VM + Docker Compose deploys in minutes.
2. **Why Fly.io over Render/Railway?** Better WebSocket support, closer to bare metal.
3. **Why Vercel for frontends?** Zero-config, global CDN, perfect for static/React apps.
4. **Why not serverless for gateway-api?** Could work, but containers give us flexibility for SQLite persistence.
