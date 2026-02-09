> **Para la siguiente IA:**  
> Este documento te da el contexto completo para migrar este proyecto de Windows/PowerShell a Linux/Bash.

# 🐧 Contexto de Migración Linux

## 📋 Situación Actual

**Tienes este proyecto:** Sistema vCenter Provisioner (gestión de infraestructura VMware)  
**Está en:** Windows con PowerShell 7.5  
**Necesitas:** Versión Linux funcional

## 🎯 Objetivo

Crear una branch `feature/linux-support` con el proyecto funcionando 100% en Linux.

## 📚 Documentación Clave

**Lee estos archivos ANTES de tocar cualquier código:**

1. **INVARIANTS.md** - Reglas que NUNCA debes romper
2. **LINUX-MIGRATION.md** - Guía completa de migración
3. **docs/CI-CD-LOCAL.md** - Entiende cómo funciona el pipeline actual
4. **scripts/verify-migration.sh** - Script para validar tu trabajo

## 🔧 Arquitectura Actual

### Componentes Windows-Only (Tu trabajo)

| Archivo Windows | Debe convertirse a | Prioridad |
|-----------------|-------------------|-----------|
| `pipeline.ps1` (976 líneas) | `pipeline.sh` | 🔴 CRÍTICA |
| `scripts/ci/PipelineClasses.ps1` | `scripts/ci/` (bash scripts) | 🔴 CRÍTICA |
| `scripts/ci/*.ps1` | `scripts/ci/*.sh` | 🔴 CRÍTICA |
| `config/*.ps1` | `config/*.json` | 🟡 Media |

### Componentes Multiplataforma (NO tocar)

✅ Dockerfiles (ya son Linux)  
✅ Código fuente Node.js/Python/Go  
✅ docker-compose.yml  
✅ Base de datos y migraciones

## 🚀 Plan de Implementación Sugerido

### Fase 1: Infraestructura (30 min)
- [ ] Crear branch `feature/linux-support`
- [ ] Crear `pipeline.sh` básico (solo `--help` y `--validate`)
- [ ] Crear `scripts/utils/logging.sh` (colores, funciones de log)
- [ ] Probar que `./pipeline.sh --help` funcione

### Fase 2: Validación (45 min)
- [ ] Implementar `./pipeline.sh --validate`
- [ ] Debe verificar: Docker, puertos, Dockerfiles
- [ ] Probar: `./scripts/verify-migration.sh`

### Fase 3: Lint (30 min)
- [ ] Implementar `./pipeline.sh --lint`
- [ ] Debe correr lint en todos los servicios Node.js
- [ ] Probar en al menos 3 servicios

### Fase 4: Build (60 min)
- [ ] Implementar `./pipeline.sh --build`
- [ ] Sistema de hash SHA256 (ver `scripts/ci/hash.ps1`)
- [ ] Smart cache (no rebuild si hash no cambió)
- [ ] Debe construir shared-scripts PRIMERO

### Fase 5: Up/Down (30 min)
- [ ] Implementar `./pipeline.sh --up`
- [ ] Implementar `./pipeline.sh --down`
- [ ] Probar que levanta todos los servicios

### Fase 6: Testing (45 min)
- [ ] Verificar `curl http://localhost:3000/health`
- [ ] Verificar UI en http://localhost:5173
- [ ] Ejecutar `./scripts/verify-migration.sh` - debe pasar todo

**Tiempo total estimado:** 4-5 horas

## 💡 Consejos Técnicos

### 1. Shebangs
```bash
#!/usr/bin/env bash
set -euo pipefail
```

### 2. Colores en terminal
```bash
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly NC='\033[0m'

echo -e "${GREEN}✅ Success${NC}"
```

### 3. Paths
Windows: `C:\Users\name\projects\vcenter-provisioner`  
Linux:   `/home/name/projects/vcenter-provisioner` o `./`

Usa siempre paths relativos:
```bash
readonly BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
```

### 4. Funciones vs Scripts

**Opción A - Un solo archivo pipeline.sh:**
```bash
#!/usr/bin/env bash
# Todo en uno
function lint_all() { ... }
function build_all() { ... }
main "$@"
```

**Opción B - Scripts modulares (recomendado):**
```bash
# pipeline.sh
source scripts/utils/logging.sh
source scripts/ci/lint.sh
source scripts/ci/build.sh
```

### 5. Argumentos
```bash
#!/usr/bin/env bash

while [[ $# -gt 0 ]]; do
  case $1 in
    --lint)
      RUN_LINT=true
      shift
      ;;
    --build)
      RUN_BUILD=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done
```

### 6. Docker Compose
```bash
# En vez de:
docker-compose -f infra/local/docker-compose.yml up -d

# Usa:
docker compose -f infra/local/docker-compose.yml up -d
# (nueva sintaxis sin guión)
```

## 🐛 Errores Comunes a Evitar

### ❌ NO hagas esto:
```bash
# Mal: No usar backticks
files=`ls`

# Mal: No verificar si comando falló
docker build -t myimage .
echo "Build exitoso"  # Se ejecuta aunque falle

# Mal: Variables sin comillas
rm -rf $MY_DIR  # Si MY_DIR="", borra /
```

### ✅ Sí haz esto:
```bash
# Bien: Usar $()
files=$(ls)

# Bien: Verificar errores
if ! docker build -t myimage .; then
    echo "Build falló"
    exit 1
fi

# Bien: Variables entre comillas
rm -rf "$MY_DIR"
```

## 📊 Criterios de Éxito

El proyecto está migrado cuando:

1. ✅ `./pipeline.sh --validate` pasa
2. ✅ `./pipeline.sh --lint` pasa en todos los servicios
3. ✅ `./pipeline.sh --build` construye todas las imágenes
4. ✅ `./pipeline.sh --up` levanta todos los servicios
5. ✅ `curl http://localhost:3000/health` devuelve 200
6. ✅ UI funciona en http://localhost:5173
7. ✅ `./pipeline.sh --down` baja todo limpiamente
8. ✅ `./scripts/verify-migration.sh` pasa 100%

## 🆘 Si te Atascas

1. **Revisa INVARIANTS.md** - Seguramente estás rompiendo una regla
2. **Mira el pipeline.ps1 original** - La lógica está ahí, solo tradúcela
3. **Prioriza:** Primero que funcione, luego optimizas
4. **Pregunta al usuario:** Si algo no está claro, es mejor preguntar

## ⏱️ Límites de Tiempo

- Si llevas más de 2 horas en una fase → Pregunta al usuario
- Si no entiendes algo → Lee el archivo .ps1 original
- Si estás copiando >100 líneas de código → Reconsidera el approach

## 🎓 Conocimientos Previos Necesarios

Debes saber:
- ✅ Bash scripting básico
- ✅ Docker y Docker Compose
- ✅ Git

Es útil saber:
- ⭐ PowerShell (para leer el código original)
- ⭐ Linux file permissions
- ⭐ Process management

## 📝 Ejemplo Mínimo Funcional

```bash
#!/usr/bin/env bash
# pipeline.sh - Versión mínima

set -euo pipefail

readonly BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

function validate() {
    echo "🔍 Validando..."
    docker version > /dev/null 2>&1 || { echo "❌ Docker no disponible"; exit 1; }
    echo "✅ Docker OK"
}

function lint() {
    echo "🔍 Linting..."
    # Implementar luego
    echo "✅ Lint OK"
}

function show_help() {
    echo "Uso: ./pipeline.sh [OPCIONES]"
    echo ""
    echo "Opciones:"
    echo "  --validate    Validar prerrequisitos"
    echo "  --lint        Ejecutar lint"
    echo "  --help        Mostrar ayuda"
}

# Main
case "${1:-}" in
    --validate)
        validate
        ;;
    --lint)
        lint
        ;;
    --help|*)
        show_help
        ;;
esac
```

## 🎯 Tu Misión

**NO** necesitas:
- ❌ Optimizar hasta 976 líneas como el original
- ❌ Usar clases OOP complejas
- ❌ Implementar TODAS las flags del pipeline original

**SÍ** necesitas:
- ✅ Que funcione el flujo básico: validate → lint → build → up
- ✅ Que los servicios realmente levanten
- ✅ Que la UI sea accesible
- ✅ Que pase verify-migration.sh

## 🚀 Empecemos

1. Crea la branch: `git checkout -b feature/linux-support`
2. Lee INVARIANTS.md completamente
3. Implementa Fase 1 (pipeline.sh básico)
4. Corre `./scripts/verify-migration.sh`
5. Continúa con Fase 2, 3, etc.

**¡Buena suerte!** 🐧

---

*Documento creado por el CI/CD Architect original*  
*Fecha: 2026-02-09*
