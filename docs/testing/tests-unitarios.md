---
description: "Estrategia de testing, tests unitarios por servicio, línea base histórica"
category: testing
priority: high
agent_role: test
paths: ["**/*.test.ts", "**/*.spec.ts", "**/*_test.go", "**/test_*.py"]
---

# tests-unitarios.md — Estrategia, Inventario y Línea Base

**Versión:** 1.0 | **Alcance:** Unit Tests, Estrategia, Cobertura, Línea Base Histórica

---

## Visión General

- Validación E2E del aprovisionamiento de VMs: autenticación → orquestación
- 8 servicios bajo prueba:

| Servicio | Puerto | Lenguaje |
|----------|--------|----------|
| api-gateway | 3000 | Node.js |
| auth-service | 3001 | Node.js |
| typing-service | 8000 | Python |
| vm-orchestrator | 8080 | Go |
| vcenter-operations | 8091 | Go |
| stats-service | 8001 | Python |
| credential-manager | 8090 | Node.js |
| monitoring-service | 8082 | Go |

---

## Estrategia de Testing

### Pirámide (70/20/10)

| Tipo | % | Cantidad | Tiempo |
|------|---|----------|--------|
| Unit Tests | 70% | ~140 | ~5s |
| Integration Tests | 20% | ~40 | ~20s |
| E2E Tests | 10% | ~8 | ~2min |

### Objetivos de Cobertura

- **Target general:** 70% statements todos los servicios
- **Lógica crítica** (auth, tipificación, orquestación): ≥80%
- **Servicios soporte** (monitoreo, stats): ≥60%
- **Exclusiones:** Configuración, modelos auto-generados, Dockerfiles

### Cobertura Funcional por Feature

| Feature | Prioridad | Target |
|---------|-----------|--------|
| Autenticación (Login/JWT) | Alta | 100% |
| Motor de Tipificación de Nombres | Alta | 100% |
| Máquina de Estados de Orquestación | Alta | 100% |
| Wizard UI (Navegación por pasos) | Media | 90% |
| Integración vCenter (Mock) | Media | 80% |
| Stats y Analytics | Baja | 60% |
| Health Checks de Monitoreo | Baja | 60% |

### Matriz de Riesgos

| Riesgo | Impacto | Prob. | Mitigación |
|--------|---------|-------|------------|
| Mock vCenter no refleja realidad | Alto | Media | Mock basado en govmomi, documentar limitación |
| Tests E2E lentos (>5 min) | Medio | Alta | Sharding Playwright (4 workers) |
| Flaky tests UI por timing | Medio | Media | `waitForSelector` con timeouts explícitos |
| Sin acceso a vCenter real | Bajo | Alta | Mock como limitación conocida |

---

## Inventario de Tests por Servicio

| Servicio | Tests | Categorías clave |
|----------|-------|-----------------|
| VM Orchestrator (Go) | 36 | State machine, errores, status/polling, validación, HTTP handlers |
| Auth Service (Node.js) | 31 | Password hashing, JWT, registro/login, verify, expiración, concurrentes |
| Typing Service (Python) | 16 | CRUD templates, generación nombres, validación, RFC 1123 |
| API Gateway (Node.js) | 16 | Health check, JWT verify, proxy rutas, CORS, protección rutas |
| Stats Service (Python) | 18 | Stats collector, REST, validación, concurrentes |
| vCenter Operations (Go) | 13 | Creación VM, edge cases, validación HTTP (puerto **8091**) |
| Monitoring Service (Go) | 13 | Health check, métricas Prometheus, concurrentes |
| Credential Manager (Node.js) | — | Unit tests Vitest (puerto **8090**) |

---

## Línea Base Histórica (Enero 2026)

- Estado de cobertura en fase MVP — referencia histórica, no estado actual

| Servicio | Tests | Cobertura Histórica | Target |
|----------|-------|-------------------|--------|
| vm-orchestrator | 36 | 77.0% | 70% |
| auth-service | 31 | 70.51% | 70% |
| typing-service | 16 | 97% | 70% |
| api-gateway | 16 | 81.39% | 70% |
| stats-service | 18 | 93% | 70% |
| vcenter-operations | 13 | 80.6% | 70% |
| monitoring-service | 13 | 76.0% | 70% |
| **TOTAL** | **143** | **~82.4%** | **70%** |

- **Estado:** 143/143 tests pasando (100%), todos los servicios sobre target 70%
- **Fases completadas:** Unit Tests, Integración (14), E2E (34), Performance (3 suites), Seguridad (20), Accesibilidad (27)
