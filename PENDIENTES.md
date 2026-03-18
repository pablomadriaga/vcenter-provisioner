# vCenter Provisioner - Pendientes y Backlog

> **Última actualización:** 2026-03-18
> **Estado del proyecto:** En desarrollo activo

---

## Resumen Ejecutivo

| Categoría | Total | Completado | Pendiente |
|-----------|-------|-----------|-----------|
| Tests | 10 servicios | 8 (80%) | 2 servicios |
| Docker configs | 10 servicios | 1 (10%) | 9 servicios |
| APIs | ~40 endpoints | ~37 (92%) | ~3 pendientes |
| Scripts Linux | 18 | 8 (44%) | 10 pendientes |
| Docs | 10 servicios | 9 (90%) | 1 pendiente |

---

## 🔴 PRIORIDAD CRÍTICA

### 1. Tests para servicios sin cobertura

| Servicio | Archivos Test | Líneas Test | Estado |
|----------|---------------|-------------|--------|
| **typing-service** | 1 | 441 | ✅ Completo |
| **stats-service** | 1 | 176 | ✅ Completo |
| **backup-service** | 0 | 0 | ❌ SIN TESTS |
| **provisioner-ui** | 0 | 0 | ❌ SIN TESTS |

**Acciones:**
- [x] Crear tests para typing-service (441 líneas) ✅
- [x] Crear tests para stats-service (176 líneas) ✅
- [ ] Crear tests para backup-service (mínimo 5 casos)
- [ ] Crear tests para provisioner-ui (mínimo 10 casos)

---

### 2. Backup Service - Solo esbozo

El servicio solo tiene:
- `/health` ✅
- `/echo` ✅
- `/` ✅

**Falta implementar:**
- [ ] API de políticas de backup (CRUD)
- [ ] Endpoint de programación de backups
- [ ] Integración con vm-orchestrator para crear backups post-provisión
- [ ] API de restauración
- [ ] API de listado de backups
- [ ] API de eliminación de backups

---

## 🟠 PRIORIDAD ALTA

### 3. Scripts de Deployment Linux

| Script | Estado |
|--------|--------|
| `scripts/deploy.sh` | ❌ Falta |
| `scripts/deploy-ui.sh` | ❌ Falta |

**Acciones:**
- [ ] Crear `scripts/deploy.sh` para deployment de servicios
- [ ] Crear `scripts/deploy-ui.sh` para deployment de UI

---

### 4. Pipeline Scripts Linux

| Script | Estado |
|--------|--------|
| `scripts/ci/test.sh` | ❌ Falta |
| `scripts/testing/run-integration.sh` | ❌ Falta |
| `scripts/testing/run-e2e.sh` | ❌ Falta |
| `scripts/testing/run-perf.sh` | ❌ Falta |
| `scripts/testing/run-security.sh` | ❌ Falta |
| `scripts/testing/run-accessibility.sh` | ❌ Falta |

**Acciones:**
- [ ] Completar `scripts/ci/test.sh`
- [ ] Crear `scripts/testing/run-integration.sh`
- [ ] Crear `scripts/testing/run-e2e.sh`
- [ ] Crear `scripts/testing/run-perf.sh`
- [ ] Crear `scripts/testing/run-security.sh`
- [ ] Crear `scripts/testing/run-accessibility.sh`

---

### 5. Scripts de Seguridad

| Script | Estado |
|--------|--------|
| `scripts/security/zap-scan.sh` | ❌ Falta |
| `scripts/security/dependency-audit.sh` | ❌ Falta |

**Acciones:**
- [ ] Crear `scripts/security/zap-scan.sh` (OWASP ZAP)
- [ ] Crear `scripts/security/dependency-audit.sh`

---

## 🟡 PRIORIDAD MEDIA

### 6. Configuraciones Docker

| Servicio | .dockerignore | .env.example |
|----------|--------------|-------------|
| api-gateway | ❌ | ✅ |
| auth-service | ❌ | ✅ |
| typing-service | ❌ | ✅ |
| vm-orchestrator | ❌ | ✅ |
| vcenter-integration | ❌ | ✅ |
| vcenter-config-service | ❌ | ✅ |
| stats-service | ❌ | ✅ |
| monitoring-service | ❌ | ✅ |
| backup-service | ❌ | ✅ |
| provisioner-ui | ✅ | ❌ |

**Acciones:**
- [ ] Crear .dockerignore para api-gateway
- [ ] Crear .dockerignore para auth-service
- [ ] Crear .dockerignore para typing-service
- [ ] Crear .dockerignore para vm-orchestrator
- [ ] Crear .dockerignore para vcenter-integration
- [ ] Crear .dockerignore para vcenter-config-service
- [ ] Crear .dockerignore para stats-service
- [ ] Crear .dockerignore para monitoring-service
- [ ] Crear .dockerignore para backup-service
- [ ] Crear .env.example para provisioner-ui

---

### 7. Mejora de Tests existentes

| Servicio | Líneas Test | Cobertura Estimada |
|----------|-------------|-------------------|
| monitoring-service | 27 | Baja |
| vcenter-config-service | 87 | Baja |

**Acciones:**
- [ ] Ampliar tests de monitoring-service (mínimo 20 casos adicionales)
- [ ] Ampliar tests de vcenter-config-service (mínimo 20 casos adicionales)

---

## 🟢 PRIORIDAD BAJA

### 8. Documentación

| Servicio | README.md |
|----------|-----------|
| vcenter-config-service | ❌ Falta |

**Acciones:**
- [ ] Crear README.md para vcenter-config-service

---

### 9. Mejoras de API Gateway

- [ ] Agregar proxy a backup-service

---

### 10. vcenter-integration

- [ ] Implementar creación real de VMs (actualmente solo mock)

---

## Servicios con Tests Completos ✅

| Servicio | Archivos Test | Líneas Test |
|----------|---------------|-------------|
| api-gateway | 3 | 1210 |
| auth-service | 2 | 575 |
| vm-orchestrator | 1 | 341 |
| vcenter-integration | 1 | 272 |
| typing-service | 1 | 441 |
| stats-service | 1 | 176 |

---

## APIs Implementadas por Servicio

### api-gateway (Puerto 3000)
- ✅ `/health`
- ✅ `/` (root)
- ✅ `/vm-classes` → typing-service
- ✅ `/api/vm-classes` → typing-service
- ✅ `/auth/*` → auth-service (proxy)
- ✅ `/typing/*` → typing-service (proxy, protected)
- ✅ `/provision/*` → orchestrator (proxy, protected)
- ✅ `/api/vcenters/*` → vcenter-config (proxy, protected)
- ✅ `/api/stats/*` → stats-service (proxy, protected)
- ✅ `/monitoring/*` → monitoring-service (proxy, público)
- ❌ `/api/backup/*` → backup-service (NO IMPLEMENTADO)

### auth-service (Puerto 3001)
- ✅ `/health`
- ✅ `/`
- ✅ `/register`
- ✅ `/login`

### typing-service (Puerto 8000)
- ✅ `/health`
- ✅ `/`
- ✅ `/templates` (GET, POST)
- ✅ `/templates/{id}` (PUT)
- ✅ `/generate-name/{id}`
- ✅ `/vm-classes` (CRUD completo)
- ✅ Tests ✅ (441 líneas)

### vm-orchestrator (Puerto 8080)
- ✅ `/health`
- ✅ `/`
- ✅ `/provision`
- ✅ `/status/:id`

### vcenter-integration (Puerto 8081)
- ✅ `/health`
- ✅ `/`
- ✅ `/connection/test`
- ✅ `/vms`
- ✅ `/datacenters`
- ✅ `/clusters`
- ✅ `/datastores`
- ✅ `/create-vm` (MOCK)

### vcenter-config-service (Puerto 8082)
- ✅ `/health`
- ✅ `/api/vcenters` (CRUD completo)
- ✅ `/api/vcenters/:id/test`
- ✅ `/api/vcenters/:id/audit`

### stats-service (Puerto 8001)
- ✅ `/health`
- ✅ `/`
- ✅ `/api/provision-logs`
- ✅ `/stats/summary`
- ✅ `/stats/timeline`
- ✅ `/stats/by-vmclass`
- ✅ `/stats/by-vcenter`
- ✅ `/stats/hourly`
- ✅ `/stats/failures`
- ✅ `/stats/recent`
- ✅ `/api/custom-charts` (CRUD)
- ✅ Tests ✅ (176 líneas)

### monitoring-service (Puerto 8082)
- ✅ `/health`
- ✅ `/api/probe-result`
- ✅ `/api/services-status`
- ✅ `/api/services-history`
- ✅ `/api/connectivity-matrix`
- ✅ `/metrics`

### backup-service (Puerto 8002)
- ✅ `/health`
- ✅ `/echo`
- ✅ `/`
- ❌ APIs de backup (NO IMPLEMENTADAS)
- ❌ Tests

### provisioner-ui (Puerto 5173)
- ✅ Login
- ✅ Dashboard
- ✅ Typifications
- ✅ VM Classes
- ✅ vCenters
- ✅ Stats
- ✅ Monitor
- ❌ Tests

---

## Checklist de Completado

- [x] Tests typing-service (441 líneas) ✅
- [x] Tests stats-service (176 líneas) ✅
- [ ] Tests backup-service (mínimo 5 casos)
- [ ] Tests provisioner-ui (mínimo 10 casos)
- [ ] APIs backup-service completas
- [ ] scripts/deploy.sh
- [ ] scripts/deploy-ui.sh
- [ ] scripts/ci/test.sh
- [ ] .dockerignore para 9 servicios
- [ ] .env.example para provisioner-ui
- [ ] README.md vcenter-config-service

---

## Notas

- El proyecto está en migración de Windows (PowerShell) a Linux (Bash)
- Ver LINUX-MIGRATION.md para estado de la migración
- La UI está 95% completa
- El sistema de monitoreo está operativo
