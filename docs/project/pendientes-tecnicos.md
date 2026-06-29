---
description: "Pendientes técnicos: APIs, calidad de código, scripts, mejoras"
category: project
priority: medium
agent_role: plan
---

# vCenter Provisioner — Pendientes Técnicos

> **Última actualización:** 2026-05-20

---

## APIs Implementadas por Servicio

| Servicio | Puerto | Endpoints |
|----------|--------|-----------|
| api-gateway | 3000 | `/health`, proxy routes |
| auth-service | 3001 | `/health`, `/register`, `/login` |
| typing-service | 8000 | `/health`, `/templates` CRUD, `/generate-name/{id}`, `/vm-classes` CRUD |
| vm-orchestrator | 8080 | `/health`, `/provision`, `/status/:id` |
| vcenter-operations | 8091 | `/health`, `/connection/test`, `/vms`, `/datacenters`, `/clusters`, `/datastores`, `/create-vm` (MOCK) |
| credential-manager | 8090 | `/health`, `/api/vcenters` CRUD, `/api/vcenters/:id/test`, `/api/vcenters/:id/audit`, Basic Auth only (12 tests) |
| stats-service | 8001 | `/health`, `/api/provision-logs`, `/stats/*`, `/api/custom-charts` CRUD |
| monitoring-service | 8083 | `/health`, `/api/probe-result`, `/api/services-status`, `/api/services-history`, `/api/connectivity-matrix`, `/metrics` |
| provisioner-ui | 5173 | Login, Dashboard, Typifications, VM Classes, vCenters, Stats, Monitor (37 tests) |

---

## Servicios con Tests

| Servicio | Archivos Test | Líneas Test |
|----------|---------------|-------------|
| api-gateway | 3 | 1210 |
| auth-service | 2 | 575 |
| vm-orchestrator | 1 | 341 |
| vcenter-operations | 1 | 272 |
| typing-service | 1 | 441 |
| stats-service | 1 | 176 |
| provisioner-ui | 4 | ~700 |

---

## 🟡 Calidad de Código

### Error Handling Inconsistente

| Archivo | Problema |
|---------|----------|
| `apps/api-gateway/src/index.ts` | Empty catch blocks, `console.log` vs `server.log` |
| `apps/provisioner-ui/src/hooks/vcenter/*.ts` | Empty catch blocks |
| `apps/auth-service/src/server.ts` | Empty catch blocks |

**Solución:** `fastify.setErrorHandler()` global. Sin catch blocks vacíos.

### Duplicación de Código

| Archivo | Líneas | Problema |
|---------|--------|----------|
| `apps/vm-orchestrator/main.go` | 124-173 | Validación duplicada |
| `apps/vcenter-operations/main.go` | 126-144, 158-176, 189-208 | Credential parsing repetido 3× |
| `apps/api-gateway/src/index.ts` | 82-89, 91-98 | Endpoints duplicados |

**Solución:** Extraer lógica común a funciones reutilizables.

### Sin Retry / Circuit Breaker

- `apps/vm-orchestrator/main.go`: Sin retry para llamadas externas
- `apps/monitoring-service/main.go`: Sin retry para Redis/PostgreSQL

**Solución:** Retry con exponential backoff + circuit breaker.

### Estado en Memoria (No Production-Ready)

| Archivo | Línea | Problema |
|---------|-------|----------|
| `apps/vm-orchestrator/main.go` | 92 | `var states` en memoria — se pierde al reiniciar |
| `apps/stats-service/app/main.py` | 26-31 | `stats_data` in-memory |

**Solución:** Persistir a PostgreSQL, Redis para caché.

### Tipo `any` Excesivo

| Archivo | Línea | Problema |
|---------|-------|----------|
| `apps/api-gateway/src/index.ts` | 37, 53 | `error: any`, `request: any` |

**Solución:** Tipos específicos para todas las interfaces.

### Testing Gaps

| Servicio | Estado |
|----------|--------|
| `monitoring-service` | Sin tests |
| `credential-manager` | 87 líneas, cobertura baja |

**Solución:** Mínimo 20 tests adicionales por servicio. Coverage objetivo >70%.

---

## 🟠 Scripts Faltantes

### Deployment

| Script | Estado |
|--------|--------|
| `scripts/deploy.sh` | ❌ Falta |
| `scripts/deploy-ui.sh` | ❌ Falta |

### CI/Pipeline

| Script | Estado |
|--------|--------|
| `scripts/ci/test.sh` | ❌ Falta |
| `scripts/testing/run-integration.sh` | ❌ Falta |
| `scripts/testing/run-e2e.sh` | ❌ Falta |
| `scripts/testing/run-perf.sh` | ❌ Falta |
| `scripts/testing/run-security.sh` | ❌ Falta |
| `scripts/testing/run-accessibility.sh` | ❌ Falta |

---

## Documentación Faltante

| Servicio | README.md |
|----------|-----------|
| credential-manager | ❌ Falta |

---

## Checklist Técnico

- [ ] Agregar `fastify.setErrorHandler()` global en servicios Node
- [ ] Implementar retry logic con exponential backoff + circuit breaker
- [ ] Extraer código duplicado a funciones reutilizables
- [ ] Persistir estado en PostgreSQL/Redis (eliminar in-memory stores)
- [ ] Ampliar tests monitoring-service y credential-manager
- [ ] Agregar OpenAPI/Swagger a servicios FastAPI (Python) y Fastify (Node)
- [ ] Eliminar uso de tipo `any` en TypeScript
- [ ] `scripts/deploy.sh` y `scripts/deploy-ui.sh`
- [ ] `scripts/ci/test.sh`
- [ ] `README.md` credential-manager

---

## Context7 — Mejores Prácticas

| Área | Estado Actual | Context7 Recomienda |
|------|--------------|---------------------|
| **Logging Node.js** | `console.log/error` | `server.log.error()` (Fastify built-in) |
| **Error Handling** | Sin global handler | `fastify.setErrorHandler()` |
| **Logging Go** | Mix `log` y `slog` | Solo `slog` (Go 1.21+) |
| **Configuración** | Fallback to defaults | Fail-fast si vars críticas no existen |
| **CORS** | `origin: true` | Whitelist explícita |
