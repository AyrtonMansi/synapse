#!/bin/bash
# Health check script for Synapse Node

API_URL="http://localhost:8080/health"
METRICS_URL="http://localhost:9090/metrics"

# Check API health
if curl -fsS "$API_URL" > /dev/null 2>&1; then
    exit 0
else
    echo "Health check failed: API not responding"
    exit 1
fi
