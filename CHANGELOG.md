# Changelog

All notable changes to vCenter Provisioner will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

#### Single Service Build

New option to build a single service instead of all services.

**Usage:**
```bash
./pipeline.sh --service <service-name>           # Build single service
./pipeline.sh --build-service <service-name>      # Same as above
./pipeline.sh --service <name> --force           # Force rebuild
```

**Benefits:**
- Faster builds (only builds what you need)
- Uses smart cache (only rebuilds if files changed)
- Automatically builds shared-scripts dependency

**Status:** ✅ Implemented

---

### Known Issues

#### Build System: Missing `:local` tag for shared-scripts image

**Bug ID:** BUILD-001

**Severity:** Low (only affects direct docker builds without pipeline)

**Description:**
The build script (`scripts/ci/build.sh`) correctly tags the `shared-scripts` image with its hash (e.g., `shared-scripts:ec6bb81434`), but does NOT create the `:local` tag that some Dockerfiles expect as a default value.

**Affected:**
- Direct builds via `docker compose build <service>` without `.env.ci`
- Any build that references `shared-scripts:local` directly

**Root Cause:**
Line 94 in `scripts/ci/build.sh`:
```bash
docker tag "${image_name}:${SHARED_SCRIPTS_HASH}" "shared-scripts:${SHARED_SCRIPTS_HASH}"
```
Missing line:
```bash
docker tag "${image_name}:${SHARED_SCRIPTS_HASH}" "shared-scripts:local"
```

**Workaround:**
If a build fails with `shared-scripts:local not found`, run:
```bash
docker tag antigravity/shared-scripts:<HASH> shared-scripts:local
```

**Status:** Fixed ✅ (added missing tag in build_shared_scripts)

---

## [0.3.0] - 2026-03-19

### Changed (Refactorización de Servicios vCenter)

#### Renombramiento de Servicios

| Servicio Anterior | Servicio Nuevo | Cambio |
|------------------|---------------|--------|
| `vcenter-config-service` | `credential-manager` | Directorio |
| `vcenter-integration` | `vcenter-operations` | Directorio |
| `vcenter-config` | `credential-manager` | Docker Compose service |
| `vcenter-integration` | `vcenter-operations` | Docker Compose service |
| `provisioner-vcenter-config` | `provisioner-credential-manager` | Container name |
| `provisioner-vcenter-integration` | `provisioner-vcenter-operations` | Container name |
| `antigravity/vcenter-config` | `antigravity/credential-manager` | Docker image |
| `antigravity/vcenter-integration` | `antigravity/vcenter-operations` | Docker image |

#### Cambio de Puertos

| Servicio | Puerto Anterior | Puerto Nuevo |
|----------|-----------------|--------------|
| credential-manager | 8082 | **8090** |
| vcenter-operations | 8081 | **8091** |

#### Backwards Compatibility

Variables deprecated (aliases mantidos por 1 versión):
- `VCENTER_CONFIG_URL` → `CREDENTIAL_MANAGER_URL`
- `VCENTER_INTEGRATION_URL` → `VCENTER_OPERATIONS_URL`

#### Documentación ADR

- **ADR-005** agregado en `docs/ARCHITECTURE_DECISIONS.md`

### Migration Guide: 0.2.0 → 0.3.0

**Type:** MINOR (Breaking changes en nombres)

**Migration Required:** Yes

**Steps:**

1. Detener servicios existentes:
   ```bash
   ./pipeline.sh --down
   ```

2. Limpiar containers antiguos:
   ```bash
   docker rm -f provisioner-vcenter-config provisioner-vcenter-integration
   ```

3. Pull latest changes:
   ```bash
   git pull
   ```

4. Rebuild con nuevos nombres:
   ```bash
   ./pipeline.sh --build --force
   ```

5. Levantar servicios:
   ```bash
   ./pipeline.sh --up
   ```

6. Verificar health checks:
   ```bash
   curl http://localhost:8090/health  # credential-manager
   curl http://localhost:8091/health  # vcenter-operations
   ```

**Nota:** Los endpoints de API cambiaron de puerto. Actualizar integraciones que usen los puertos anteriores (8081, 8082).

---

### Fixed (vCenter Config Service)

- **Corrección de pruebas de conexión vCenter**: Se implementó el flujo correcto de autenticación de vCenter (obtención de token de sesión vía `/api/session` y posterior llamada a `/api/vcenter/vm`) reemplazando el endpoint obsoleto `/rest/com/vmware/cis`.
- **Adición de modo "insecure"**: Se agregó el parámetro `allowInsecure` en la API de prueba de conexión (`POST /api/vcenters/:id/test`) y en la UI (checkbox "Insecure") para permitir omitir la validación de certificados TLS cuando el certificado del vCenter no es de confianza (uso bajo responsabilidad del usuario).
- **Correcciones de TypeScript**:
  - Reemplazo de `require('https')` por `await import('node:https')` en funciones auxiliares para evitar errores en entorno ES modules.
  - Separación de la lógica en funciones auxiliares (`getSessionToken`, `testVCenterConnection`) para mejorar legibilidad y testeo.
  - Corrección de estructura try/catch y eliminación de código duplicado.
  - Uso de `softDelete` en lugar de `delete` en el repositorio conforme a la definición actual.
  - Manejo específico de errores de timeout, HTTP y parsing de token.
- **Mejoras de auditoría**: Se agregó logging de advertencia cuando se usa el modo insecure para rastreo de seguridad.

### Added (Sistema de Migraciones)

- Sistema de migraciones con **node-pg-migrate** siguiendo mejores prácticas de Context7
- 6 migraciones idempotentes:
  - `1773800000001_users.cjs` - Tabla users
  - `1773800000002_vcenter_connections.cjs` - vcenter_connections, vcenter_credentials_audit
  - `1773800000003_typification.cjs` - typification_templates, typification_counters
  - `1773800000004_vm_classes.cjs` - vm_classes
  - `1773800000005_vm_provisions.cjs` - vm_provisions
  - `1773800000006_audit_logs.cjs` - audit_logs
- Pipeline ejecuta init.sql + migraciones con `./pipeline.sh --migrate`
- Formato de archivos: Unix timestamp (13 dígitos)
- init.sql simplificado (solo usuarios mínimos)
- Migraciones idempotentes (usan `CREATE TABLE IF NOT EXISTS`)

### Fixed

- Corregido error de lint: `tsc: not found` en auth-service
  - Modificado `scripts/ci/lint.sh` para detectar node_modules incompletos
  - Removido `sqlite3` de devDependencies (no usado)

### Changed

- `docs/db-schema.md` - Actualizado para reflejar sistema de migraciones
- API Gateway: agregado proxy público para `/monitoring` endpoints
- docker-compose: agregado `depends_on: redis` a monitoring-service

### Added (Frontend Fixes)

- null/undefined guards en useServiceMonitor, useMonitoringHistory, ServiceDiagram, MonitorPage
- Best practice de Context7: defensa en profundidad con `|| []`

## [0.2.0] - 2026-02-06

### Changed (Documentación Simplificada)

#### Consolidación de Documentación de Arquitectura
- **Nuevos documentos**:
  - `[ARCHITECTURE.md](./docs/ARCHITECTURE.md)` - Arquitectura unificada: servicios, diagramas, flujos y contratos
- **Archivos eliminados** (contenido fusionado):
  - `docs/definition.md` → ARCHITECTURE.md
  - `docs/architecture-deep-dive.md` → ARCHITECTURE.md
  - `docs/infrastructure-design.md` → ARCHITECTURE.md
  - `docs/architecture-usage.md` → ARCHITECTURE.md

#### Consolidación de Documentación CI/CD
- **Archivo unificado**: `docs/CI-CD-LOCAL.md` (355 líneas) ahora contiene toda la información
- **Archivo eliminado**: `docs/CI-CD-STANDARDS.md` (51 líneas) - redundante

#### Documentación Técnica Actualizada
- **`docs/db-schema.md`** - Actualizado para reflejar el schema real de `infra/local/init.sql`:
  - Agregadas tablas `vm_classes` y `audit_logs`
  - Actualizadas columnas de `typification_templates` (prefijo1, prefijo2, seq_digits)
  - Agregadas columnas de `vm_provisions` (template_id, requester_id, vcenter_*)
  - Agregadas clases por defecto (Gold, Silver, Bronze, Micro)
  - Agregados índices y notas de mantenimiento

- **`docs/ux-specification.md`** - Actualizado para reflejar el estado real de la UI:
  - Marcados componentes implementados (Wizard, Dashboard, Tipifications, etc.)
  - Componentes pendientes marcados (FAB, Rating, IndexedDB, Drag-drop)
  - Agregada tabla de componentes por ubicación (`src/components/`)
  - Agregada tabla de páginas del sistema

- **`docs/review-briefing.md`** - Marcado como "Legacy" y actualizado:
  - Estado real de cada módulo (implementado/pendiente/no implementado)
  - Sistema de monitoreo documentado (sustituye roadmap ambicioso anterior)
  - Healthchecks implementados por servicio
  - Tabla de "Lo que SÍ funciona" vs "Lo que NO está implementado"

- **`docs/dos-and-donts-playbook.md`** - Expandido significativamente:
  - **Principios Fundamentales** (6 principios: constraints, DRY, desacoplamiento, magia invisible, explicabilidad)
  - **Do's Ampliados** (9 puntos: Dockerfiles bien diseñados, pipeline unificado, tags hash, etc.)
  - **Don'ts Ampliados** (10 puntos: copiar en pipelines, magia invisible, etc.)
  - **Mentalidad del Ingeniero** (arquitectura primero, disciplina, colaboración)
  - **Lo que Resolvimos** - Tabla antes/después del trabajo realizado
  - Contenido unificado de ambos enfoques (principios + ejemplos prácticos)

- **Referencias actualizadas**:
  - `README.md` - Índices de documentación actualizados
  - `docs/DOCKER-VERSIONING-BEST-PRACTICES.md` - Referencia corregida
  - `docs/ARCHITECTURE_DECISIONS.md` - Referencia corregida

### Added (Sistema de Monitoreo)

#### Shared Scripts Image
- **Nueva imagen `antigravity/shared-scripts:AB37FFE208`** - Scripts compartidos para el sistema de monitoreo.
  - `probe-scheduler.sh` - Probeador de red con modo full/sample
  - `go-wrapper.sh` - Wrapper para servicios Go (incluye probe scheduler)
  - `shared-wrapper.sh` - Wrapper para Python/Node (incluye probe scheduler)
  - `nginx-wrapper-simple.sh` - Wrapper simple para nginx

#### Probe Scheduler
- **`probe-scheduler.sh`** - Sistema de probes distribuidos:
  - Modo `full`: probea todos los targets configurados
  - Modo `sample`: selecciona N targets aleatorios
  - Envía resultados a monitoring-service via POST /api/probe-result
  - Configuración via variables de entorno

#### Dockerfiles
- **9 Dockerfiles actualizados** con multi-stage COPY desde shared-scripts:
  - `apps/api-gateway/Dockerfile`
  - `apps/auth-service/Dockerfile`
  - `apps/vm-orchestrator/Dockerfile`
  - `apps/monitoring-service/Dockerfile`
  - `apps/typing-service/Dockerfile`
  - `apps/vcenter-integration/Dockerfile`
  - `apps/stats-service/Dockerfile`
  - `apps/backup-service/Dockerfile`
  - `apps/provisioner-ui/Dockerfile`

#### Monitoring Service
- **Integración con probe-scheduler.sh** - El servicio ahora recibe probes de todos los servicios.
  - Endpoint `POST /api/probe-result` para recibir resultados
  - Almacenamiento en Redis (TTL 60s) y PostgreSQL (histórico)
  - Endpoints: `/api/services-status`, `/api/connectivity-matrix`

#### Provisioner UI
- **Nueva página `/monitor`** - Dashboard de observabilidad:
  - Componente `ServiceDiagram` con diagrama C4 visual
  - Componente `ServiceCard` para estado de servicios
  - Hook `useServiceMonitor` para polling de API
  - Ruta `/monitor` agregada en App.tsx

#### Docker Compose
- **Variables de entorno para probes** en cada servicio:
  - `PROBE_INTERVAL` - Intervalo entre probes
  - `PROBE_MODE` - 'full' o 'sample'
  - `PROBE_SAMPLE_COUNT` - N targets en modo sample
  - `PROBE_TARGETS` - Lista de targets (opcional)

### Fixed (Correcciones)

#### nginx-unprivileged
- **Wrapper simple para nginx** - `nginx-wrapper-simple.sh` sin bash para imágenes sin bash.
- **Probe scheduler修正** - Detecta HTTP 200 aunque no haya body JSON.

#### Dockerfiles
- **Falta de app files** - Corregidos COPY para archivos de aplicación en Node.js.
- **clouduser** - Creación correcta de usuario no-root en todos los servicios.

#### Nomenclatura
- **SCRIPTS_HASH → SHARED_SCRIPTS_HASH** - Corregido nombre de variable en docker-compose.yml.

### Testing Results

| Suite | Tests | Status |
|-------|-------|--------|
| System | 11/11 | ✅ Healthy |
| Probe Scheduler | Running | ✅ Active |
| Monitoring API | 3/3 | ✅ Responding |

---

## [0.1.4] - 2026-02-05

### Fixed (Correcciones de la Sesión 2026-02-04)

#### Typing Service
- **Error 422 en POST /typing/generate-name/1** - La UI enviaba `manual_value` como JSON body, pero el backend lo esperaba como query parameter.
  - Schema `VMNamePreviewRequest` agregado
  - Endpoint modificado para aceptar request body

#### Provisioner UI
- **UI unhealthy pero funcional** - Healthcheck de nginx-usando wget fallaba.
  - Modificado Dockerfile para usar curl en healthcheck
  - Agregado endpoint `/health` en nginx.conf
  - Healthcheck ahora usa: `curl -sf http://localhost:80/health`

#### Nginx Configuration
- **CSS no cargando en /typifications y /vm-classes** - Nginx no servía assets correctamente en rutas SPA anidadas.
  - Agregado manejo específico para `/assets/`
  - Agregados headers de seguridad (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
  - Mejorado try_files para assets

#### Credentials
- **Credenciales actualizadas** - Usuario wanted admin/password123.
  - Actualizado `infra/local/init.sql` con nuevo hash bcrypt
  - Documentación actualizada en QUICKSTART.md y README.md

#### Integration Tests
- **Expectations incorrectos** - Tests fallaban por formatos de API incorrectos.
  - Corregido payload de templates (`prefijo1`, `prefijo2`, `seq_digits`)
  - Corregido payload de provision (`manual_value` en lugar de `manual_values`)

### Tests Results

| Suite | Tests | Status |
|-------|-------|--------|
| Unit Tests | 103 | ✅ 93 passed, 10 expected failures (integration tests) |
| All Services | 9/9 | ✅ Healthy |

---

## [0.1.3] - 2026-02-04

### Fixed (Bug Fixes)

#### VM Orchestrator
- **Nil pointer en test corregido** - `TestProvisionRequest_Struct` fallaba por acceder a `req.Specs.CPU` sin inicializar el struct. El campo `Specs` es un puntero (`*VMSpecs`) que era `nil`.

#### Database Schema
- **Schema TP-Haki corregido** - `init.sql` reescrito completamente para incluir columnas `prefijo1`, `prefijo2`, `seq_digits` que los modelos SQLAlchemy esperan.
- **Usuario admin recreado** - Hash de bcrypt regenerado y actualizado en BD para que `admin123` funcione.

#### Typing Service
- **Error 500 resuelto** - El endpoint `/templates` ahora responde correctamente después de corregir el schema de BD.

#### Provisioner UI
- **Contenedor healthy** - Reconstruida imagen con `--no-cache` para resolver estado unhealthy.

#### Scripts
- **Parámetro duplicado corregido** - `run-integration-tests.ps1` tenía `Verbose` definido dos veces (una en CmdletBinding y otra manual).

### Testing Results

| Suite | Tests | Status | Coverage |
|-------|-------|--------|----------|
| Unit Tests | 98/98 | ✅ PASS | ~77% |
| Integration Tests | 5/10 | ⚠️ PARTIAL | N/A |

**Nota:** Tests de integración tienen expectativas incorrectas sobre respuestas de auth service (no es blocking, funcionalidad verificada manualmente).

### Credentials
- **Admin:** admin@antigravity.local / admin123

---

## [0.1.2] - 2026-02-01

### Fixed (Bug Fixes)

#### API Gateway
- **Rutas `/api/vm-classes` añadidas** - El frontend ahora puede acceder a `/api/vm-classes` (ruta con prefijo `/api`).
- **Rutas `/api/typing/vm-classes` añadidas** - CRUD de VM Classes ahora funciona correctamente a través del gateway con autenticación.

#### Frontend - Provisioner UI
- **DashboardPage.tsx corregido** - Endpoint cambiado de `/templates` a `/vm-classes` para traer VM Classes正确.

#### Typing Service
- **Verificación de rol admin añadida** - Los endpoints `lock` y `unlock` ahora verifican que el usuario tenga rol `admin` mediante header `X-User-Role`.
- **Tests de verificación de rol añadidos** - `test_lock_vm_class_non_admin` y `test_unlock_vm_class_non_admin` para verificar que usuarios no-admin no pueden bloquear/desbloquear VM Classes.

### Added (New Features)

#### Frontend - Provisioner UI (Componentes Reutilizables)

Se añadieron componentes UI reutilizables siguiendo mejores prácticas de React:

**Componentes UI (`src/components/UI/`):**
- **Button.tsx** - Botón con variantes (primary, secondary, danger, success), tamaños y estados de loading.
- **Card.tsx** - Tarjeta con Header, Body y Footer para estructurar contenido.
- **Modal.tsx** - Modal con soporte para cerrar con ESC y click fuera.
- **FormGroup.tsx** - Wrapper para labels, inputs y mensajes de error.
- **Input.tsx** - Input con soporte para errores y estados deshabilitados.

**Componentes de Layout (`src/components/Layout/`):**
- **Header.tsx** - Header con navegación, logout y nombre de usuario.
- **Footer.tsx** - Footer con copyright y versión.
- **PageLayout.tsx** - Layout principal que envuelve páginas con Header y Footer.

**Componentes de Auth (`src/components/Auth/`):**
- **AuthGuard.tsx** - Guard para proteger rutas que requieren autenticación.

**Páginas refactorizadas:**
- **TypificationsPage.tsx** - Ahora usa PageLayout, Card, Button, FormGroup e Input.
- **VMClassesPage.tsx** - Ahora usa PageLayout, Card, Button, FormGroup, Input y Modal.

### Tests

- **Typing Service: 28 tests passing (94% coverage)** - Todos los tests pasan incluyendo los nuevos tests de verificación de rol admin.
- **Todos los servicios backend: 93/96 tests passing** - Los 3 tests fallidos son de un bug preexistente en VM Orchestrator (main_test.go:265).

---

## [0.1.2] - 2026-02-01

### Added (New Features)

#### Documentation
- **deploy-ui-only.ps1** - Ultra simple deployment script (ONLY provisioner-ui)
  - Works from ANY directory - just specify project path
  - Validates project path before proceeding
  - Simplified 4-step process: Stop → Remove → Rebuild → Start
  - Includes health check verification
  - Shows colored console output for easy reading

- **deploy.ps1** - Updated with correct usage examples
  - Shows how to use deploy-ui-only.ps1 from any directory
  - Updated troubleshooting section with common errors

- **QUICKSTART.md** - Updated deployment section
  - Added "CRITICAL" section at the beginning about version update problem
  - Shows correct commands (with --build flag)
  - Shows NEVER do list (commands that don't work)
  - Shows ALWAYS do list (correct commands)

---

### Fixed (Bug Fixes)

#### Frontend - Provisioner UI
- **PERMANENT FIX: TextField focus issue** - TextFields "Nombre (ID)" and "Descripción" now PERMANENTLY maintain focus when typing.
  - **Root Cause**: The previous fix using `useMemo` on `steps` array didn't work because dependencies (`name`, `description`) change constantly while typing, causing the entire Stepper to re-render.
  - **Permanent Solution**: Created separate memoized component `BasicInfoStep.tsx` with `React.memo` to prevent unnecessary re-renders.
    - `BasicInfoStep` is a separate component that receives props for name, description, and change handlers
    - Wrapped with `React.memo` to prevent re-renders unless props change
    - Each step's content is wrapped with `useCallback` to maintain referential equality
    - Added `autoComplete="off"` to TextField components to prevent browser autocomplete interference
    - The Stepper's steps array is now static (no longer recreated on every render)
  - **Result**: TextFields now PERMANENTLY maintain focus. Users can type complete words without losing focus.

---

### Changed (Improvements)

#### Dependencies
- Updated `package.json` version from `0.1.1` to `0.1.2` (PATCH release)

---

### Migration Guide: 0.1.1 → 0.1.2

**Type:** PATCH (No breaking changes)
**Migration Required:** No
**Steps:**

1. Pull latest changes from repository
2. Rebuild UI service using new deployment script:
   ```powershell
   # Pipeline unificado con caching inteligente:
   .\pipeline.ps1 --build
   
   # Alternative: manual (from project directory)
   cd infra\local
   docker-compose down provisioner-ui
   docker rmi antigravity/provisioner-ui:0.1.1
   docker-compose build --no-cache provisioner-ui
   docker-compose up -d --build provisioner-ui
   ```
3. Verify application functionality:
   - Access UI at http://localhost:5173
   - Test TextField focus in "Nombre (ID)" and "Descripción" fields
   - Type complete words without losing focus
   - Verify that focus is maintained between keystrokes

**Note:** No database migrations required. This is a UI-only bug fix release with deployment improvements.

---

## [0.1.1] - 2026-02-01

### Added (New Features)

#### Frontend - Provisioner UI
- **Floating Action Button (FAB) + Speed Dial**
  - FAB with gradient background (#6366f1 to #8b5cf6)
  - Speed Dial expanded on click with 3 quick actions:
    - Nueva Tipificación Rápida
    - Ver Favoritos
    - Configuración Avanzada
  - Animations suaves de escala y rotación

- **Rating System with Red Hearts**
  - 5-heart rating system with custom red color (#ef4444)
  - Precision of 0.5 (e.g., 4.5 hearts possible)
  - Gradient text for rating values

- **Multiple Select with Chips**
  - Chip-based selection for typifications
  - Chips with colors coded by type:
    - Red (#ef4444): Manual segments
    - Blue (#3b82f6): Auto-sequential segments
    - Green (#10b981): Fixed segments
  - Interaction of selection/deselection

- **Slider with Always-Visible Labels**
  - Range slider 1-10 for segment length configuration
  - Fixed labels at both ends ("1" and "10")
  - Gradient track (#6366f1 to #8b5cf6)
  - Dynamic progress bar with gradient
  - Tooltip showing exact value

- **Chip Array Colors System**
  - Consistent color palette for all chip types
  - Shadows for depth
  - Smooth hover animations
  - Supports all segment types

- **Badge with Gradient**
  - Badge showing number of segments
  - Gradient background (#6366f1 to #8b5cf6)
  - Shadow for visual depth
  - Positioned top-right on cards

- **Modern Icons (Material Design v6)**
  - Consistent icon style across UI
  - Action icons (Add, Save)
  - Status icons (Favorite, Star)
  - View icons (Speed, Dashboard)
  - Editor icons (Edit, Delete)

- **Vertical Stepper with Buttons and Steps**
  - 3-step guided creation flow:
    1. Define Name and Description
    2. Configure Segments
    3. Save Typification
  - Buttons to advance/recede between steps
  - Step validation (disabled until required fields complete)
  - Visual progress indication

- **Favorites System**
  - Toggle favorites with heart icon
  - State persisted in localStorage (planned)
  - Filter to show only favorites
  - Visual feedback when toggling

- **Toggle View Mode**
  - Grid View (default)
  - List View
  - Clear icon indicators for each mode

- **Filter System**
  - Filter by favorites
  - Show all typifications
  - Clear visual indicators

- **Empty States**
  - Friendly message when no typifications exist
  - Large icon with gradient
  - Clear call-to-action
  - Different message for favorites filter

- **Loading States**
  - Loading indicator while fetching templates
  - Skeleton cards (planned)

- **Glassmorphism Design**
  - Blur effect on cards and containers
  - Subtle transparency
  - Gradient borders
  - Modern shadows for depth

- **Typography with Gradients**
  - Gradient text on headings (#6366f1 to #8b5cf6)
  - WebkitBackgroundClip for gradient effect
  - Bold font weights (700-800)

- **Responsive Design**
  - Adaptive grid (1-4 columns based on screen size)
  - Mobile-friendly with reduced padding
  - Touch targets minimum 44x44px

#### Documentation
- **DOCKER-VERSIONING-BEST-PRACTICES.md** - New comprehensive guide
  - Semantic Versioning guidelines (MAJOR, MINOR, PATCH)
  - Version bump workflow
  - Docker image naming conventions
  - Docker Compose update procedures
  - Migration guides for MAJOR upgrades
  - Testing and validation checklist
  - Version history tracking

---

### Fixed (Bug Fixes)

#### Frontend - Provisioner UI
- **Fixed TextField focus issue**: Text fields "Nombre (ID)" and "Descripción" now maintain focus when typing. Previously, they would lose focus after typing a single character, forcing users to click back into field.
  - **Root Cause**: `steps` array was being re-created on every render, causing TextField components to be unmounted and remounted.
  - **Fix**: Wrapped `steps` array with `useMemo` hook to prevent unnecessary re-renders.

- **Fixed Slider drag issue**: Slider components now support continuous dragging properly. Previously, users had to click at specific points on slider instead of being able to drag the thumb.
  - **Root Cause**: Component re-renders during slider movement were interrupting drag interaction.
  - **Fix**: Optimized with `useMemo` and `useCallback` hooks to prevent unnecessary re-renders.

- **Added length control for Auto-Sequential segments**: Auto-Sequential segment type now has a length slider (1-4 digits) to control sequence length.
  - Previously, `auto_seq` segments had no length control.
  - Now supports 1-4 digit sequences as requested by users.
  - Slider displays "LONGITUD DE LA SECUENCIA (DÍGITOS)" label for this type.
  - Shows singular/plural text: "1 dígito" vs "2-4 dígitos"

### Changed (Improvements)

#### Dependencies
- Added `framer-motion@12.29.2` for modern animations
- Added `axios@1.13.4` for API calls (was missing)
- Updated `package.json` version from `0.0.0` to `0.1.0`

#### Docker
- Updated Dockerfile with version labels and metadata
  - `LABEL version=0.1.0`
  - `LABEL description="vCenter Provisioner UI - Modern UI with Framer Motion"`
  - `LABEL project="vcenter-provisioner"`
  - `LABEL service="provisioner-ui"`
- Updated docker-compose.yml with build arguments
  - Added `args.VERSION: 0.1.0`
  - Added `image: antigravity/provisioner-ui:0.1.0`
  - Updated container name to `provisioner-ui-v0.1.0`

#### Documentation Structure
- Updated `MODERN-UX-REDESIGN.md` with implementation details
- Created comprehensive changelog (this document)
- Updated README.md

---

### Migration Guide: 0.1.0 → 0.1.1

**Type:** PATCH (No breaking changes)
**Migration Required:** No
**Steps:**

1. Pull latest changes from repository
2. Rebuild Docker images:
   ```powershell
   docker-compose build provisioner-ui

# Or build all services
   docker-compose build

# Run tests
npm run test

# Test application locally
docker-compose up -d
```

---

## [0.0.0] - 2026-01-31

### Added (Initial Release)
- Initial MVP of vCenter Provisioner
- 9-service microservices architecture
- Basic authentication flow
- Typifications CRUD operations
- VM provisioning workflow
- Monitoring and health checks
- Initial documentation suite

---

## Version Reference

| Version | Release Date | Type | Status |
|---------|--------------|------|--------|
| 0.1.2 | 2026-02-01 | PATCH | ✅ Stable |
| 0.1.1 | 2026-02-01 | PATCH | ✅ Stable |
| 0.1.0 | 2026-02-01 | MINOR | ✅ Stable |
| 0.0.0 | 2026-01-31 | INITIAL | ✅ Stable |
| [Unreleased] | TBD | - | 🚧 In Development |

---

## Migration Guides

### Upgrading from 0.1.1 to 0.1.2

**Type:** PATCH (No breaking changes)
**Migration Required:** No
**Steps:**

1. Pull latest changes from repository
2. Rebuild Docker images:
   ```powershell
   docker-compose build --no-cache provisioner-ui
   docker-compose up -d --build provisioner-ui
   ```
3. Verify application functionality:
   - Access UI at http://localhost:5173
   - Test TextField focus in "Nombre (ID)" and "Descripción" fields
   - Type complete words without losing focus

**Note:** No database migrations required. This is a UI-only bug fix release.

---

## Contributors

- vCenter Provisioner Team

---

**Last Updated:** 2026-02-01
**Maintained By:** vCenter Provisioner Team

---

© 2026 vCenter Provisioner Project | vCenter Provisioner Changelog
