# Synapse Vercel Deployment Guide

> Deploy synapse-landing and web-ui to Vercel in under 10 minutes.

---

## Prerequisites

- Vercel account (sign up at <https://vercel.com>)
- GitHub repo pushed with Synapse code
- Domain ready (optional but recommended)

---

## Project 1: synapse-landing

### Step 1: Import Project

1. Go to <https://vercel.com/new>
2. Import Git Repository → Select your Synapse repo
3. Configure:
   - **Framework Preset:** Next.js
   - **Root Directory:** `synapse-landing`
   - **Build Command:** `npm run build` (or leave default)
   - **Output Directory:** `dist`

4. Click **Deploy**

### Step 2: Configure Environment

1. Project Settings → Environment Variables
2. (None required for static landing)

### Step 3: Add Custom Domain (Optional)

1. Project Settings → Domains
2. Add `synapse.sh` (or your domain)
3. Follow Vercel DNS instructions:
   - Add CNAME record: `synapse.sh` → `cname.vercel-dns.com`
   - Or use A record with provided IPs
4. Wait for SSL provisioning (automatic)

### Screenshot Checklist

- [ ] Vercel project dashboard showing successful deployment
- [ ] Domains tab showing custom domain with green checkmark
- [ ] Live URL loads landing page

---

## Project 2: web-ui

### Step 1: Import Project

1. Go to <https://vercel.com/new> again
2. Import same Git Repository
3. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `services/web-ui`
   - **Build Command:** `npm ci && npm run build`
   - **Output Directory:** `dist`

4. Click **Deploy**

### Step 2: Configure Environment Variables

1. Project Settings → Environment Variables
2. Add:

| Variable | Value (Staging) | Value (Production) |
|----------|-----------------|-------------------|
| `VITE_API_URL` | `https://api.staging.synapse.sh` | `https://api.synapse.sh` |
| `VITE_WS_URL` | `wss://ws.staging.synapse.sh` | `wss://ws.synapse.sh` |
| `VITE_CHAIN_ID` | `31337` | `1` |

3. Save → Redeploy

### Step 3: Add Custom Domain

1. Project Settings → Domains
2. Add `app.synapse.sh`
3. Configure DNS:
   - CNAME: `app` → `cname.vercel-dns.com`
4. Wait for SSL

### Screenshot Checklist

- [ ] Vercel project dashboard showing web-ui deployment
- [ ] Environment variables configured
- [ ] Custom domain with SSL
- [ ] API calls working (check browser network tab)

---

## Verification

### Landing Page

```bash
curl -s https://synapse.sh | head -20
# Should return HTML with "Synapse" in title
```

### Web UI

```bash
curl -s https://app.synapse.sh | head -20
# Should return HTML with app bundle

# Check API connectivity
curl -s https://api.synapse.sh/stats
# Should return JSON with nodes_online, jobs_today
```

---

## Troubleshooting

### Build Fails: "Cannot find module"

1. Check `services/web-ui/package.json` exists
2. Verify `npm ci` works locally:
   ```bash
   cd services/web-ui
   npm ci && npm run build
   ```
3. Check Vercel build logs for specific error

### 404 on Refresh (Vite SPA)

Already handled by `vercel.json` rewrite rule:
```json
{
  "source": "/(.*)",
  "destination": "/index.html"
}
```

### CORS Errors

1. Check `VITE_API_URL` points to correct domain
2. Verify gateway-api CORS_ORIGINS includes your Vercel domain
3. Check browser console for specific error

### Environment Variables Not Working

1. Vite requires `VITE_` prefix for client-side env vars
2. Redeploy after changing env vars (they're baked at build time)
3. Check `import.meta.env.VITE_API_URL` in code

---

## Rollback

If deployment breaks:

1. Vercel Dashboard → Deployments
2. Find last working deployment
3. Click **…** → **Promote to Production**

Or via CLI:
```bash
npx vercel --version  # Ensure logged in
npx vercel rollback [deployment-url]
```

---

## Git Integration

Vercel auto-deploys on every push to:
- `main` branch → Production
- Other branches → Preview deployments

To disable:
Project Settings → Git → Pause Git Integration

---

## Cost

| Tier | Price | Limits |
|------|-------|--------|
| Hobby (Free) | $0 | 10k requests/day, 100GB bandwidth |
| Pro | $20/mo | 1M requests/day, 1TB bandwidth |

Landing + Web UI fit comfortably on Hobby tier for testnet.

---

## Next Steps

1. ✅ Vercel frontends deployed
2. → Deploy backend containers (see docker-compose.prod.yml)
3. → Configure DNS (see DOMAIN_TLS_RUNBOOK.md)
4. → Run validation (see scripts/validate-public-staging.sh)
