#!/bin/bash
# Repo Integrity Audit Script
# Validates that all referenced files/directories actually exist

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ERRORS=0

error() { echo "❌ ERROR: $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo "⚠️  WARNING: $1"; }
pass() { echo "✅ $1"; }

echo "=========================================="
echo "REPO INTEGRITY AUDIT"
echo "=========================================="

# Check PRODUCTION_BUILD_STATUS.md
echo "--- Checking PRODUCTION_BUILD_STATUS.md ---"
if [ ! -f "$PROJECT_ROOT/PRODUCTION_BUILD_STATUS.md" ]; then
    error "PRODUCTION_BUILD_STATUS.md does not exist"
else
    pass "PRODUCTION_BUILD_STATUS.md exists"
fi

# Check ARCHITECTURE.md
echo "--- Checking ARCHITECTURE.md ---"
if [ ! -f "$PROJECT_ROOT/ARCHITECTURE.md" ]; then
    error "ARCHITECTURE.md does not exist"
else
    pass "ARCHITECTURE.md exists"
    
    # Check claimed services exist
    for svc in gateway-api router node-agent settlement billing; do
        if [ ! -d "$PROJECT_ROOT/services/$svc" ]; then
            error "Service directory missing: services/$svc"
        fi
    done
fi

# Check contracts
echo "--- Checking contracts ---"
for contract in HSKToken Treasury ComputeEscrow NodeRewards NodeRegistry; do
    if [ ! -f "$PROJECT_ROOT/hsk-contracts/src/${contract}.sol" ]; then
        error "Contract missing: ${contract}.sol"
    fi
done
pass "All contracts present"

# Check K8s manifests
echo "--- Checking K8s manifests ---"
if [ ! -d "$PROJECT_ROOT/infra/k8s" ]; then
    error "infra/k8s directory missing"
else
    count=$(find "$PROJECT_ROOT/infra/k8s" -name "*.yaml" | wc -l)
    if [ "$count" -eq 0 ]; then
        error "No K8s manifests found"
    else
        pass "$count K8s manifests found"
    fi
fi

# Check Terraform
echo "--- Checking Terraform ---"
if [ ! -f "$PROJECT_ROOT/infra/terraform/main.tf" ]; then
    error "Terraform main.tf missing"
else
    pass "Terraform configuration exists"
fi

# Check CI workflows
echo "--- Checking CI workflows ---"
if [ ! -d "$PROJECT_ROOT/.github/workflows" ]; then
    error ".github/workflows directory missing"
else
    pass "CI workflows directory exists"
fi

# Check scripts
echo "--- Checking scripts ---"
for script in smoke-test.sh acceptance-test.sh install.sh; do
    if [ ! -f "$PROJECT_ROOT/scripts/$script" ]; then
        warn "Script missing: $script"
    fi
done
pass "Scripts checked"

# Check load tests
echo "--- Checking load tests ---"
if [ ! -d "$PROJECT_ROOT/tests/load" ]; then
    error "tests/load directory missing"
else
    pass "Load tests directory exists"
fi

# Summary
echo ""
echo "=========================================="
echo "AUDIT SUMMARY: $ERRORS errors"
echo "=========================================="

if [ $ERRORS -eq 0 ]; then
    echo "✅ REPO INTEGRITY PASSED"
    exit 0
else
    echo "❌ REPO INTEGRITY FAILED"
    exit 1
fi
