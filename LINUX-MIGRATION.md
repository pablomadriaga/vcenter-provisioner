# Linux Migration Guide

## Estado de la Migración: **EN PROGRESO**

> **Última actualización:** 2026-03-17
> **Rama:** `feature/linux-support`

---

## Contexto del Proyecto

Este es el **vCenter Provisioner**, un sistema de gestión de infraestructura virtualizada VMware.

### Arquitectura Original (Windows/PowerShell)

```
vcenter-provisioner/
├── pipeline.ps1          # Entry point CI/CD (PowerShell 7.5+) - 976 líneas
├── scripts/ci/           # Scripts de CI
│   ├── PipelineClasses.ps1    # Clases PowerShell modernas
│   ├── hash.ps1              # Hash determinista SHA256
│   ├── build.ps1
│   └── ...
├── apps/                 # 11 microservicios
│   ├── api-gateway/      # Node.js + TypeScript
│   ├── auth-service/     # Node.js + TypeScript  
│   ├── typing-service/   # Python + FastAPI
│   ├── vm-orchestrator/  # Go
│   └── ...
├── infra/local/          # Docker Compose local
└── config/               # Configuración centralizada
```

### Stack Tecnológico

**Contenedores:** Docker + Docker Compose
**Servicios:** Mixto (Node.js, Python, Go, React)
**Base de Datos:** PostgreSQL + Redis
**CI/CD:** Pipeline unificado (PowerShell → Bash)

---

## Estado Actual de la Migración

### Componentes Migrados ✅

| Componente | Archivo Original | Archivo Nuevo | Estado |
|------------|-----------------|---------------|--------|
| Entry Point | `pipeline.ps1` | `pipeline.sh` | ✅ Completado (823 líneas) |
| Hash CI | `scripts/ci/hash.ps1` | `scripts/ci/hash.sh` | ✅ Completado |
| Build CI | `scripts/ci/build.ps1` | `scripts/ci/build.sh` | ✅ Completado |
| Lint CI | `scripts/ci/lint.ps1` | `scripts/ci/lint.sh` | ✅ Completado |
| Configuración | `config/ports.ps1` | `config/ports.json` | ✅ Completado |
| Configuración | `config/services.ps1` | `config/services.json` | ✅ Completado |

### Scripts PowerShell Eliminados: 35 archivos

```
pipeline.ps1, start.ps1, ci.ps1, run-tests.ps1,
run-integration-tests.ps1, run-e2e-tests.ps1,
run-perf-tests.ps1, run-security-tests.ps1,
run-accessibility-tests.ps1, deploy.ps1,
deploy-simple.ps1, deploy-ui.ps1, redeploy.ps1,
redeploy-ui-only.ps1, test-all-services.ps1,
dev-env-install.ps1, verify-setup.ps1,
config/ports.ps1, config/services.ps1,
scripts/ci/*.ps1 (5 archivos),
security-tests/*.ps1 (2 archivos),
y otros 10+ scripts auxiliares
```

---

## Estructura Actual (Linux)

```
vcenter-provisioner/
├── pipeline.sh                    # Entry point bash (823 líneas)
├── scripts/
│   ├── ci/
│   │   ├── hash.sh              # Hash determinista SHA256
│   │   ├── build.sh             # Build de imágenes Docker
│   │   ├── lint.sh              # Linting de servicios
│   │   └── test.sh              # Tests híbridos (EN DESARROLLO)
│   ├── pipeline/
│   │   ├── services.sh          # Gestión de servicios
│   │   ├── cleanup.sh           # Limpieza Docker
│   │   ├── resources.sh         # Recursos
│   │   ├── ops.sh               # Operaciones
│   │   └── lib/
│   │       ├── config.sh        # Utilidades de configuración
│   │       └── service.sh       # Utilidades de servicio
│   ├── utils/
│   │   ├── logging.sh           # Colores y logging
│   │   ├── docker.sh            # Helper Docker
│   │   ├── cache.sh             # Caché
│   │   ├── parallel.sh          # Paralelización
│   │   ├── error.sh             # Manejo de errores
│   │   ├── path.sh              # Utilidades de path
│   │   ├── retry.sh             # Reintentos
│   │   └── validation.sh        # Validaciones (FALTA)
│   └── testing/
│       └── runner.sh            # Test runner
├── config/
│   ├── ports.json                # Puertos de servicios
│   ├── services.json             # Configuración de servicios
│   └── test-manifest.json       # Manifiesto de tests
└── infra/local/
    └── docker-compose.yml        # Orquestación local
```

---

## Lo Completado ✅

### Core Pipeline
- [x] `pipeline.sh` - Entry point completo con soporte para:
  - `--validate` - Validar prerrequisitos
  - `--lint` - Linting
  - `--test` / `--test-host` / `--test-docker` - Tests híbridos
  - `--build` / `--build --force` - Build de imágenes
  - `--up` / `--down` - Gestión de servicios
  - `--status` - Estado de servicios
  - `--cleanup` / `--cleanup-full` - Limpieza

### CI Scripts
- [x] `scripts/ci/hash.sh` - Hash determinista
- [x] `scripts/ci/lint.sh` - Linting
- [x] `scripts/ci/build.sh` - Build

### Utilities
- [x] `scripts/utils/logging.sh` - Sistema de logging con colores
- [x] `scripts/utils/docker.sh` - Helpers Docker
- [x] `scripts/utils/cache.sh` - Gestión de caché
- [x] `scripts/utils/parallel.sh` - Ejecución paralela
- [x] `scripts/utils/error.sh` - Manejo de errores
- [x] `scripts/utils/path.sh` - Utilidades de path
- [x] `scripts/utils/retry.sh` - Reintentos

### Pipeline Lib
- [x] `scripts/pipeline/lib/config.sh` - Configuración
- [x] `scripts/pipeline/lib/service.sh` - Utilidades de servicio

### Pipeline Operations
- [x] `scripts/pipeline/services.sh` - Gestión de servicios
- [x] `scripts/pipeline/cleanup.sh` - Limpieza
- [x] `scripts/pipeline/resources.sh` - Recursos
- [x] `scripts/pipeline/ops.sh` - Operaciones

### Testing
- [x] `scripts/testing/runner.sh` - Test runner básico

---

## Lo Pendiente ❌

### Alta Prioridad

| Script | Descripción | Estado |
|--------|-------------|--------|
| `scripts/ci/test.sh` | Tests unitarios completos | ⏳ Pendiente |
| `scripts/testing/run-integration.sh` | Tests de integración | ❌ Falta |
| `scripts/testing/run-e2e.sh` | Tests E2E | ❌ Falta |

### Prioridad Media

| Script | Descripción | Estado |
|--------|-------------|--------|
| `scripts/deploy.sh` | Deployment de servicios | ❌ Falta |
| `scripts/deploy-ui.sh` | Deployment UI | ❌ Falta |
| `scripts/testing/run-perf.sh` | Tests de rendimiento | ❌ Falta |

### Prioridad Baja

| Script | Descripción | Estado |
|--------|-------------|--------|
| `scripts/security/zap-scan.sh` | OWASP ZAP scan | ❌ Falta |
| `scripts/security/dependency-audit.sh` | Auditoría de dependencias | ❌ Falta |
| `scripts/testing/run-security.sh` | Runner de security tests | ❌ Falta |
| `scripts/testing/run-accessibility.sh` | Runner de accessibility tests | ❌ Falta |
| `scripts/utils/validation.sh` | Validaciones | ❌ Falta |

---

## Componentes Multiplataforma (Sin cambios)

✅ Docker Compose files (`docker-compose.yml`)
✅ Dockerfiles de servicios
✅ Código fuente de aplicaciones (Node.js/Python/Go)
✅ Configuración JSON/YAML
✅ Base de datos y migraciones (node-pg-migrate)
✅ Documentación técnica

---

## Requisitos de la Migración (Preservados)

1. **Single Entry Point:** ✅ `./pipeline.sh` unifica todo
2. **Smart Cache:** Sistema de caché por hash SHA256
3. **Hybrid Testing:** Tests en Host (rápido) + Docker (determinista)
4. **Fail-Fast:** Parar al primer error
5. **Hash Determinista:** Tags de imágenes basados en contenido

### Flujo del Pipeline Linux:

```bash
# Ejecución en Linux:
./pipeline.sh                    # Default: Lint + Test + Build
./pipeline.sh --validate        # Validar prerrequisitos
./pipeline.sh --lint            # Solo lint
./pipeline.sh --test            # Solo tests
./pipeline.sh --test-host       # Tests en host (rápido)
./pipeline.sh --test-docker     # Tests en Docker (determinista)
./pipeline.sh --build           # Solo build
./pipeline.sh --build --force   # Forzar rebuild
./pipeline.sh --up              # Levantar servicios
./pipeline.sh --down             # Bajar servicios
./pipeline.sh --status           # Ver estado
./pipeline.sh --cleanup          # Limpiar recursos
```

---

## Consideraciones Importantes

### 1. Paths
- Windows: `C:\Users\...\projects\vcenter-provisioner`
- Linux:   `/home/user/projects/vcenter-provisioner`

### 2. Permisos
- Scripts necesitan `chmod +x`
- Docker requiere grupo docker o sudo

### 3. Shebangs
Todos los scripts usan:
```bash
#!/usr/bin/env bash
set -euo pipefail
```

### 4. Dependencias
- Docker + Docker Compose
- Git
- Bash 4.0+
- Python 3.8+ (para algunos servicios)
- Node.js, Go

---

## Métricas de Migración

| Métrica | Valor |
|---------|-------|
| Scripts PowerShell eliminados | 35 |
| Scripts Bash creados | 23 |
| Tasa de migración | ~66% |
| Estado | **EN PROGRESO** |

---

## Próximos Pasos

1. **Completar** `scripts/ci/test.sh`
2. **Implementar** scripts de deployment
3. **Crear** runners de testing especializado
4. **Validar** funcionamiento end-to-end

---

## Referencias

- `docs/CI-CD-LOCAL.md` - Documentación del pipeline
- `README.md` - Documentación principal
- `pipeline.sh` - Entry point con ayuda completa

---

**Nota:** La migración usa **Bash puro** (Opción A del plan original). El pipeline actual tiene 823 líneas y es fully functional para las operaciones principales.
