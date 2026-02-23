#!/bin/bash
# OpenClaw Watchdog Script
# Ensures gateway stays running, logs restarts

WATCHDOG_LOG="logs/watchdog.log"
GATEWAY_PID_FILE="/tmp/openclaw-gateway.pid"
RESTART_COUNT=0
MAX_RESTARTS=10

# Create logs directory if missing
mkdir -p logs

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$WATCHDOG_LOG"
}

log "Watchdog started"

while true; do
  # Check if openclaw-gateway process is running
  if pgrep -f "openclaw-gateway" > /dev/null 2>&1; then
    # Process running, reset counter
    RESTART_COUNT=0
  else
    # Process not running
    RESTART_COUNT=$((RESTART_COUNT + 1))
    
    if [ "$RESTART_COUNT" -gt "$MAX_RESTARTS" ]; then
      log "CRITICAL: Max restarts ($MAX_RESTARTS) exceeded. Manual intervention required."
      exit 1
    fi
    
    log "Gateway not running. Restart attempt $RESTART_COUNT/$MAX_RESTARTS"
    
    # Try to restart gateway
    if command -v openclaw-gateway &> /dev/null; then
      openclaw-gateway &
      sleep 2
      
      if pgrep -f "openclaw-gateway" > /dev/null 2>&1; then
        log "Gateway restarted successfully"
      else
        log "ERROR: Gateway restart failed"
      fi
    else
      log "ERROR: openclaw-gateway command not found"
    fi
  fi
  
  # Check every 10 seconds
  sleep 10
done
