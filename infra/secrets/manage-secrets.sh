#!/bin/bash
# Secrets Management Script for Synapse
# Handles secret rotation, encryption, and secure deployment

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SECRETS_DIR="$PROJECT_ROOT/secrets"
ENCRYPTED_DIR="$SECRETS_DIR/encrypted"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Initialize secrets directory
init() {
    log "Initializing secrets directory..."
    mkdir -p "$ENCRYPTED_DIR"
    chmod 700 "$SECRETS_DIR"
    
    # Create .gitignore
    cat > "$SECRETS_DIR/.gitignore" << 'EOF'
# Never commit plaintext secrets
*.key
*.pem
*.password
.env.local
plaintext/
EOF
    
    log "Secrets directory initialized"
    log "IMPORTANT: Add '$SECRETS_DIR/plaintext/' to your .gitignore"
}

# Generate a new API signing key
generate_api_key() {
    log "Generating new API signing key..."
    openssl rand -hex 32 > "$SECRETS_DIR/api-signing-key.key"
    chmod 600 "$SECRETS_DIR/api-signing-key.key"
    log "API signing key generated: $SECRETS_DIR/api-signing-key.key"
}

# Generate mTLS certificates for service-to-service auth
generate_mtls_certs() {
    log "Generating mTLS certificates..."
    
    mkdir -p "$SECRETS_DIR/mtls"
    cd "$SECRETS_DIR/mtls"
    
    # Generate CA
    openssl req -x509 -newkey rsa:4096 -keyout ca.key -out ca.crt \
        -days 365 -nodes -subj "/CN=Synapse CA/O=Synapse Network"
    
    # Generate server cert
    openssl req -newkey rsa:2048 -keyout server.key -out server.csr \
        -nodes -subj "/CN=router.synapse.internal/O=Synapse"
    openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key \
        -CAcreateserial -out server.crt -days 365
    
    # Generate client cert for gateway
    openssl req -newkey rsa:2048 -keyout gateway.key -out gateway.csr \
        -nodes -subj "/CN=gateway.synapse.internal/O=Synapse"
    openssl x509 -req -in gateway.csr -CA ca.crt -CAkey ca.key \
        -CAcreateserial -out gateway.crt -days 365
    
    chmod 600 *.key
    log "mTLS certificates generated in $SECRETS_DIR/mtls/"
}

# Encrypt secrets with GPG or openssl
encrypt() {
    local file="$1"
    if [ ! -f "$file" ]; then
        error "File not found: $file"
    fi
    
    log "Encrypting $file..."
    openssl enc -aes-256-cbc -salt -pbkdf2 -in "$file" \
        -out "$ENCRYPTED_DIR/$(basename "$file").enc"
    log "Encrypted: $ENCRYPTED_DIR/$(basename "$file").enc"
}

# Decrypt secrets
decrypt() {
    local file="$1"
    if [ ! -f "$file" ]; then
        error "File not found: $file"
    fi
    
    local output="${file%.enc}"
    log "Decrypting $file..."
    openssl enc -aes-256-cbc -d -pbkdf2 -in "$file" -out "$output"
    log "Decrypted: $output"
}

# Rotate a secret
rotate() {
    local name="$1"
    log "Rotating secret: $name"
    
    # Backup old secret
    if [ -f "$SECRETS_DIR/$name" ]; then
        mv "$SECRETS_DIR/$name" "$SECRETS_DIR/${name}.old.$(date +%Y%m%d)"
    fi
    
    # Generate new based on type
    case "$name" in
        api-signing-key.key)
            generate_api_key
            ;;
        *.crt|*.key)
            generate_mtls_certs
            ;;
        *)
            openssl rand -hex 32 > "$SECRETS_DIR/$name"
            chmod 600 "$SECRETS_DIR/$name"
            ;;
    esac
    
    log "Secret rotated: $name"
    warn "Remember to restart services to pick up new secrets"
}

# Load secrets into environment (for Docker)
load_env() {
    log "Loading secrets into environment..."
    
    export SYNAPSE_API_SIGNING_KEY="$(cat "$SECRETS_DIR/api-signing-key.key" 2>/dev/null || echo 'dev-key-do-not-use')"
    export SYNAPSE_MTLS_CA="$(cat "$SECRETS_DIR/mtls/ca.crt" 2>/dev/null || echo '')"
    export SYNAPSE_MTLS_KEY="$(cat "$SECRETS_DIR/mtls/gateway.key" 2>/dev/null || echo '')"
    export SYNAPSE_MTLS_CERT="$(cat "$SECRETS_DIR/mtls/gateway.crt" 2>/dev/null || echo '')"
    
    log "Environment loaded"
}

# Check secrets health
check() {
    log "Checking secrets health..."
    
    local issues=0
    
    # Check API signing key
    if [ ! -f "$SECRETS_DIR/api-signing-key.key" ]; then
        warn "API signing key missing"
        issues=$((issues + 1))
    else
        log "✓ API signing key present"
    fi
    
    # Check mTLS certs
    if [ ! -f "$SECRETS_DIR/mtls/ca.crt" ]; then
        warn "mTLS CA certificate missing"
        issues=$((issues + 1))
    else
        log "✓ mTLS certificates present"
    fi
    
    # Check file permissions
    find "$SECRETS_DIR" -type f -perm /o+rwx 2>/dev/null | while read -r file; do
        warn "Insecure permissions on: $file"
        issues=$((issues + 1))
    done
    
    if [ $issues -eq 0 ]; then
        log "All secrets healthy"
    else
        warn "Found $issues issue(s)"
    fi
}

# Main command handler
case "${1:-help}" in
    init)
        init
        ;;
    generate-api-key)
        generate_api_key
        ;;
    generate-mtls)
        generate_mtls_certs
        ;;
    encrypt)
        encrypt "$2"
        ;;
    decrypt)
        decrypt "$2"
        ;;
    rotate)
        rotate "$2"
        ;;
    load-env)
        load_env
        ;;
    check)
        check
        ;;
    help|*)
        echo "Synapse Secrets Management"
        echo ""
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  init                  Initialize secrets directory"
        echo "  generate-api-key      Generate new API signing key"
        echo "  generate-mtls         Generate mTLS certificates"
        echo "  encrypt <file>        Encrypt a file"
        echo "  decrypt <file>        Decrypt a file"
        echo "  rotate <name>         Rotate a secret"
        echo "  load-env              Load secrets into environment"
        echo "  check                 Check secrets health"
        ;;
esac
