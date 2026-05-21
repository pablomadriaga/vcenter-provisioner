---
description: "Estado histórico de implementación por módulo. Ver ARCHITECTURE.md para estado actual."
category: project
priority: low
agent_role: reference
---

# Review Briefing: vCenter Provisioning Stack 📊

> **Documento histórico. Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para estado actual.**

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

| Servicio | Puerto |
|:---------|:------:|
| API Gateway | 3000 |
| Auth Service | 3001 |
| Typing Service | 8000 |
| VM Orchestrator | 8080 |
| vCenter Adapter | 8091 |
| Stats Service | 8001 |
| Monitoring | 8083 |
| Backup Service | 8002 |
| Provisioner UI | 5173 |

---

## 3. Sistema de Monitoreo (IMPLEMENTADO)

Probe scheduler distribuido: cada servicio ejecuta `probe-scheduler.sh` en modo full o sample, reportando a `monitoring-service:8083/api/probe-result`. El monitoring-service almacena en Redis (TTL 60s) y PostgreSQL (histórico).

| Servicio | Intervalo | Modo |
|:---------|:---------:|:----:|
| api-gateway | 5s | full |
| auth-service | 5s | full |
| vm-orchestrator | 5s | full |
| typing-service | 20s | sample (3) |
| vcenter-operations | 20s | sample (3) |
| stats-service | 20s | sample (3) |
| backup-service | 20s | sample (3) |
| monitoring-service | 1s | full |

---

## 4. Base de Datos

Tablas implementadas: `users`, `typification_templates`, `typification_counters`, `vm_classes`, `vm_provisions`, `audit_logs`.

---

## 5. Lo que SÍ Funciona

Pipeline CI/CD (`./pipeline.sh`), kustomize overlays, tests híbridos, healthchecks en todos los servicios, sistema de probes activo, audit trail (`audit_logs`).

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
| [DEPLOY.md](../deployment/DEPLOY.md) | Deploy en K8s |

---

© 2026 Antigravity Engineering | Review Reference
