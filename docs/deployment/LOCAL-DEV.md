---
description: "Desarrollo local con Docker Compose. Solo para dev, no producción."
category: deployment
priority: medium
agent_role: deploy
---

# Local Development — vCenter Provisioner

> **Docker Compose es para desarrollo local únicamente. Producción corre en Kubernetes. Ver [DEPLOY.md](./DEPLOY.md).**

## Quick Start

```bash
./pipeline.sh                    # Full pipeline (start → lint → test → build)
./pipeline.sh --up               # Start services only
./pipeline.sh --down             # Stop services
./pipeline.sh --status           # Check status
./pipeline.sh --cleanup-full --force  # Clean everything
```

## Individual Operations

```bash
./pipeline.sh --lint             # Lint all services
./pipeline.sh --test             # Host + Docker tests
./pipeline.sh --test-host        # Host only (fast)
./pipeline.sh --test-docker      # Docker only (deterministic)
./pipeline.sh --build            # Build Docker images (smart cache)
./pipeline.sh --build-service typing-service  # Single service
```

## Configuration

Configuration is loaded from `config/`:

| File | Purpose |
|---|---|
| `config/services.json` | Service catalog: ports, dependencies, commands |
| `config/ports.json` | Port mappings (internal/external) |
| `config/test-manifest.json` | Test suite definitions |

## Service Map (Local Docker)

| Service | Port | Stack |
|---|---|---|
| api-gateway | 3000 | Node.js (Fastify) |
| auth-service | 3001 | Node.js (Fastify) |
| typing-service | 8000 | Python (FastAPI) |
| vm-orchestrator | 8085 | Go |
| vcenter-operations | 8091 | Go |
| credential-manager | 8090 | Node.js |
| stats-service | 8001 | Python (FastAPI) |
| monitoring-service | 8083 | Go |
| provisioner-ui | 5173 | React (Vite dev server) |
| db (PostgreSQL) | 5432 | Postgres 15 |

## Development Flow

1. Start services: `./pipeline.sh --up`
2. Make code changes
3. Run lint: `./pipeline.sh --lint`
4. Run tests: `./pipeline.sh --test`
5. Rebuild affected service: `./pipeline.sh --build-service <service>`

## Testing on K8s

```bash
npx playwright test --config=e2e/playwright.config.ts
```

## Database

```bash
docker exec vcenter-provisioner-db psql -U antigravity -d vcenter_provisioner
```
Schema: `docs/db-schema.md`
