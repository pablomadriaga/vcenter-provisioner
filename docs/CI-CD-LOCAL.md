# CI/CD Local: Guía Completa
# =============================================================================
# VERSION: 2.1.0 - Pipeline Unificado (start.ps1 deprecado)
# =============================================================================
> **Pragmatismo Staff-Grade | Onboarding sin fricción**

Esta guía documenta el pipeline CI/CD local diseñado para equipos con alta rotación donde el tiempo de onboarding debe ser mínimo, sin sacrificar calidad ni las mejores prácticas modernas.

**Contexto:** Este sistema NO está diseñado porque el equipo es "junior". Está diseñado porque cuando el personal entra y sale rápidamente, cada minuto de configuración innecesaria es tiempo perdido. La calidad y las buenas prácticas son no negociables; la complejidad arbitraria sí.

> **⚠️ IMPORTANTE:** `start.ps1` está deprecado. Usa `pipeline.ps1` para todas las operaciones incluyendo `--up`, `--down`, y `--status`.

---

## 🏗️ Local Development Lab

> **Onboarding en 5 minutos | Sin fricción**

Esta sección es el punto de entrada para desarrolladores nuevos.

### Levantar el Sistema (Único Comando)

```powershell
# Desde la raíz del proyecto
.\pipeline.ps1 --build   # Genera .env.ci + construye imágenes
.\pipeline.ps1 --up      # Levanta servicios
```

> **Nota:** `start.ps1` está deprecado. Usa `pipeline.ps1` para todo.

### Verificación

```powershell
# Health checks
curl http://localhost:3000/health    # API Gateway
curl http://localhost:3001/health    # Auth Service
curl http://localhost:8083/health    # Monitoring Sentinel

# UI
start http://localhost:5173
```

### Troubleshooting Rápido

| Problema | Solución |
|----------|----------|
| Docker no detectado | Instalar Docker Desktop |
| Puerto en uso | `Get-NetTCPConnection -LocalPort 3000` |
| Falta `.env.ci` | `.\pipeline.ps1 --build` |
| Tests fallan | `.\pipeline.ps1 --test --verbose` |

### Siguientes Pasos

- **Desarrollo**: `.\pipeline.ps1 --lint` para feedback rápido
- **Tests completos**: `.\pipeline.ps1 --docker` (determinismo)
- **Documentación**: Ver secciones abajo

---

## 📋 Índice

1. [Filosofía y Principios](#filosofía-y-principios)
2. [Entry Points](#entry-points)
3. [Configuración Centralizada](#configuración-centralizada)
4. [Flujos de Trabajo](#flujos-de-trabajo)
5. [Troubleshooting](#troubleshooting)
6. [Referencia Rápida](#referencia-rápida-de-comandos)

---

## 🎯 Filosofía y Principios

### Restricciones Objetivo

1. **NO Kubernetes** (kind, k3d, minikube)
2. **NO Registries remotas** (DockerHub, ECR, GCR)
3. **NO Herramientas adicionales sin justificar**
4. **Todo local explícito** (comandos simples y visibles)

### Lo que SÍ Hacemos

- ✅ **Docker-first**: Todo el pipeline corre en contenedores cuando es crítico
- ✅ **Tests híbridos**: Host para velocidad (lint, unit), Docker para determinismo (integración)
- ✅ **Imágenes con tags hash**: `servicio:<hash>`, no versiones remotas
- ✅ **Fail-fast**: Detener al primer error
- ✅ **Hash determinista**: Tags basados en contenido, no en versiones
- ✅ **Puertos centralizados**: Un solo archivo `config/ports.ps1`

### Decisiones Arquitectónicas

| Aspecto | Decisión | Justificación |
|---------|----------|---------------|
| **Tags** | Hash determinista (`service:<hash>`) | Reproducibilidad total |
| **Tests Lint** | Host | Feedback inmediato |
| **Unit Tests** | Host | Rápido durante desarrollo |
| **Integration Tests** | Docker | Determinisismo |
| **Build Docker** | Docker | Reproduce producción |
| **Scripts** | `.ps1` + `.ps1` | Windows primary, Linux compatible |
| **Puertos** | Centralizados | Un solo fuente de verdad |

---

## 🚀 Entry Points

### pipeline.ps1 (ÚNICO ENTRY POINT)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    pipeline.ps1                                        │
│                   (ENTRY POINT UNIFICADO)                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PIPELINE (Lint/Test/Build):                                            │
│    .\pipeline.ps1              # Lint + Test (Host) + Build           │
│    .\pipeline.ps1 --lint       # Solo lint                              │
│    .\pipeline.ps1 --test       # Solo test                             │
│    .\pipeline.ps1 --build      # Solo build (smart cache)              │
│    .\pipeline.ps1 --all        # Lint + Test + Build                   │
│    .\pipeline.ps1 --docker     # Tests en Docker (determinismo)       │
│    .\pipeline.ps1 --validate   # Validación temprana                    │
│                                                                          │
│  BUILD OPTIONS:                                                         │
│    .\pipeline.ps1 --build --force      # Forzar rebuild (skip cache)  │
│    .\pipeline.ps1 --build --no-cache   # docker build sin caché        │
│                                                                          │
│  SERVICIOS (Levantar/Bajar):                                            │
│    .\pipeline.ps1 --up         # Levantar servicios                    │
│    .\pipeline.ps1 --down       # Bajar servicios                       │
│    .\pipeline.ps1 --status     # Ver estado de contenedores           │
│                                                                          │
│  OTROS:                                                                 │
│    .\pipeline.ps1 --help       # Mostrar ayuda                         │
│                                                                          │
│  EQUIVALENTES ANTIGUOS (DEPRECADOS):                                   │
│    ci.ps1           → .\pipeline.ps1                                   │
│    run-ci.ps1       → .\pipeline.ps1 --docker                          │
│    start.ps1        → .\pipeline.ps1 --up / --down / --status         │
│    build.ps1        → .\pipeline.ps1 --build                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

> **⚠️ NOTA:** `start.ps1` está deprecado. Todos los scripts antiguos fueron unificados en `pipeline.ps1`. Usa `pipeline.ps1` para todas las operaciones.

---

## 🔧 Configuración Centralizada

### config/ports.ps1

Única fuente de verdad para ports del sistema.

```powershell
. "config/ports.ps1"
$global:PORTS["api-gateway"]["internal"]  # 3000
$global:PORTS["api-gateway"]["external"]  # 3000
```

### config/services.ps1

Única fuente de verdad para configuración de servicios.

```powershell
. "config/services.ps1"
$global:SERVICES["api-gateway"]["LintCmd"]   # "npm run lint"
$global:SERVICES["api-gateway"]["BuildCmd"]  # docker build...
```

---

## 💼 Flujos de Trabajo

### Flujo 1: Primer Día (Onboarding)

```powershell
# 1. Clonar
git clone <repo>
cd vcenter-provisioner

# 2. Validar prerrequisitos
.\pipeline.ps1 --validate

# 3. Build (genera .env.ci automáticamente)
.\pipeline.ps1 --build

# 4. Levantar servicios
.\pipeline.ps1 --up

# 5. Verificar
curl http://localhost:3000/health

# Tiempo total: ~5-10 minutos
```

### Flujo 2: Desarrollo Rápido

```powershell
# Editar código...
# Quick validation
.\pipeline.ps1 --lint

# Cuando este listo
.\pipeline.ps1 --build

# Levantar para probar
.\pipeline.ps1 --up
```

### Flujo 3: Determinismo Máximo (Tests en Docker)

```powershell
# Tests en contenedores (como en producción)
.\pipeline.ps1 --docker

# O completo con cleanup
.\pipeline.ps1 --all --docker
```

### Flujo 4: Solucionar Errores

```powershell
# Ver que falta
.\pipeline.ps1 --validate

# Build con detalles
.\pipeline.ps1 --build --verbose

# Reconstruir todo
.\pipeline.ps1 --build --force
```

---

## 🔍 Troubleshooting

### Docker No Encontrado

```powershell
❌ Docker NO detectado

SOLUCION:
1. Instalar Docker Desktop: https://www.docker.com/products/docker-desktop
2. Asegurar que este corriendo (icono verde en system tray)
3. Verificar: docker version
```

### Puerto en Uso

```powershell
# Ver que esta usando el puerto
netstat -ano | findstr :3000

# O en PowerShell
Get-NetTCPConnection -LocalPort 3000
```

### Falta .env.ci

```powershell
# pipeline.ps1 lo detecta y genera automaticamente
.\pipeline.ps1 --up

# O forzar generación
.\pipeline.ps1 --build
```

### Tests Fallan

```powershell
# Ver detalles
.\pipeline.ps1 --test --verbose

# Verificar que el servicio tenga tests
ls apps/api-gateway/src/*.test.*
```

---

## 📚 Referencia Rápida de Comandos

### Pipeline (Desarrollo)

| Comando | Descripción |
|--------|-------------|
| `.\pipeline.ps1` | Lint + Test (Host) + Build |
| `.\pipeline.ps1 --lint` | Solo lint |
| `.\pipeline.ps1 --test` | Solo test |
| `.\pipeline.ps1 --build` | Solo build (smart cache) |
| `.\pipeline.ps1 --build --force` | Forzar rebuild (skip cache) |
| `.\pipeline.ps1 --validate` | Validar prerrequisitos |
| `.\pipeline.ps1 --docker` | Tests en Docker |
| `.\pipeline.ps1 --all --docker` | Todo + cleanup |

### Servicios (Levantar/Bajar)

| Comando | Descripción |
|--------|-------------|
| `.\pipeline.ps1 --up` | Levantar servicios |
| `.\pipeline.ps1 --down` | Bajar servicios |
| `.\pipeline.ps1 --status` | Ver estado de contenedores |

### Docker Compose

| Comando | Descripción |
|--------|-------------|
| `docker compose up -d` | Levantar todos |
| `docker compose down` | Detener todos |
| `docker compose ps` | Ver estado |
| `docker compose logs -f <servicio>` | Ver logs |

---

## 📁 Archivos Clave

```
vcenter-provisioner/
├── pipeline.ps1              # ✅ Entry point unificado (TODO)
├── config/
│   ├── ports.ps1           # ✅ Puertos centralizados
│   └── services.ps1         # ✅ Servicios centralizados
├── infra/local/
│   └── docker-compose.yml   # ✅ Solo :hash tags
├── scripts/ci/
│   ├── hash.ps1            # Hash determinista
│   └── lint.ps1            # Lint (Anti-SQLite)
└── docs/
    ├── CONTRACT.md          # Contratos del sistema
    └── CI-CD-LOCAL.md      # Este documento
```

---

## ⚠️ Archivos Deprecados (No Usar)

| Archivo | Razón | Usar En Su Lugar |
|---------|-------|-------------------|
| `ci.ps1` | Duplicado | `pipeline.ps1` |
| `run-ci.ps1` | Duplicado | `pipeline.ps1 --docker` |
| `start.ps1` | Unificado | `pipeline.ps1 --up / --down / --status` |
| `build.ps1` | Duplicado | `pipeline.ps1 --build` |
| `docker-compose.ci.yml` | Duplicado | `docker-compose.yml` |

---

**Versión:** 2.1.0
**Actualizado:** 2026-02-07
**Autor:** Antigravity Engineering

© 2026 Antigravity Engineering | Pragmatismo en Producción
