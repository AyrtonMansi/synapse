#!/bin/bash
# setup-ssl.sh - SSL Certificate Setup for Synapse Infrastructure

set -e

echo "═══════════════════════════════════════════════════════════"
echo "           SSL CERTIFICATE SETUP"
echo "═══════════════════════════════════════════════════════════"
echo ""

DOMAIN="${1:-synapse.network}"
EMAIL="${2:-admin@synapse.network}"

echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo ""

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y certbot
    elif command -v yum &> /dev/null; then
        sudo yum install -y certbot
    elif command -v brew &> /dev/null; then
        brew install certbot
    else
        echo "❌ Could not install certbot. Please install manually."
        exit 1
    fi
fi

# Create SSL directory
mkdir -p deployment/configs/ssl

echo "🔐 Obtaining SSL certificates from Let's Encrypt..."

# Obtain certificates
sudo certbot certonly --standalone \
    -d "$DOMAIN" \
    -d "api.$DOMAIN" \
    -d "ipfs.$DOMAIN" \
    -d "monitor.$DOMAIN" \
    -d "status.$DOMAIN" \
    --agree-tos \
    --email "$EMAIL" \
    --non-interactive \
    --preferred-challenges http

# Copy certificates to deployment configs
sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" deployment/configs/ssl/
sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" deployment/configs/ssl/
sudo cp "/etc/letsencrypt/live/$DOMAIN/chain.pem" deployment/configs/ssl/

# Set up auto-renewal
echo ""
echo "🔄 Setting up auto-renewal..."

# Create renewal hook
cat > /etc/letsencrypt/renewal-hooks/deploy/synapse-reload.sh << EOF
#!/bin/bash
# Reload services after certificate renewal

echo "Reloading services after certificate renewal..."

# Reload HAProxy
docker exec synapse-haproxy haproxy -sf \$(cat /var/run/haproxy.pid) 2>/dev/null || true

# Reload Nginx
docker exec synapse-ipfs-nginx nginx -s reload 2>/dev/null || true

echo "Services reloaded"
EOF

chmod +x /etc/letsencrypt/renewal-hooks/deploy/synapse-reload.sh

# Test renewal
echo ""
echo "Testing certificate renewal..."
sudo certbot renew --dry-run

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "           ✅ SSL SETUP COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Certificates installed at:"
echo "  - deployment/configs/ssl/fullchain.pem"
echo "  - deployment/configs/ssl/privkey.pem"
echo "  - deployment/configs/ssl/chain.pem"
echo ""
echo "Auto-renewal configured. Certificates will renew automatically."
echo ""
echo "To manually renew: sudo certbot renew"
echo ""
