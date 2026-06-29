# vCenter Provisioner - Pendientes y Backlog

> **Última actualización:** 2026-03-18
> **Estado del proyecto:** En desarrollo activo

---

## Resumen Ejecutivo

| Categoría | Total | Completado | Pendiente |
|-----------|-------|-----------|-----------|
| Tests | 10 servicios | 9 (90%) | 1 servicio |
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
| **provisioner-ui** | 4 | ~700 | ✅ Completo (37 tests) |

**Acciones:**
- [x] Crear tests para typing-service (441 líneas) ✅
- [x] Crear tests para stats-service (176 líneas) ✅
- [x] Crear tests para provisioner-ui (37 tests) ✅
- [ ] Crear tests para backup-service (mínimo 5 casos)

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
| vcenter-operations | ❌ | ✅ |
| credential-manager | ❌ | ✅ |
| stats-service | ❌ | ✅ |
| monitoring-service | ❌ | ✅ |
| backup-service | ❌ | ✅ |
| provisioner-ui | ✅ | ❌ |

**Acciones:**
- [ ] Crear .dockerignore para api-gateway
- [ ] Crear .dockerignore para auth-service
- [ ] Crear .dockerignore para typing-service
- [ ] Crear .dockerignore para vm-orchestrator
- [ ] Crear .dockerignore para vcenter-operations
- [ ] Crear .dockerignore para credential-manager
- [ ] Crear .dockerignore para stats-service
- [ ] Crear .dockerignore para monitoring-service
- [ ] Crear .dockerignore para backup-service
- [ ] Crear .env.example para provisioner-ui

---

### 7. Mejora de Tests existentes

| Servicio | Líneas Test | Cobertura Estimada |
|----------|-------------|-------------------|
| monitoring-service | 27 | Baja |
| credential-manager | 87 | Baja |

**Acciones:**
- [ ] Ampliar tests de monitoring-service (mínimo 20 casos adicionales)
- [ ] Ampliar tests de credential-manager (mínimo 20 casos adicionales)

---

## 🟢 PRIORIDAD BAJA

### 8. Documentación

| Servicio | README.md |
|----------|-----------|
| credential-manager | ❌ Falta |

**Acciones:**
- [ ] Crear README.md para credential-manager

---

### 9. Mejoras de API Gateway

- [ ] Agregar proxy a backup-service

---

### 10. vcenter-operations

- [ ] Implementar creación real de VMs (actualmente solo mock)

---

## Servicios con Tests Completos ✅

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

## APIs Implementadas por Servicio

### api-gateway (Puerto 3000)
- ✅ `/health`
- ✅ `/` (root)
- ✅ `/vm-classes` → typing-service
- ✅ `/api/vm-classes` → typing-service
- ✅ `/auth/*` → auth-service (proxy)
- ✅ `/typing/*` → typing-service (proxy, protected)
- ✅ `/provision/*` → orchestrator (proxy, protected)
- ✅ `/api/vcenters/*` → credential-manager (proxy, protected)
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

### vcenter-operations (Puerto 8081)
- ✅ `/health`
- ✅ `/`
- ✅ `/connection/test`
- ✅ `/vms`
- ✅ `/datacenters`
- ✅ `/clusters`
- ✅ `/datastores`
- ✅ `/create-vm` (MOCK)

### credential-manager (Puerto 8082)
- ✅ `/health`
- ✅ `/api/vcenters` (CRUD completo)
- ✅ `/api/vcenters/:id/test`
- ✅ `/api/vcenters/:id/audit`
- ✅ Basic Auth only (migrado desde token/basic configurable)
- ✅ Validación de formato: `username:password` requerido
- ✅ Tests Basic Auth ✅ (12 casos)

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
- ✅ Tests ✅ (37 casos)

---

## Checklist de Completado

- [x] Tests typing-service (441 líneas) ✅
- [x] Tests stats-service (176 líneas) ✅
- [x] Tests provisioner-ui (37 tests) ✅
- [x] vCenter Basic Auth only (validación username:password) ✅
- [ ] Tests backup-service (mínimo 5 casos)
- [ ] APIs backup-service completas
- [ ] scripts/deploy.sh
- [ ] scripts/deploy-ui.sh
- [ ] scripts/ci/test.sh
- [ ] .dockerignore para 9 servicios
- [ ] .env.example para provisioner-ui
- [ ] README.md credential-manager

---

## Notas

- El proyecto está en migración de Windows (PowerShell) a Linux (Bash)
- Ver LINUX-MIGRATION.md para estado de la migración
- La UI está 95% completa
- El sistema de monitoreo está operativo
- **2026-03-18:** vCenter connections migrado a Basic Auth only con validación de formato `username:password`

---

## Análisis de Mejoras - 2026-03-27

### 🔴 PRIORIDAD CRÍTICA - Seguridad

#### 1. Secrets hardcodeados

| Archivo | Línea | Problema |
|---------|-------|-----------|
| `apps/api-gateway/src/index.ts` | 13 | JWT_SECRET fallback: `'antigravity-tier0-secret'` |
| `apps/auth-service/src/index.ts` | 11 | JWT_SECRET fallback: `'antigravity-tier0-secret'` |
| `apps/auth-service/src/index.ts` | 21 | Default admin password: `'password123'` en seed |
| `apps/credential-manager/src/index.ts` | 11 | Master key fallback: `'default-master-key-change-in-production!'` |
| `apps/auth-service/knexfile.ts` | 6 | DB password hardcoded: `'password123'` |
| `apps/monitoring-service/main.go` | 23 | DB credentials: `'antigravity:password123'` |

**Solución:** Crear `.env.example` con todas las variables requeridas y validar al startup que existan.

#### 2. CORS permisivo

| Archivo | Línea | Problema |
|---------|-------|-----------|
| `apps/api-gateway/src/index.ts` | 12, 28-31 | `CORS_ORIGINS = '*'` o `origin: true` |
| `apps/auth-service/src/server.ts` | 100-103 | `origin: true` |
| `apps/typing-service/app/main.py` | 30, 33-39 | CORS defaults a `'*'` |
| `apps/stats-service/app/main.py` | 39-45 | CORS permite todos los orígenes |

**Solución:** Usar whitelist explícita de orígenes desde variable de entorno.

#### 3. Logging de credenciales

| Archivo | Línea | Problema |
|---------|-------|-----------|
| `apps/vm-orchestrator/main.go` | 420 | `log.Printf` con credentials |
| `apps/vcenter-operations/main.go` | 142, 174, 206, 344, 427 | Múltiples instancias de logging de credenciales |

**Solución:** Usar structured logging sin datos sensibles, nunca loguear passwords/users.

---

### 🟡 PRIORIDAD ALTA - Calidad de Código

#### 4. Error handling inconsistente

| Archivo | Problema |
|---------|----------|
| `apps/api-gateway/src/index.ts` | Empty catch blocks, console.log vs server.log |
| `apps/provisioner-ui/src/hooks/vcenter/*.ts` | Empty catch blocks |
| `apps/auth-service/src/server.ts` | Empty catch blocks |

**Solución Context7 (Fastify):**
```javascript
fastify.setErrorHandler((error, request, reply) => {
  request.log.error({ err: error }, 'Error occurred')
  
  if (error.validation) {
    return reply.code(400).send({
      error: 'Validation Error',
      message: error.message,
      details: error.validation
    })
  }
  
  reply.code(500).send({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  })
})
```

#### 5. Duplicación de código

| Archivo | Líneas | Problema |
|---------|--------|----------|
| `apps/vm-orchestrator/main.go` | 124-173 | Validación duplicada |
| `apps/vcenter-operations/main.go` | 126-144, 158-176, 189-208 | Credential parsing repetido 3 veces |
| `apps/api-gateway/src/index.ts` | 82-89, 91-98 | Endpoints `/vm-classes` duplicados |

**Solución:** Extraer a funciones reutilizables.

#### 6. Sin retry/circuit breaker

- `apps/vm-orchestrator/main.go`: Sin retry para llamadas a servicios externos
- `apps/monitoring-service/main.go`: Sin retry para Redis/PostgreSQL

**Solución:** Implementar retry con exponential backoff y circuit breaker.

#### 7. Estado en memoria (no production-ready)

| Archivo | Línea | Problema |
|---------|-------|----------|
| `apps/vm-orchestrator/main.go` | 92 | `var states = make(map[string]*ProvisionState)` - se pierde al reiniciar |
| `apps/stats-service/app/main.py` | 26-31 | `stats_data` in-memory |

**Solución:** Persistir a PostgreSQL, usar Redis para caché.

---

### 🟢 PRIORIDAD MEDIA - Mejoras

#### 8. Testing gaps

| Servicio | Estado |
|----------|--------|
| `monitoring-service` | Sin tests |
| `backup-service` | Sin tests |
| `stats-service` | Tests mínimos |

**Solución:** Agregar tests unitarios para coverage >70%.

#### 9. API Documentation

- Sin OpenAPI/Swagger en ningún servicio
- Sin contract testing

**Solución:** Agregar OpenAPI a servicios FastAPI (Python) y Fastify (Node).

#### 10. Tipo `any` excesivo

| Archivo | Línea | Problema |
|---------|-------|----------|
| `apps/api-gateway/src/index.ts` | 37, 53 | `error: any`, `request: any` |

**Solución:** Definir tipos específicos para todas las interfaces.

---

### Comparación con Mejores Prácticas (Context7)

| Área | Estado Actual | Context7 Recommenda |
|------|--------------|---------------------|
| **Logging Node.js** | `console.log/error` | `server.log.error()` (Fastify built-in) |
| **Error Handling** | Sin global handler | `fastify.setErrorHandler()` con logging estructurado |
| **Logging Go** | Mix `log` y `slog` | Usar solo `slog` (Go 1.21+) |
| **Configuración** | Fallback to defaults | Fail-fast si vars críticas no existen |
| **CORS** | `origin: true` | Whitelist explícita |

---

### Checklist de Nuevas Acciones

- [ ] Crear `.env.example` con todas las variables requeridas
- [ ] Agregar validación de entorno al startup (fail-fast)
- [ ] Restringir CORS a orígenes específicos (whitelist)
- [ ] Eliminar logging de credenciales
- [ ] Agregar global error handler en servicios Fastify
- [ ] Implementar retry logic con circuit breaker
- [ ] Extraer código duplicado
- [ ] Estandarizar logging (slog en Go, server.log en Node)
- [ ] Persistir estado en Redis/PostgreSQL
- [ ] Agregar tests para monitoring-service y backup-service
- [ ] Agregar OpenAPI/Swagger a servicios
- [ ] Eliminar uso de tipo `any`, usar tipos específicos
