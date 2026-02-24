# Synapse Million-User Production Architecture

## Overview
Scalable distributed inference network ready for 1M+ users.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CDN (Vercel Edge)                               │
│                    Static Assets + API Gateway (rate limit)                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
┌───────────────────▼────────┐  ┌──────▼──────┐  ┌───────▼────────┐
│   Web UI (Vercel)          │  │  Cloudflare │  │  Vercel API    │
│   - Static hosting         │  │  DDoS/WAF   │  │  - Edge funcs  │
└────────────────────────────┘  └─────────────┘  └────────────────┘
                                       │
                              ┌────────▼────────┐
                              │  Load Balancer  │
                              │  (Cloudflare)   │
                              └────────┬────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
┌─────────────▼──────────┐  ┌──────────▼──────────┐  ┌─────────▼──────────┐
│  Gateway API (Fly.io)  │  │  Gateway API        │  │  Gateway API       │
│  - Auth/Rate Limit     │  │  - Auth/Rate Limit  │  │  - Auth/Rate Limit │
│  - Job dispatch        │  │  - Job dispatch     │  │  - Job dispatch    │
│  Region: us-east       │  │  Region: eu-west    │  │  Region: ap-south  │
└─────────────┬──────────┘  └──────────┬──────────┘  └─────────┬──────────┘
              │                        │                       │
              └────────────────────────┼───────────────────────┘
                                       │
                              ┌────────▼────────┐
                              │   PostgreSQL    │
                              │   (Supabase)    │
                              │   - API Keys    │
                              │   - Usage Logs  │
                              │   - Billing     │
                              └────────┬────────┘
                                       │
                              ┌────────▼────────┐
                              │     Redis       │
                              │   (Upstash)     │
                              │   - Sessions    │
                              │   - Rate Limit  │
                              │   - Job Queue   │
                              └────────┬────────┘
                                       │
┌──────────────────────────────────────┼──────────────────────────────────────┐
│                         Router Cluster (3x nodes)                           │
│                    - Job routing & load balancing                           │
│                    - Node health monitoring                                 │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────┼──────────────────────────────────────┐
│                              GPU Node Network                               │
│                  - Decentralized compute providers                          │
│                  - Proof-of-compute verification                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Component | Technology | Provider | Purpose |
|-----------|------------|----------|---------|
| Frontend | Next.js + React | Vercel | Web UI, landing |
| API Gateway | Fastify (Node.js) | Fly.io | REST API, auth |
| Database | PostgreSQL | Supabase | Persistent data |
| Cache | Redis | Upstash | Sessions, rate limits |
| Queue | Redis Streams | Upstash | Job queue |
| Load Balancer | Cloudflare | Cloudflare | DDoS, SSL, routing |
| Monitoring | Prometheus + Grafana | Self-hosted | Metrics, alerts |
| Logging | Loki + Grafana | Self-hosted | Centralized logs |
| Object Storage | S3-compatible | Tigris/MinIO | Receipts, exports |

## Scaling Numbers

| Metric | Current | 100K Users | 1M Users |
|--------|---------|------------|----------|
| Requests/min | 100 | 10,000 | 100,000 |
| Peak RPS | 2 | 200 | 2,000 |
| DB Connections | 10 | 100 | 500 |
| Cache Memory | 100MB | 10GB | 100GB |
| Storage | 1GB | 500GB | 5TB |
| GPU Nodes | 5 | 500 | 5,000 |
| Regions | 1 | 3 | 6 |

## Cost Estimates (Monthly)

### 100K Users
- Vercel Pro: $20
- Fly.io (3 regions): $150
- Supabase: $25
- Upstash: $80
- Cloudflare Pro: $20
- Monitoring: $50
- **Total: ~$345/month**

### 1M Users
- Vercel Enterprise: $200
- Fly.io (6 regions, auto-scale): $800
- Supabase: $150
- Upstash: $300
- Cloudflare Business: $200
- Monitoring: $200
- **Total: ~$1,850/month**

## Deployment Files

See `infra/` directory for:
- `docker-compose.prod.yml` - Local production stack
- `k8s/` - Kubernetes manifests
- `fly.toml` - Fly.io configuration
- `terraform/` - Infrastructure as code
