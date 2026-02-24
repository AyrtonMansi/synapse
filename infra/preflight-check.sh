#!/bin/bash
# Pre-flight checks before deploying to production

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 Synapse Production Pre-flight Check"
echo "======================================"

ERRORS=0
WARNINGS=0

# Check environment variables
echo -e "\n${YELLOW}Environment Variables:${NC}"
if [ -z "$JWT_SECRET" ]; then
    echo -e "${RED}❌ JWT_SECRET not set${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓ JWT_SECRET set${NC}"
fi

if [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}❌ DB_PASSWORD not set${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓ DB_PASSWORD set${NC}"
fi

# Check secrets length
if [ "${#JWT_SECRET}" -lt 32 ]; then
    echo -e "${RED}❌ JWT_SECRET too short (min 32 chars)${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Docker
echo -e "\n${YELLOW}Docker:${NC}"
if docker info &> /dev/null; then
    echo -e "${GREEN}✓ Docker daemon running${NC}"
else
    echo -e "${RED}❌ Docker not running${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check kubectl
echo -e "\n${YELLOW}Kubernetes:${NC}"
if kubectl cluster-info &> /dev/null; then
    echo -e "${GREEN}✓ Kubernetes cluster accessible${NC}"
else
    echo -e "${RED}❌ Cannot reach Kubernetes cluster${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check node resources
echo -e "\n${YELLOW}Cluster Resources:${NC}"
NODES=$(kubectl get nodes -o json 2>/dev/null | jq '.items | length')
if [ "$NODES" -ge 3 ]; then
    echo -e "${GREEN}✓ $NODES nodes available (recommended: 3+)${NC}"
else
    echo -e "${YELLOW}⚠ Only $NODES nodes (recommend 3+ for HA)${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Check storage class
echo -e "\n${YELLOW}Storage:${NC}"
if kubectl get storageclass fast-ssd &> /dev/null; then
    echo -e "${GREEN}✓ fast-ssd storage class exists${NC}"
else
    echo -e "${YELLOW}⚠ fast-ssd storage class not found (will use default)${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Check cert-manager
echo -e "\n${YELLOW}TLS/SSL:${NC}"
if kubectl get clusterissuer letsencrypt-prod &> /dev/null; then
    echo -e "${GREEN}✓ Let's Encrypt ClusterIssuer configured${NC}"
else
    echo -e "${YELLOW}⚠ Let's Encrypt not configured (TLS won't work)${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Summary
echo -e "\n======================================"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Ready for deployment.${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s). Review before deploying.${NC}"
    exit 0
else
    echo -e "${RED}❌ $ERRORS error(s), $WARNINGS warning(s). Fix errors before deploying.${NC}"
    exit 1
fi
