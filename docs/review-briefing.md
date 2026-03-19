# Review Briefing: vCenter Provisioning Stack 📊

> **Última actualización:** 2026-02-06
> **Estado:** Legacy - Actualizado parcialmente

## ⚠️ Aviso

Este documento contenía un roadmap ambicioso que **no se materializó completamente**. Esta versión refleja el **estado real** del proyecto.

---

## 1. Estado de Implementación por Módulo

| Módulo | Estado | Observaciones |
|:-------|:------:|:--------------|
| **Autenticación (JWT)** | ✅ | Implementado, sin refresh tokens |
| **TP-Haki (Tipificaciones)** | ✅ | Completo con contadores |
| **VM Classes** | ✅ | Gold, Silver, Bronze, Micro |
| **vCenter Adapter** | ⚠️ | Solo mock |
| **Monitoring** | ✅ | Sistema de probes implementado |
| **Stats Service** | ✅ | Métricas básicas |
| **Audit Logs** | ✅ | Tabla implementada |
| **Vault/Secretos** | ❌ | Variables de entorno estáticas |
| **Prometheus** | ⚠️ | Healthchecks básicos, sin scraping |
| **Kafka/RabbitMQ** | ❌ | No implementado |
| **Distributed Tracing** | ❌ | No implementado |

---

## 2. Healthchecks Implementados

### ✅ Endpoint `/health` (Todos los servicios)

```json
{
  "status": "ok",
  "service": "api-gateway",
  "timestamp": "2026-02-06T17:00:00Z"
}
```

| Servicio | Puerto | Healthcheck |
|:---------|:------:|:------------|
| API Gateway | 3000 | ✅ |
| Auth Service | 3001 | ✅ |
| Typing Service | 8000 | ✅ |
| VM Orchestrator | 8080 | ✅ |
| vCenter Adapter | 8081 | ✅ |
| Stats Service | 8001 | ✅ |
| Monitoring | 8082 | ✅ |
| Backup Service | 8002 | ✅ |
| Provisioner UI | 5173 | ✅ |

---

## 3. Sistema de Monitoreo (IMPLEMENTADO)

### ✅ Probe Scheduler Distribuido

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROBES DISTRIBUIDOS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  probe-scheduler.sh en cada servicio:                            │
│  ├── Modo 'full': probea todos los targets                     │
│  ├── Modo 'sample': N targets aleatorios                       │
│  └── Envía a monitoring-service:8082/api/probe-result           │
│                                                                  │
│  monitoring-service:                                              │
│  ├── Redis (TTL 60s)                                           │
│  ├── PostgreSQL (histórico)                                      │
│  └── Endpoints:                                                  │
│      ├── GET /api/services-status                               │
│      ├── GET /api/connectivity-matrix                           │
│      └── POST /api/probe-result                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Configuración por Servicio

| Servicio | Intervalo | Modo | Targets |
|:---------|:---------:|:----:|:--------|
| api-gateway | 5s | full | 7 servicios |
| auth-service | 5s | full | 7 servicios |
| vm-orchestrator | 5s | full | 4 servicios |
| typing-service | 20s | sample (3) | api-gateway, orchestrator, monitoring |
| vcenter-operations | 20s | sample (3) | orchestrator, stats, monitoring |
| stats-service | 20s | sample (3) | api-gateway, orchestrator, monitoring |
| backup-service | 20s | sample (3) | orchestrator, monitoring |
| monitoring-service | 1s | full | 8 servicios |

---

## 4. Base de Datos (ACTUALIZADO)

### ✅ Tablas Implementadas

| Tabla | Propósito | Estado |
|:------|:----------|:------:|
| `users` | Autenticación | ✅ |
| `typification_templates` | Plantillas TP-Haki | ✅ |
| `typification_counters` | Contadores secuenciales | ✅ |
| `vm_classes` | Perfiles de hardware | ✅ |
| `vm_provisions` | Registro de provisiones | ✅ |
| `audit_logs` | Auditoría | ✅ |

---

## 5. Lo que SÍ Funciona

| Aspecto | Descripción |
|:--------|:------------|
| **Pipeline CI/CD** | `pipeline.ps1` unificado, tags hash determinísticos |
| **Docker Compose** | Producción local sin K8s |
| **Tests Híbridos** | Host (velocidad) + Docker (determinismo) |
| **Healthchecks** | Todos los servicios responden |
| **Monitoreo** | Sistema de probes activo |
| **Audit Trail** | Tabla `audit_logs` implementada |

---

## 6. Lo que NO Está Implementado (Roadmap Realista)

| Feature | Prioridad | Esfuerzo |
|:--------|:---------:|:---------:|
| **Refresh Tokens JWT** | Alta | Medio |
| **Vault/HashiCorp** | Media | Alto |
| **vCenter Real (no mock)** | Alta | Alto |
| **Prometheus Scraping** | Media | Medio |
| **Distributed Tracing** | Baja | Alto |

---

## 7. Documentación Relacionada

| Documento | Propósito |
|:---------|:----------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Arquitectura completa |
| [MONITORING-SYSTEM-DESIGN.md](./MONITORING-SYSTEM-DESIGN.md) | Sistema de monitoreo |
| [db-schema.md](./db-schema.md) | Esquema de BD |
| [CI-CD-LOCAL.md](./CI-CD-LOCAL.md) | Pipeline CI/CD |

---

© 2026 Antigravity Engineering | Review Reference
