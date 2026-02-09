# Linux Migration Guide

## Contexto del Proyecto

Este es el **vCenter Provisioner**, un sistema de gestión de infraestructura virtualizada VMware.

### Arquitectura Actual (Windows/PowerShell)

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
**CI/CD:** Pipeline unificado (actualmente PowerShell)

### Componentes Multiplataforma (No cambian)

✅ Docker Compose files (`docker-compose.yml`)
✅ Dockerfiles de servicios
✅ Código fuente de aplicaciones (Node.js/Python/Go)
✅ Configuración JSON/YAML
✅ Base de datos y migraciones

### Componentes Windows-Only (A migrar)

❌ `pipeline.ps1` - Entry point CI/CD
❌ `scripts/ci/*.ps1` - Scripts de automatización
❌ PowerShell classes y funciones
❌ Windows-specific paths (`C:\Users\...`)
❌ Windows line endings (CRLF → LF)

## Requisitos de la Migración

### Funcionalidades CRÍTICAS a preservar:

1. **Single Entry Point:** Un solo comando para todo el CI/CD
2. **Smart Cache:** Sistema de caché por hash SHA256
3. **Hybrid Testing:** Tests en Host (rápido) + Docker (determinista)
4. **Fail-Fast:** Parar al primer error
5. **Hash Determinista:** Tags de imágenes basados en contenido

### Flujo del Pipeline Actual:

```powershell
# Ejecución actual en Windows:
.\pipeline.ps1              # Lint + Test + Build (Docker)
.\pipeline.ps1 --validate   # Validar prerrequisitos
.\pipeline.ps1 --lint       # Solo lint
.\pipeline.ps1 --test       # Solo tests
.\pipeline.ps1 --build      # Solo build
.\pipeline.ps1 --up         # Levantar servicios
.\pipeline.ps1 --down       # Bajar servicios
```

## Estrategia de Migración Recomendada

### Opción A: Bash Puro (Simple)
- Reescribir pipeline.ps1 como pipeline.sh
- Mantener lógica similar pero en Bash
- Usar `getopts` para argumentos
- Ventaja: Sin dependencias adicionales

### Opción B: Python (Robusto)
- Script Python con argparse
- Mejor manejo de estructuras complejas
- Cross-platform nativo
- Ventaja: Más mantenible a largo plazo

### Opción C: Make + Bash (Unix-idiomatic)
- Makefile para comandos principales
- Scripts bash modulares
- Ventaja: Estándar Linux

## Consideraciones Importantes

### 1. Paths
Windows: `C:\Users\...\projects\vcenter-provisioner`
Linux:   `/home/user/projects/vcenter-provisioner`

### 2. Permisos
- Scripts necesitan `chmod +x`
- Docker requiere grupo docker o sudo

### 3. Shebangs
Todos los scripts necesitan:
```bash
#!/usr/bin/env bash
set -euo pipefail
```

### 4. Dependencias a instalar
- Docker + Docker Compose
- Git
- Bash 4.0+
- (Opcional) Python 3.8+ si se elige opción B

## Estructura Propuesta (Linux)

```
vcenter-provisioner/
├── pipeline.sh           # Entry point bash (reemplaza pipeline.ps1)
├── scripts/
│   └── ci/
│       ├── pipeline.sh   # Lógica principal
│       ├── hash.sh       # Hash determinista
│       ├── build.sh      # Build de imágenes
│       ├── test.sh       # Tests híbridos
│       └── lint.sh       # Linting
├── scripts/utils/        # Funciones compartidas
│   ├── logging.sh        # Colores y logging
│   ├── docker.sh         # Helper Docker
│   └── validation.sh     # Validaciones
└── ... (resto igual)
```

## Primeros Pasos Sugeridos

1. **Branch:** Crear `feature/linux-migration`
2. **Docker:** Verificar que `docker-compose up` funcione standalone
3. **MVP:** Implementar solo `./pipeline.sh --validate` primero
4. **Iterar:** Agregar funcionalidades una por una
5. **Testing:** Probar cada comando antes de pasar al siguiente

## Referencias Clave

- `docs/CI-CD-LOCAL.md` - Documentación del pipeline actual
- `config/services.ps1` - Configuración de servicios (convertir a JSON/YAML)
- `scripts/ci/PipelineClasses.ps1` - Clases y funciones a migrar

## Preguntas para el Usuario

1. ¿Prefieren Bash puro, Python, o Make?
2. ¿Hay alguna funcionalidad del pipeline actual que NO sea necesaria en Linux?
3. ¿Necesitan mantener compatibilidad con Windows también (dual-support)?
4. ¿Qué versión de Linux? (Ubuntu 22.04+, CentOS, etc.)

---

**Nota:** El pipeline actual tiene 976 líneas muy optimizadas. La versión Linux no necesita ser tan compleja inicialmente - priorizar funcionalidad sobre optimización.
