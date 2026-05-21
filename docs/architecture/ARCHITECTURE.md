---
description: "Arquitectura K8s completa. Usar al planear deploys, debuggear infraestructura o entender servicios."
category: architecture
priority: high
agent_role: plan, deploy, debug
paths: ["k8s/**/*.yaml", "k8s/**/*.yml"]
---

# Architecture — vCenter Provisioner (K8s)

## Overview

Plataforma de aprovisionamiento de VMs en vSphere con 9 microservicios desacoplados,
desplegada en Kubernetes con Kustomize overlays (dev/staging/prod).

## Services

| Service | Stack | Port | Responsibility |
|---|---|---|---|
| **api-gateway** | Node.js (Fastify) | 3000 | Entry point, JWT verification, reverse proxy |
| **auth-service** | Node.js (Fastify) | 3001 | Identity, RBAC, token rotation, rate limiting |
| **typing-service** | Python (FastAPI) | 8000 | VM naming engine (TP-Haki), dynamic typification |
| **vm-orchestrator** | Go | 8080 | State machine: clone → spec → powerOn → IP check |
| **vcenter-operations** | Go (govmomi) | 8091 | vSphere SDK: VM CRUD, inventory |
| **credential-manager** | Node.js | 8090 | vCenter connections, credential lifecycle |
| **stats-service** | Python (FastAPI) | 8001 | Telemetry aggregation, business metrics |
| **monitoring-service** | Go | 8082 | Health sentinel, Prometheus metrics, probes |
| **provisioner-ui** | React (MUI, Vite) | 80 | Staff-grade dashboard + provisioning wizard |

## Kubernetes Resources

```
k8s/
├── base/                          # Manifiestos base (todos los entornos)
│   ├── namespace.yaml
│   ├── configmaps/                # ConfigMaps por servicio
│   ├── secrets/                   # Secrets encriptados (SOPS)
│   ├── backing-services/          # StatefulSets: Postgres 15, Redis 7, PgBouncer
│   ├── pvcs/                      # PersistentVolumeClaims (Postgres 10Gi, Redis 2Gi)
│   ├── jobs/                      # Jobs: db-init, migrations
│   ├── httpproxy/                 # Contour HTTPProxy → vc-ui.playground.net
│   ├── network-policies/          # Restricciones de ingress por servicio
│   └── cert-manager/              # Certificates, ClusterIssuers (Let's Encrypt + CA interno)
└── overlays/
    ├── dev/                       # Dev overlay (namespace: vcenter-provisioner-dev)
    ├── staging/                   # Staging overlay
    └── prod/                      # Prod overlay (namespace: vcenter-provisioner-prod)
```

## Networking

Ingress via Contour HTTPProxy:

| Prefix | Backend | Port | Note |
|---|---|---|---|
| `/auth` | api-gateway | 3000 | Authentication endpoints |
| `/api` | api-gateway | 3000 | Rewrite `/api` → `/` |
| `/` | provisioner-ui | 80 | Static frontend |

- FQDN: `vc-ui.playground.net`
- TLS: cert-manager (Let's Encrypt staging/prod + CA interno)
- VIP: `10.12.4.169`

### API Gateway Probes

| Variable | Valor | Descripción |
|---|---|---|
| PROBE_MODE | `full` | Health checks periódicos a todos los servicios backend |
| PROBE_TARGETS | auth-service, typing-service, vm-orchestrator, vcenter-operations, stats-service, monitoring-service | Servicios monitoreados |
| CORS_ORIGINS | Configurado por entorno | Orígenes permitidos para CORS |
| MONITORING_URL | monitoring-service | Conexión al servicio de monitoreo para health probes |

## Backing Services

| Service | Type | Version | Storage | Port |
|---|---|---|---|---|
| PostgreSQL | StatefulSet | 15 | 10Gi PVC | 5432 |
| Redis | StatefulSet | 7 | 2Gi PVC | 6379 |
| PgBouncer | StatefulSet-like Deployment | latest | — | 6432 |

PgBouncer actúa como connection pooler entre los servicios y PostgreSQL.

## Jobs

| Job | Tipo | Propósito |
|---|---|---|
| db-init | Job | Inicializa esquemas de PostgreSQL en el primer despliegue |
| migrations | Job | Ejecuta migraciones de base de datos (Factor XII) |
| postgres-dump | CronJob | Backups periódicos de la base de datos |
| postgres-retention | CronJob | Limpieza y rotación de backups antiguos |

## TLS Infrastructure

| Recurso | Tipo | Propósito |
|---|---|---|
| vc-ui-tls | Certificate | Certificado TLS para el ingress (vc-ui.playground.net) |
| vcenter-ca-secret | Secret (Opaque) | Certificado de CA interno |
| letsencrypt-staging/prod | ClusterIssuer | Let's Encrypt (staging para pruebas, prod para producción) |
| clusterissuer-selfsigned | ClusterIssuer | CA autofirmada para certificados internos |

## Secrets

| Secret | Tipo | Contenido |
|---|---|---|
| shared-secrets | Opaque | Secretos compartidos entre todos los deployments |
| vcenter-provisioner-secrets | Opaque | 12 claves, almacén central de secretos |
| auth-service | Opaque | JWT secrets, credenciales de autenticación |
| credential-manager | Opaque | Credenciales de conexiones vCenter |
| monitoring | Opaque | Configuración del servicio de monitoreo |
| stats | Opaque | Configuración de estadísticas |
| typing | Opaque | Configuración del motor de tipificación |
| vcenter-operations | Opaque | Credenciales de operaciones vSphere |
| vm-orchestrator | Opaque | Configuración del orquestador de VMs |

## Observability

- **Coroot**: metrics via PromQL API (`https://coroot.playground.net`)
- **Prometheus**: service-level metrics via `/metrics` endpoints
- **Health checks**: `/health` on all services (used for liveness/readiness probes)

## Twelve-Factor Compliance

Full alignment with 12-Factor methodology (see `k8s-migration.md`):
- Factor I: Single codebase, Kustomize overlays
- Factor III: Config in ConfigMaps/Secrets, no hardcoded values
- Factor V: Strict build → release → run separation
- Factor X: Dev/prod parity via Kustomize overlays
- Factor XI: Logs to stdout, collected by cluster
