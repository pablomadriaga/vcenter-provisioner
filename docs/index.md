---
description: "Mapa de documentación del vCenter Provisioner. Cargar primero para orientarse."
category: meta
priority: high
agent_role: all
---

# vCenter Provisioner — Knowledge Map

## Arquitectura
- [[architecture/ARCHITECTURE.md]] — Arquitectura K8s: servicios, recursos, networking, 12-Factor
- [[architecture/app-vcenter-provisioner.md]] — Propuesta original: por qué 9 servicios (histórico)
- [[architecture/ADR-004-monitoring-storage.md]] — ADR: Redis+PostgreSQL para monitoreo
- [[architecture/MONITORING-SYSTEM-DESIGN.md]] — Diseño de monitoreo: probes, matriz conectividad
- [[architecture/TYPIFICATIONS.md]] — Motor TP-Haki: API, reglas nombrado, secuencia
- [[architecture/dos-and-donts-playbook.md]] — Principios ingeniería, Do's/Don'ts, lecciones

## Base de Datos
- [[database/db-schema.md]] — Schema: tablas, columnas, índices, ERD
- [[database/ANALISIS_BD.md]] — Auditoría PostgreSQL: inventario, hallazgos, diagnóstico K8s

## Deploy y Operaciones
- [[deployment/DEPLOY.md]] — Guía deploy: dev/staging/prod, kubectl, kustomize
- [[deployment/verificar.md]] — Networking K8s: Contour, API Gateway, Coroot
- [[deployment/LOCAL-DEV.md]] — Desarrollo local con Docker Compose (solo dev)
- [[deployment/k8s-migration.md]] — Checklist migración 12-Factor (completada)

## Testing
- [[testing/tests-unitarios.md]] — Estrategia testing + tests unitarios por servicio
- [[testing/tests-e2e-seguridad.md]] — E2E, integración, performance, seguridad, accesibilidad

## UX
- [[ux/MODERN-UX-REDESIGN.md]] — Diseño UX/UI: paleta colores, componentes, breakpoints

## Proyecto
- [[project/business-discovery.md]] — Requisitos estratégicos: SLA, multi-tenancy
- [[project/pendientes-seguridad.md]] — Pendientes seguridad con referencias file:line
- [[project/pendientes-tecnicos.md]] — Pendientes técnicos: APIs, código, scripts
- [[project/CHANGELOG.md]] — Historial de versiones
- [[project/review-briefing.md]] — Estado histórico de implementación (ver ARCHITECTURE.md)
