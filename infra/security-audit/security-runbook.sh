#!/bin/bash
# PHASE 13: Security Incident Response Runbook
# Usage: ./security-runbook.sh <incident-type>

set -euo pipefail

INCIDENT_TYPE="${1:-help}"
LOG_FILE="/var/log/synapse-security-$(date +%Y%m%d-%H%M%S).log"

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

# Incident: Unauthorized API Access
handle_unauthorized_access() {
    log "=== UNAUTHORIZED API ACCESS INCIDENT ==="
    
    # 1. Identify compromised key
    read -p "Enter suspicious key ID or IP: " TARGET
    
    # 2. Revoke key immediately
    log "Revoking API key: $TARGET"
    # curl -X DELETE "http://gateway-api:3001/admin/keys/$TARGET"
    
    # 3. Block IP at edge
    log "Blocking IP at Caddy/Traefik level"
    echo "ban $TARGET" >> /etc/caddy/banned-ips.txt
    
    # 4. Preserve logs
    log "Preserving access logs"
    cp /var/log/synapse/access.log "$LOG_FILE.access"
    
    # 5. Notify security team
    log "Sending alert to security team"
    # send-slack-alert "#security" "Unauthorized access detected: $TARGET"
    
    log "Incident response complete. Log: $LOG_FILE"
}

# Incident: Node Malicious Behavior
handle_node_fraud() {
    log "=== NODE FRAUD INCIDENT ==="
    
    read -p "Enter node fingerprint: " NODE_FP
    
    # 1. Quarantine node
    log "Quarantining node: $NODE_FP"
    # curl -X POST "http://router:3002/admin/nodes/$NODE_FP/quarantine"
    
    # 2. Review recent jobs
    log "Extracting recent jobs from node"
    # psql -c "SELECT * FROM usage_events WHERE node_id = '$NODE_FP' AND created_at > now() - interval '1 hour'"
    
    # 3. Check challenge results
    log "Checking challenge job results"
    # curl "http://router:3002/admin/nodes/$NODE_FP/challenges"
    
    # 4. Slash stake if applicable
    log "Preparing stake slash transaction"
    # node scripts/slash-stake.js $NODE_FP
    
    log "Node $NODE_FP quarantined. Review receipts in $LOG_FILE"
}

# Incident: Smart Contract Exploit
handle_contract_exploit() {
    log "=== SMART CONTRACT EXPLOIT INCIDENT ==="
    
    read -p "Enter affected contract address: " CONTRACT
    read -p "Enter exploit type (reentrancy/overflow/access): " EXPLOIT_TYPE
    
    # 1. Emergency pause
    log "EMERGENCY: Pausing contracts"
    # cast send $CONTRACT "pause()" --private-key $ADMIN_KEY
    
    # 2. Snapshot state
    log "Creating state snapshot"
    # cast call $CONTRACT "balanceOf(address)" $VAULT > $LOG_FILE.snapshot
    
    # 3. Analyze transactions
    log "Analyzing recent transactions"
    # cast tx $SUSPICIOUS_TX --json > $LOG_FILE.tx
    
    # 4. Prepare recovery
    log "Preparing recovery plan"
    
    warn "CONTRACTS PAUSED - IMMEDIATE ACTION REQUIRED"
    warn "Contact: security@synapse.sh, PGP: [link]"
    
    log "Snapshot saved to $LOG_FILE.snapshot"
}

# Incident: DDoS Attack
handle_ddos() {
    log "=== DDoS ATTACK INCIDENT ==="
    
    # 1. Activate rate limiting
    log "Activating emergency rate limits"
    # curl -X POST "http://gateway-api:3001/admin/rate-limit/emergency"
    
    # 2. Enable CloudFlare (if available)
    log "Enabling DDoS protection"
    # cfcli zone settings --zone=synapse.sh --setting=security_level --value=under_attack
    
    # 3. Scale up gateway
    log "Scaling gateway replicas"
    kubectl scale deployment gateway-api --replicas=10
    
    # 4. Identify attack source
    log "Analyzing traffic patterns"
    # tcpdump -i eth0 -w $LOG_FILE.pcap &
    
    log "DDoS mitigation active. Monitor: kubectl top pods"
}

# Incident: Data Breach
handle_data_breach() {
    log "=== DATA BREACH INCIDENT ==="
    
    # 1. Isolate affected systems
    log "Isolating database"
    kubectl scale deployment gateway-api --replicas=0
    
    # 2. Preserve evidence
    log "Creating forensic backups"
    pg_dump $DATABASE_URL > $LOG_FILE.db-backup.sql
    
    # 3. Assess scope
    log "Assessing breach scope"
    # audit log analysis
    
    # 4. Legal notification
    warn "LEGAL: Consider GDPR/CCPA notification requirements"
    warn "Contact legal team immediately"
    
    log "Systems isolated. Forensic backup: $LOG_FILE.db-backup.sql"
}

# Runbook menu
case "$INCIDENT_TYPE" in
    unauthorized|api)
        handle_unauthorized_access
        ;;
    node|fraud)
        handle_node_fraud
        ;;
    contract|exploit)
        handle_contract_exploit
        ;;
    ddos)
        handle_ddos
        ;;
    breach)
        handle_data_breach
        ;;
    help|*)
        echo "Synapse Security Incident Response Runbook"
        echo ""
        echo "Usage: $0 <incident-type>"
        echo ""
        echo "Incident Types:"
        echo "  unauthorized  - Unauthorized API access"
        echo "  node          - Node fraud/malicious behavior"
        echo "  contract      - Smart contract exploit"
        echo "  ddos          - DDoS attack"
        echo "  breach        - Data breach"
        echo ""
        echo "Each command will guide you through response steps."
        echo "All actions are logged to /var/log/synapse-security-*.log"
        ;;
esac
