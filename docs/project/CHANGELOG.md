---
description: "Historial de versiones y cambios del proyecto"
category: project
priority: low
agent_role: reference
---

# Changelog

All notable changes to vCenter Provisioner will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Security
- **Autenticación JWT con Bearer Tokens**: Implementado JWT con localStorage y Authorization headers en auth-service, api-gateway y provisioner-ui. Corregido bug de prioridad de cookie vs Bearer token en api-gateway.

### Fixed
- **Bucle infinito y congelamiento del navegador**: Agregado timeout (10s) y reintentos (3) en vcenter-operations `/resource-pools`. Frontend simplificado a solo estados (loading/error/retry). IIFE reemplazado por `useMemo`/`useCallback` en DashboardPage.
- **Build System**: Faltaba tag `:local` para shared-scripts (BUILD-001) — corregido en `build_shared_scripts`.

### Added
- **Build de servicio único**: `./pipeline.sh --service <name>` — construye solo el servicio especificado + shared-scripts.
- **Resource Pool opcional en creación de VMs**: Nuevo endpoint `GET /resource-pools?cluster=X`. Si no se especifica pool, se usa el raíz "Resources" del cluster.

---

## [0.3.0] - 2026-03-19

### Renombramiento de Servicios

| Servicio Anterior | Servicio Nuevo |
|------------------|---------------|
| `vcenter-config-service` | `credential-manager` |
| `vcenter-integration` | `vcenter-operations` |
| `provisioner-vcenter-config` | `provisioner-credential-manager` |
| `provisioner-vcenter-integration` | `provisioner-vcenter-operations` |
| `antigravity/vcenter-config` | `antigravity/credential-manager` |
| `antigravity/vcenter-integration` | `antigravity/vcenter-operations` |

### Cambio de Puertos
- credential-manager: 8082 → **8090**
- vcenter-operations: 8081 → **8091**

### Variables Deprecadas
- `VCENTER_CONFIG_URL` → `CREDENTIAL_MANAGER_URL`
- `VCENTER_INTEGRATION_URL` → `VCENTER_OPERATIONS_URL`

### Fixed
- Pruebas de conexión vCenter corregidas: flujo correcto con token de sesión vía `/api/session`.
- Modo "insecure" (`allowInsecure`) para omitir validación TLS en pruebas de conexión.
- Correcciones TypeScript en credential-manager (imports ESM, try/catch, softDelete).
- Lint: `tsc: not found` en auth-service por node_modules incompletos.

### Added
- **Sistema de migraciones** con node-pg-migrate: 6 migraciones idempotentes (users, vcenter_connections, typification, vm_classes, vm_provisions, audit_logs). Pipeline: `./pipeline.sh --migrate`.
- **API Gateway**: proxy público para `/monitoring`.
- **Frontend**: null/undefined guards en useServiceMonitor, useMonitoringHistory, ServiceDiagram, MonitorPage.

---

## [0.2.0] - 2026-02-06

### Documentación Consolidada
- `ARCHITECTURE.md` unifica 4 documentos de arquitectura. `CI-CD-LOCAL.md` unifica documentación CI/CD.
- Actualizados: `db-schema.md`, `ux-specification.md`, `review-briefing.md`, `dos-and-donts-playbook.md`.

### Added — Sistema de Monitoreo
- **Shared Scripts**: imagen `antigravity/shared-scripts` con `probe-scheduler.sh` (modo full/sample) y wrappers para Go/Python/Node/Nginx.
- **9 Dockerfiles** actualizados con multi-stage COPY desde shared-scripts.
- **Monitoring Service**: endpoint `POST /api/probe-result`, almacenamiento en Redis + PostgreSQL.
- **Provisioner UI**: nueva página `/monitor` con ServiceDiagram, ServiceCard, useServiceMonitor.
- **Variables PROBE_\*** en todos los servicios (intervalo, modo, sample count, targets).

### Fixed
- nginx-unprivileged: wrapper simple sin bash. Probe scheduler detecta HTTP 200 sin body JSON.
- Dockerfiles: corregidos COPY de archivos y creación de usuario clouduser.
- Variable `SCRIPTS_HASH` → `SHARED_SCRIPTS_HASH` en docker-compose.yml.

---

## Versiones Históricas (Pre-K8s)

| Versión | Fecha | Tipo | Cambios Clave |
|---------|-------|------|---------------|
| 0.1.4 | 2026-02-05 | PATCH | Typing Service acepta request body para `/generate-name`. UI healthcheck migrado a curl. CSS en rutas SPA anidadas. Credenciales admin actualizadas. |
| 0.1.3 | 2026-02-04 | PATCH | Nil pointer en VM Orchestrator. Schema BD corregido (`prefijo1`, `prefijo2`, `seq_digits`). Typing Service error 500. UI healthy. |
| 0.1.2 | 2026-02-01 | PATCH | API Gateway: rutas `/api/vm-classes`. Componentes UI reutilizables (Button, Card, Modal, FormGroup, Input). Role admin en Typing Service lock/unlock. |
| 0.1.1 | 2026-02-01 | PATCH | FAB + Speed Dial, Rating (corazones), Stepper vertical 3 pasos, Favorites, Slider, Chips, Glassmorphism, animaciones framer-motion. Fix foco TextField. |
| 0.1.0 | 2026-02-01 | MINOR | UI moderna (framer-motion, axios). Docker labels y versionado. Documentación DOCKER-VERSIONING-BEST-PRACTICES.md. |
| 0.0.0 | 2026-01-31 | INITIAL | MVP: 9 microservicios, autenticación básica, CRUD tipificaciones, provisionamiento VM, monitoreo y health checks. |

---

**Última actualización:** 2026-05-21
