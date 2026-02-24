#!/bin/bash
set -e

# Synapse Production Deployment Script
# Usage: ./deploy-production.sh [environment]
# Environments: staging, production

ENV=${1:-staging}
NAMESPACE="synapse"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Synapse Production Deployment${NC}"
echo "Environment: $ENV"
echo "========================================"

# Validate prerequisites
echo -e "\n${YELLOW}Checking prerequisites...${NC}"

if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl not found${NC}"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ docker not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites met${NC}"

# Build and push images
echo -e "\n${YELLOW}Building Docker images...${NC}"

docker build -t synapse/gateway-api:latest ../services/gateway-api
docker build -t synapse/router:latest ../services/router

if [ "$ENV" == "production" ]; then
    echo -e "${YELLOW}Pushing to registry...${NC}"
    docker push synapse/gateway-api:latest
    docker push synapse/router:latest
fi

echo -e "${GREEN}✓ Images built${NC}"

# Create namespace and secrets
echo -e "\n${YELLOW}Setting up namespace and secrets...${NC}"

kubectl apply -f k8s/namespace.yaml

# Generate secrets if they don't exist
if ! kubectl get secret db-credentials -n $NAMESPACE &> /dev/null; then
    echo -e "${YELLOW}Creating database credentials...${NC}"
    DB_PASSWORD=$(openssl rand -base64 32)
    kubectl create secret generic db-credentials \
        --from-literal=url="postgres://synapse:${DB_PASSWORD}@postgres:5432/synapse" \
        --from-literal=password="$DB_PASSWORD" \
        -n $NAMESPACE
fi

if ! kubectl get secret app-secrets -n $NAMESPACE &> /dev/null; then
    echo -e "${YELLOW}Creating app secrets...${NC}"
    JWT_SECRET=$(openssl rand -base64 64)
    kubectl create secret generic app-secrets \
        --from-literal=jwt-secret="$JWT_SECRET" \
        --from-literal=api-key-salt="$(openssl rand -base64 32)" \
        -n $NAMESPACE
fi

echo -e "${GREEN}✓ Secrets configured${NC}"

# Deploy database first
echo -e "\n${YELLOW}Deploying database...${NC}"
kubectl apply -f k8s/database.yaml

# Wait for database to be ready
echo -e "${YELLOW}Waiting for PostgreSQL to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=120s

echo -e "${YELLOW}Waiting for Redis to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=60s

echo -e "${GREEN}✓ Database ready${NC}"

# Deploy core services
echo -e "\n${YELLOW}Deploying core services...${NC}"
kubectl apply -f k8s/gateway-api.yaml

# Wait for rollout
echo -e "${YELLOW}Waiting for Gateway API rollout...${NC}"
kubectl rollout status deployment/gateway-api -n $NAMESPACE --timeout=300s

echo -e "${GREEN}✓ Core services deployed${NC}"

# Deploy ingress
echo -e "\n${YELLOW}Deploying ingress...${NC}"
kubectl apply -f k8s/ingress.yaml

echo -e "${GREEN}✓ Ingress configured${NC}"

# Verify deployment
echo -e "\n${YELLOW}Verifying deployment...${NC}"
kubectl get pods -n $NAMESPACE
kubectl get services -n $NAMESPACE
kubectl get ingress -n $NAMESPACE

echo -e "\n${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Configure DNS to point api.synapse.sh to your load balancer"
echo "2. Check pod logs: kubectl logs -f deployment/gateway-api -n synapse"
echo "3. Access Grafana at: http://localhost:3000 (kubectl port-forward svc/grafana 3000:3000)"
