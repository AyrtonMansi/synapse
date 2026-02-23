# Archive

This directory contains legacy and experimental code that is **not part of the canonical Synapse runtime**.

## Status

All code in `/archive` is:
- **Deprecated**: No longer maintained
- **Non-canonical**: Not used in production
- **Reference only**: Kept for historical purposes

## Canonical Runtime

The only supported runtime is in `/services`:
- `services/gateway-api` - OpenAI-compatible API gateway
- `services/router` - Node registry and job dispatch
- `services/node-agent` - GPU/CPU inference node
- `services/web-ui` - Developer portal

## Landing Page

The viral unlock landing page is in `/synapse-landing` (separate from services, can be deployed standalone).

## Migration

If you need functionality from an archived folder:
1. Check if it exists in `/services` (likely improved)
2. If not, open an issue describing the use case
3. Do not use archived code directly in production

## Contents

- `synapse-advanced/` - Experimental advanced features
- `synapse-backend/` - Early backend prototypes
- `synapse-contracts/` - Old contract experiments (see `/contracts` for production)
- `synapse-core/` - Core library prototypes
- `synapse-frontend/` - Old frontend attempts
- `synapse-node/` - Early node implementations
- `synapse-payments/` - Payment experiments
- `synapse-sdk/` - SDK prototypes
- `synapse-testing/` - Test utilities (migrated to `/services/*/tests`)

## Questions?

See main README or open an issue.
