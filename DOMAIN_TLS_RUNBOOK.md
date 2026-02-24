# Synapse Domain & TLS Runbook

> Complete guide for setting up domains and TLS certificates for Synapse staging/production.

---

## Prerequisites

- Domain name registered (e.g., `synapse.sh`)
- DNS provider access (Cloudflare recommended)
- Server/VPS with public IP (for container host)

---

## Phase 1: DNS Configuration

### Subdomain Mapping

Create these DNS A records pointing to your server's public IP:

| Subdomain | Type | Target | Purpose |
|-----------|------|--------|---------|
| `synapse.sh` | CNAME | `cname.vercel-dns.com` | Landing page (Vercel) |
| `app.synapse.sh` | CNAME | `cname.vercel-dns.com` | Dashboard (Vercel) |
| `api.synapse.sh` | A | `<SERVER_IP>` | Gateway API |
| `ws.synapse.sh` | A | `<SERVER_IP>` | WebSocket Router |

### Cloudflare Setup (Recommended)

1. **Add domain to Cloudflare**
   - Sign up at <https://dash.cloudflare.com>
   - Add your domain
   - Update nameservers at registrar

2. **DNS Records in Cloudflare**
   ```
   Type: CNAME
   Name: @ (or synapse)
   Target: cname.vercel-dns.com
   Proxy status: DNS only (grey cloud)
   
   Type: CNAME
   Name: app
   Target: cname.vercel-dns.com
   Proxy status: DNS only (grey cloud)
   
   Type: A
   Name: api
   IPv4: <YOUR_SERVER_IP>
   Proxy status: Proxied (orange cloud) - optional
   
   Type: A
   Name: ws
   IPv4: <YOUR_SERVER_IP>
   Proxy status: DNS only (grey cloud) - WS needs direct connection
   ```

3. **SSL/TLS Mode**
   - Go to SSL/TLS → Overview
   - Set to "Full (strict)" if using Cloudflare origin certs
   - Or "Full" if using self-signed/Let's Encrypt

---

## Phase 2: Vercel Domain Setup

### Project 1: synapse-landing

1. Go to Vercel Dashboard → Project → Settings → Domains
2. Add custom domain: `synapse.sh`
3. Vercel will provide DNS records
4. Add those records to Cloudflare/DNS provider
5. Wait for SSL provisioning (auto)

### Project 2: web-ui

1. Go to Vercel Dashboard → Project → Settings → Domains
2. Add custom domain: `app.synapse.sh`
3. Configure DNS as instructed
4. Set environment variables:
   ```
   VITE_API_URL=https://api.synapse.sh
   VITE_WS_URL=wss://ws.synapse.sh
   ```

---

## Phase 3: Server TLS Setup

### Option A: Let's Encrypt (Recommended for standalone)

1. **Install Certbot**
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install certbot

   # Or use Docker
   docker run -it --rm \
     -v /etc/letsencrypt:/etc/letsencrypt \
     -v /var/www/html:/var/www/html \
     certbot/certbot certonly --webroot -w /var/www/html \
     -d api.synapse.sh -d ws.synapse.sh
   ```

2. **Auto-renewal**
   ```bash
   # Add to crontab
   echo "0 12 * * * certbot renew --quiet" | sudo crontab -
   ```

3. **Copy certs for nginx**
   ```bash
   sudo mkdir -p /app/infra/nginx/ssl
   sudo cp /etc/letsencrypt/live/api.synapse.sh/fullchain.pem /app/infra/nginx/ssl/
   sudo cp /etc/letsencrypt/live/api.synapse.sh/privkey.pem /app/infra/nginx/ssl/
   ```

### Option B: Cloudflare Origin Certificates

1. **Generate origin cert in Cloudflare**
   - SSL/TLS → Origin Server → Create Certificate
   - Choose: Let Cloudflare generate private key
   - Include hostnames: `*.synapse.sh`, `synapse.sh`
   - Validity: 15 years

2. **Download and install**
   ```bash
   # Save as:
   /app/infra/nginx/ssl/cloudflare-origin.pem
   /app/infra/nginx/ssl/cloudflare-origin.key
   ```

3. **Update nginx.conf**
   ```nginx
   ssl_certificate /etc/nginx/ssl/cloudflare-origin.pem;
   ssl_certificate_key /etc/nginx/ssl/cloudflare-origin.key;
   ```

---

## Phase 4: CORS Configuration

Update `docker-compose.prod.yml` environment:

```yaml
gateway-api:
  environment:
    - CORS_ORIGINS=https://app.synapse.sh,https://synapse.sh,https://*.vercel.app
```

Or update nginx.conf:

```nginx
# Allow Vercel deployments
map $http_origin $cors_origin {
    default "";
    "~^https://.*\.vercel\.app$" $http_origin;
    "https://app.synapse.sh" $http_origin;
    "https://synapse.sh" $http_origin;
}
```

---

## Phase 5: Verification

```bash
# Test DNS resolution
dig api.synapse.sh
dig ws.synapse.sh

# Test TLS
curl -v https://api.synapse.sh/health
curl -v https://ws.synapse.sh/health

# Test WebSocket
wscat -c wss://ws.synapse.sh/ws

# Test from web-ui (browser console)
fetch('https://api.synapse.sh/stats')
  .then(r => r.json())
  .then(console.log)
```

---

## Troubleshooting

### Issue: Vercel domain not validating
- Ensure DNS records are DNS-only (grey cloud in Cloudflare)
- Wait 5-10 minutes for propagation
- Check with `dig CNAME synapse.sh +short`

### Issue: WebSocket connections failing
- WebSocket cannot go through Cloudflare proxy (orange cloud)
- Set ws.synapse.sh to DNS-only
- Check nginx config has `proxy_set_header Upgrade $http_upgrade;`

### Issue: CORS errors in browser
- Verify CORS_ORIGINS env var includes your domain
- Check response includes `Access-Control-Allow-Origin` header
- Ensure credentials mode matches (include vs omit)

### Issue: Let's Encrypt certificate fails
- Ensure port 80 is open for ACME challenge
- Check `/.well-known/acme-challenge/` is accessible
- Try: `certbot certonly --standalone -d api.synapse.sh`

---

## Quick Reference

| File | Path |
|------|------|
| Nginx config | `infra/nginx/nginx.conf` |
| Docker Compose | `docker-compose.prod.yml` |
| SSL certs | `infra/nginx/ssl/` |
| Deploy script | `scripts/deploy-prod.sh` |

---

## Rollback

If TLS causes issues:

```bash
# Revert to HTTP only
docker-compose -f docker-compose.prod.yml stop nginx
# Edit nginx.conf to remove SSL server blocks
docker-compose -f docker-compose.prod.yml up -d nginx
```
