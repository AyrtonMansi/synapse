# Synapse Production Deployment

> Deterministic runbook for deploying Synapse to staging/production.
> Last updated: 2026-02-24

---

## Quick Start (Summary)

```bash
# 1. Build and push images
git push origin main  # Triggers GitHub Actions → GHCR

# 2. Deploy to server
ssh user@server "cd /app && ./scripts/deploy-prod.sh"

# 3. Configure DNS (see DOMAIN_TLS_RUNBOOK.md)
# 4. Deploy frontends to Vercel (see VERCEL_DEPLOY.md)
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         INTERNET                             │
└──────────────────┬──────────────────────────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
    ▼              ▼              ▼
┌─────────┐  ┌─────────┐  ┌──────────────┐
│ Vercel  │  │ Vercel  │  │   VM/Host    │
│Landing  │  │Web UI   │  │  (Docker)    │
│:443     │  │:443     │  │  :443/:3001  │
└────┬────┘  └────┬────┘  └──────┬───────┘
     │            │              │
     │            │         ┌────┴────┐
     │            │         │  Nginx  │
     │            │         │  Proxy  │
     │            │         └────┬────┘
     │            │              │
     │            │      ┌───────┼───────┐
     │            │      ▼       ▼       ▼
     │            │   ┌────┐  ┌────┐  ┌────┐
     │            │   │API │  │ WS │  │ DB │
     │            │   │:3001│  │:3002│  │    │
     │            │   └────┘  └────┘  └────┘
     │            │
     └────────────┴──────────────────────► https://api.* / wss://ws.*
```

---

## Phase A: Build & Push Images

### 1. Verify GitHub Actions Workflow

File: `.github/workflows/docker-build.yml`

Already configured to:
- Build on every push to `main`
- Push multi-arch images (amd64, arm64) to GHCR
- Run Trivy security scans
- Generate SBOMs

### 2. Images Built

| Image | Tag | Path |
|-------|-----|------|
| `ghcr.io/ayrtonmansi/synapse-gateway-api` | `latest`, `main`, `sha` | `services/gateway-api/` |
| `ghcr.io/ayrtonmansi/synapse-router` | `latest`, `main`, `sha` | `services/router/` |
| `ghcr.io/ayrtonmansi/synapse-node-agent` | `latest`, `main`, `sha` | `services/node-agent/` |
| `ghcr.io/ayrtonmansi/synapse-web-ui` | `latest`, `main`, `sha` | `services/web-ui/` |

### 3. Verify Build

```bash
# Check GitHub Actions output
gh run list --workflow=docker-build.yml

# Or check packages directly
gh api /users/ayrtonmansi/packages/container/synapse-gateway-api/versions
```

---

## Phase B: Server Setup

### 1. Provision VM

Recommended: Hetzner CPX21 (4 vCPU, 8GB RAM, €8.20/mo)
Alternative: DigitalOcean Droplet 4GB ($24/mo)

Requirements:
- Ubuntu 22.04 LTS
- Docker 24+
- Docker Compose 2+
- Open ports: 22, 80, 443

### 2. Initial Setup

```bash
# On server
mkdir -p /app
cd /app

# Copy deployment files
scp docker-compose.prod.yml user@server:/app/
scp -r infra/nginx user@server:/app/infra/
scp scripts/deploy-prod.sh user@server:/app/scripts/
scp scripts/validate-public-staging.sh user@server:/app/scripts/

# Create env file
cp .env.example .env.prod
# Edit .env.prod with production values
```

### 3. Deploy

```bash
ssh user@server "cd /app && ./scripts/deploy-prod.sh production"
```

This will:
1. Pull latest images from GHCR
2. Backup existing data
3. Rolling restart services
4. Run health checks
5. Execute smoke tests

---

## Phase C: Frontend Deployment (Vercel)

See detailed guide: [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md)

### Quick Steps

1. **Landing Page**
   - Import `synapse-landing` folder to Vercel
   - Framework: Next.js
   - Build: `npm run build`
   - Output: `dist`

2. **Dashboard**
   - Import `services/web-ui` folder to Vercel
   - Framework: Vite
   - Build: `npm ci && npm run build`
   - Output: `dist`
   - Env vars: `VITE_API_URL`, `VITE_WS_URL`

---

## Phase D: DNS + TLS

See detailed guide: [DOMAIN_TLS_RUNBOOK.md](./DOMAIN_TLS_RUNBOOK.md)

### DNS Records

| Record | Type | Target |
|--------|------|--------|
| `synapse.sh` | CNAME | `cname.vercel-dns.com` |
| `app.synapse.sh` | CNAME | `cname.vercel-dns.com` |
| `api.synapse.sh` | A | `<SERVER_IP>` |
| `ws.synapse.sh` | A | `<SERVER_IP>` |

### TLS Options

1. **Cloudflare Origin Certificates** (Easiest)
   - Generate 15-year origin cert in Cloudflare
   - Copy to `infra/nginx/ssl/`
   - Use "Full (strict)" SSL mode

2. **Let's Encrypt** (Standard)
   ```bash
   certbot certonly --standalone -d api.synapse.sh -d ws.synapse.sh
   ```

---

## Phase E: Validation

### Local Validation

```bash
# On server
cd /app
./scripts/validate-public-staging.sh --local
```

### Public Validation

```bash
# From any machine
./scripts/validate-public-staging.sh
```

### Manual Checks

```bash
# 1. Gateway health
curl https://api.synapse.sh/health

# 2. Generate API key
curl -X POST https://api.synapse.sh/auth/api-key \
  -H "Content-Type: application/json" \
  -d '{"wallet":"0xTestWallet"}'

# 3. Test chat completion (with key)
curl -X POST https://api.synapse.sh/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v3","messages":[{"role":"user","content":"Hello"}]}'

# 4. WebSocket
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Host: ws.synapse.sh" \
  -H "Origin: https://app.synapse.sh" \
  https://ws.synapse.sh/ws
```

---

## Rollback

### Service Rollback

```bash
# On server
cd /app

# Rollback to previous image
docker-compose -f docker-compose.prod.yml pull gateway-api:previous-tag
docker-compose -f docker-compose.prod.yml up -d gateway-api

# Or restore from backup
tar -xzf backups/backup-20240224-120000.tar.gz -C data/
docker-compose -f docker-compose.prod.yml restart gateway-api
```

### Vercel Rollback

1. Go to Vercel Dashboard → Deployments
2. Find last working deployment
3. Click **Promote to Production**

---

## Monitoring

### Docker Logs

```bash
docker-compose -f docker-compose.prod.yml logs -f gateway-api
docker-compose -f docker-compose.prod.yml logs -f router
```

### Health Checks

```bash
# Gateway
curl -s https://api.synapse.sh/health | jq

# Stats
curl -s https://api.synapse.sh/stats | jq

# WebSocket (requires wscat)
npm install -g wscat
wscat -c wss://ws.synapse.sh/ws
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `unauthorized: authentication required` | Run `docker login ghcr.io` with PAT |
| `port 3001 already in use` | Kill process: `sudo lsof -ti:3001 \| xargs kill -9` |
| `CORS error` | Update `CORS_ORIGINS` in `.env.prod` |
| `WebSocket timeout` | Ensure ws subdomain is DNS-only (not proxied) |
| `SSL certificate error` | Check cert paths in `nginx.conf` |

---

## Files Reference

| File | Purpose |
|------|---------|
| `docker-compose.prod.yml` | Production services definition |
| `infra/nginx/nginx.conf` | Reverse proxy + TLS config |
| `scripts/deploy-prod.sh` | Automated deployment script |
| `scripts/validate-public-staging.sh` | Health & smoke tests |
| `DEPLOYMENT_TARGETS.md` | Component → platform mapping |
| `DOMAIN_TLS_RUNBOOK.md` | DNS & certificate setup |
| `VERCEL_DEPLOY.md` | Frontend deployment guide |

---

## Support

- Deployment issues: Check `docker-compose logs`
- DNS issues: Verify with `dig +trace api.synapse.sh`
- TLS issues: Test with `openssl s_client -connect api.synapse.sh:443`
