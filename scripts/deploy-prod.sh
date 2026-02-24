#!/bin/bash
# Synapse Production Deployment Script
# Usage: ./scripts/deploy-prod.sh [environment]
# Environments: staging (default), production

set -euo pipefail

# Configuration
ENVIRONMENT="${1:-staging}"
COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="/app/backups"
DATA_DIR="/app/data"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Pre-flight checks
check_prerequisites() {
    log "Checking prerequisites..."
    
    command -v docker >/dev/null 2>&1 || error "Docker is not installed"
    command -v docker-compose >/dev/null 2>&1 || error "Docker Compose is not installed"
    
    if [[ "$EUID" -ne 0 && ! $(groups | grep -q docker) ]]; then
        error "Must run as root or be in docker group"
    fi
    
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        error "Compose file not found: $COMPOSE_FILE"
    fi
    
    success "Prerequisites OK"
}

# Backup existing data
backup_data() {
    if [[ -d "$DATA_DIR" ]]; then
        log "Backing up existing data..."
        mkdir -p "$BACKUP_DIR"
        local backup_name="backup-$(date +%Y%m%d-%H%M%S).tar.gz"
        tar -czf "$BACKUP_DIR/$backup_name" -C "$DATA_DIR" . 2>/dev/null || true
        success "Backup created: $BACKUP_DIR/$backup_name"
    fi
}

# Pull latest images
pull_images() {
    log "Pulling latest images..."
    docker-compose -f "$COMPOSE_FILE" pull
    success "Images pulled"
}

# Graceful rolling restart
rolling_restart() {
    log "Starting rolling restart..."
    
    # Stop optional services first
    docker-compose -f "$COMPOSE_FILE" --profile settlement stop settlement 2>/dev/null || true
    docker-compose -f "$COMPOSE_FILE" --profile coordinator stop coordinator 2>/dev/null || true
    
    # Restart core services in order
    log "Restarting router..."
    docker-compose -f "$COMPOSE_FILE" up -d --no-deps router
    sleep 5
    
    log "Restarting gateway-api..."
    docker-compose -f "$COMPOSE_FILE" up -d --no-deps gateway-api
    sleep 5
    
    # Restart optional services if profiles enabled
    if docker-compose -f "$COMPOSE_FILE" config --profiles | grep -q coordinator; then
        log "Restarting coordinator..."
        docker-compose -f "$COMPOSE_FILE" --profile coordinator up -d coordinator
    fi
    
    if docker-compose -f "$COMPOSE_FILE" config --profiles | grep -q settlement; then
        log "Restarting settlement..."
        docker-compose -f "$COMPOSE_FILE" --profile settlement up -d settlement
    fi
    
    success "Services restarted"
}

# Health checks
health_check() {
    log "Running health checks..."
    
    local max_attempts=30
    local attempt=1
    
    # Check gateway-api
    log "Checking gateway-api..."
    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf http://localhost:3001/health >/dev/null 2>&1; then
            success "gateway-api is healthy"
            break
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    if [[ $attempt -gt $max_attempts ]]; then
        error "gateway-api failed health check"
    fi
    
    # Check router
    attempt=1
    log "Checking router..."
    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf http://localhost:3002/health >/dev/null 2>&1; then
            success "router is healthy"
            break
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    if [[ $attempt -gt $max_attempts ]]; then
        error "router failed health check"
    fi
}

# Smoke test
smoke_test() {
    log "Running smoke tests..."
    
    if [[ -f "scripts/validate-public-staging.sh" ]]; then
        ./scripts/validate-public-staging.sh --local
    else
        warn "Validation script not found, skipping smoke tests"
    fi
}

# Cleanup old images
cleanup() {
    log "Cleaning up old images..."
    docker image prune -f --filter "until=168h"  # Remove images older than 7 days
    success "Cleanup complete"
}

# Main deployment flow
main() {
    log "Starting Synapse deployment - Environment: $ENVIRONMENT"
    
    check_prerequisites
    backup_data
    pull_images
    rolling_restart
    health_check
    smoke_test
    cleanup
    
    success "Deployment complete!"
    log "Services status:"
    docker-compose -f "$COMPOSE_FILE" ps
    
    log ""
    log "Next steps:"
    log "  1. Verify endpoints:"
    log "     - curl http://localhost:3001/health"
    log "     - curl http://localhost:3002/health"
    log "  2. Check logs: docker-compose -f $COMPOSE_FILE logs -f"
    log "  3. Update DNS to point to this server"
}

# Handle signals
trap 'error "Deployment interrupted"' INT TERM

main "$@"
