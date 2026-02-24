# Synapse Deployment Runbook

> **Version:** 1.0  
> **Last Updated:** 2026-02-24  
> **Scope:** Vercel deployment for Landing + Gateway UI

---

## Prerequisites

```bash
# Install Vercel CLI
npm i -g vercel

# Login (one-time)
vercel login

# Verify
vercel --version  # >= 50.0.0
```

---

## Project Structure

```
/Users/ayrtonmansi/.openclaw/workspace/
├── synapse-landing/          # Next.js landing page
│   ├── src/app/page.tsx
│   └── vercel.json
└── services/
    └── web-ui/               # Vite React gateway UI
        ├── src/
        ├── api/              # Vercel serverless API proxy
        └── vercel.json
```

---

## 1. Landing Page Deployment

### 1.1 Create Vercel Project

```bash
cd /Users/ayrtonmansi/.openclaw/workspace/synapse-landing

# Link to existing project or create new
vercel link
# ? Set up "~/synapse-landing"? [Y/n] Y
# ? Which scope? [ayrton-8893s-projects]
# ? Link to existing project? [y/N] N
# ? What's your project name? [synapse-landing]
```

### 1.2 Configure Environment Variables

```bash
# Production
vercel env add NODE_ENV production
# Enter value: production

# No API URL needed for landing (static)
```

### 1.3 Deploy

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

**Expected Output:**
```
🔍  Inspect: https://vercel.com/ayrton-8893s-projects/synapse-landing/xxxxx
✅  Production: https://synapse-landing-ayuy0xco9-ayrton-8893s-projects.vercel.app
```

---

## 2. Gateway UI Deployment

### 2.1 Create Vercel Project

```bash
cd /Users/ayrtonmansi/.openclaw/workspace/services/web-ui

# Link to existing project
vercel link
# ? Set up "~/services/web-ui"? [Y/n] Y
# ? Which scope? [ayrton-8893s-projects]
# ? Link to existing project? [y/N] N
# ? What's your project name? [synapse-gateway]
```

### 2.2 Configure Environment Variables

```bash
# API URL (use demo mode if backend not deployed)
vercel env add VITE_API_URL
# Enter value: /api/v1  # Uses Vercel serverless proxy

# Demo mode flag (when no real backend)
vercel env add VITE_DEMO_MODE
# Enter value: true

# Production flag
vercel env add VITE_PROD
# Enter value: true
```

**When Backend is Ready:**
```bash
vercel env add VITE_API_URL
# Enter value: https://api.synapse.sh/v1

vercel env add VITE_WS_URL
# Enter value: wss://ws.synapse.sh/v1
```

### 2.3 Deploy

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

---

## 3. API Proxy Configuration

The Gateway UI includes a Vercel serverless function that proxies requests to the backend (when available) or returns mock data (demo mode).

### 3.1 File: `api/v1/[...path].ts`

```typescript
// Proxies /api/v1/* to backend or returns mocks
```

### 3.2 Demo Mode Endpoints

| Endpoint | Method | Response |
|----------|--------|----------|
| `/api/v1/health` | GET | `{ status: "ok", version: "1.0.0" }` |
| `/api/v1/stats` | GET | `{ nodes: 47, latency: 89, tps: 124 }` |
| `/api/v1/chat/completions` | POST | Streamed mock response |
| `/api/v1/keys` | POST | `{ key: "synapse_..." }` |

---

## 4. GitHub Integration (CI/CD)

### 4.1 Connect Repository

1. Go to https://vercel.com/dashboard
2. Select project → Settings → Git
3. Connect GitHub repository
4. Configure:
   - **Production Branch:** `main`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist` (web-ui) or `.next` (landing)

### 4.2 Preview Deployments

Every PR gets a preview URL automatically.

### 4.3 GitHub Actions (Alternative)

For custom CI/CD workflows, use the provided GitHub Actions:

```yaml
# .github/workflows/deploy-gateway.yml
# .github/workflows/deploy-landing.yml
```

**Required Secrets:**
- `VERCEL_TOKEN`: Your Vercel API token
- `VERCEL_ORG_ID`: Your Vercel organization ID
- `VERCEL_PROJECT_ID_WEBUI`: Project ID for web-ui
- `VERCEL_PROJECT_ID_LANDING`: Project ID for landing

**Get your tokens:**
```bash
vercel tokens create
cat .vercel/project.json  # Contains orgId and projectId
```

---

## 5. Custom Domain Setup

### 5.1 Add Domain

```bash
# For landing
cd synapse-landing
vercel domains add synapse.sh

# For gateway
cd services/web-ui
vercel domains add app.synapse.sh
```

### 5.2 Configure DNS

Add to your DNS provider:

```
Type: CNAME
Name: @
Value: cname.vercel-dns.com

Type: CNAME
Name: app
Value: cname.vercel-dns.com
```

### 5.3 Configure TLS

Vercel auto-provisions Let's Encrypt certificates. No manual action needed.

---

## 6. Health Check

Visit `/health` on the Gateway UI to verify:

```json
{
  "status": "healthy",
  "timestamp": "2026-02-24T22:37:00Z",
  "version": "1.0.0",
  "environment": "production",
  "dependencies": {
    "api": { "status": "connected", "latency": 45 },
    "ws": { "status": "disconnected" }
  },
  "demo_mode": true
}
```

---

## 7. Troubleshooting

### Build Fails

```bash
# Check local build first
cd services/web-ui
npm run build

# Check TypeScript errors
npx tsc --noEmit
```

### API 404

Verify `vercel.json` rewrites:
```json
{
  "rewrites": [
    { "source": "/api/v1/(.*)", "destination": "/api/v1/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Environment Variables Not Loading

```bash
# Pull latest env vars
vercel env pull .env.local

# Verify in UI
vercel env ls
```

---

## 8. Switching to Real Backend

When your backend is deployed:

```bash
cd services/web-ui

# Update API URL
vercel env add VITE_API_URL production
# Enter value: https://your-api.com/v1

# Disable demo mode
vercel env add VITE_DEMO_MODE production
# Enter value: false

# Redeploy
vercel --prod
```

---

## 9. Current Deployments

| Project | URL | Status |
|---------|-----|--------|
| Landing | https://synapse-landing-7mkkoj40p-ayrton-8893s-projects.vercel.app | ✅ Live |
| Gateway | https://web-pri4fr91w-ayrton-8893s-projects.vercel.app | ✅ Live (Production Ready) |

### Deployment Details
- **Landing Project ID**: ayrton-8893s-projects/synapse-landing
- **Gateway Project ID**: ayrton-8893s-projects/web-ui

### Environment Variables Configured
- `VITE_API_URL`: `/api/v1` (uses Vercel serverless proxy)
- `VITE_DEMO_MODE`: `true` (mock responses until backend ready)

### Verified Routes
| Route | Description |
|-------|-------------|
| `/` | Landing page with API key generation |
| `/health` | System health check (public) |
| `/docs` | Documentation |
| `/gateway/chat` | Chat interface |
| `/gateway/sessions` | Session history |
| `/gateway/keys` | API key management |
| `/gateway/usage` | Usage statistics |
| `/gateway/nodes` | Node management |
| `/gateway/run-node` | Node setup guide |
| `/gateway/settings` | App settings |
| `/gateway/privacy` | Privacy settings |
| `/api/v1/*` | API proxy (serverless functions) |

---

## Quick Commands Reference

```bash
# Deploy both projects
(cd synapse-landing && vercel --prod) && (cd services/web-ui && vercel --prod)

# View logs
vercel logs synapse-landing --prod
vercel logs synapse-gateway --prod

# Open in browser
vercel open

# List deployments
vercel list
```
