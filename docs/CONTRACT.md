# Contrato CI/CD Local - vCenter Provisioner
# =============================================================================
# VERSION: 2.0.0 - Pipeline Unificado
# =============================================================================
# Este documento define los contratos del sistema.
# El código siempre tiene razón. Si la documentación contradice el código,
# cuestionar la documentación.
# =============================================================================

## Principios Innegociables

- No existe `latest`
- No existe `pull`
- Docker Compose NUNCA ejecuta build (usa .env.ci)
- No se usan timestamps
- No se usan hashes parciales
- No se usa commits Git
- No se nombra ni modela "producción"

## Identidad del Artefacto

El tag de cada imagen Docker es un hash determinista del contenido efectivo del directorio del servicio.

```
Tag = <service>:<hash10chars>
```

## Definición del Hash

### Input

El hash representa el **input efectivo al docker build**, no el estado del workspace.

### Excluidos (artefactos derivados)

- `node_modules/`
- `__pycache__/`
- `.git/`
- `.env*`
- `.vscode/`, `.idea/`
- `dist/`, `build/`
- `.cache/`, `.pytest_cache/`
- `*.egg-info/`
- `*.pyc`
- `.coverage/`, `coverage.xml`
- `test-results/`
- `secrets.json`, `*.pem`, `*.key`
- `.DS_Store`, `Thumbs.db`
- `.nvmrc`, `.python-version`, `.ruby-version`
- `.nyc_output/`
- `.dockerignore`
- `*.log`

### Incluidos (input efectivo al build)

- Código fuente
- `Dockerfile`
- Archivos de configuración versionados
- Manifests necesarios para el build
- `package.json`, `requirements.txt`, `go.mod`, etc.

### Algoritmo de Hash

```powershell
1. Normalizar raíz canónica: Resolve-Path + slash único
2. Recorrer recursivo -File (excluidos filtrados)
3. Para cada archivo:
   - Path relativo desde raíz (slash único, UTF-8)
   - SHA256 del contenido binario
4. Ordenar por path relativo lexicográfico
5. Concatenar: "relativePath:hash" por línea
6. SHA256 del resultado completo
7. Primeros 10 caracteres
```

### Symlinks

- Se resuelven (hash del destino)
- Symlinks rotos → error temprano

### Encoding

- Paths normalizados a UTF-8
- Concatenación en UTF-8 como invariante

## Fuentes de Verdad Centralizadas

### config/ports.ps1

Única fuente de verdad para ports del sistema.

```powershell
# Uso:
. "config/ports.ps1"
$global:PORTS["api-gateway"]["internal"]  # 3000
$global:PORTS["api-gateway"]["external"]  # 3000
```

### config/services.ps1

Única fuente de verdad para configuración de servicios.

```powershell
# Uso:
. "config/services.ps1"
$global:SERVICES["api-gateway"]["LintCmd"]  # "npm run lint"
$global:SERVICES["api-gateway"]["BuildCmd"]  # docker build...
```

### infra/local/docker-compose.yml

Único archivo de compose. Usa tags de hash.

```yaml
services:
  api-gateway:
    image: antigravity/api-gateway:${API_GATEWAY_HASH:-local}
```

## Arquitectura de Scripts

### pipeline.ps1 (ÚNICA PUERTA)

```
.\pipeline.ps1              # Lint + Test (Host) + Build
.\pipeline.ps1 --lint       # Solo lint
.\pipeline.ps1 --test       # Solo test
.\pipeline.ps1 --build      # Solo build (smart cache)
.\pipeline.ps1 --build --force      # Forzar rebuild
.\pipeline.ps1 --docker    # Tests en Docker (determinismo)
.\pipeline.ps1 --validate  # Validacion temprana
.\pipeline.ps1 --up        # Levantar servicios
.\pipeline.ps1 --down      # Bajar servicios
.\pipeline.ps1 --status    # Ver estado
```

> **⚠️ NOTA:** `start.ps1` está deprecado. Usa `pipeline.ps1` para todas las operaciones.

### scripts/ci/build.ps1

Genera `.env.ci` con hashes deterministas.

```powershell
.\scripts\ci\build.ps1
```

### scripts/ci/hash.ps1

Función pura `Get-DirectoryHash($Path)`.

## Archivos Deprecados (No Usar)

| Archivo | Razón | Reemplazado por |
|---------|-------|-----------------|
| `ci.ps1` | Duplicado | `pipeline.ps1` |
| `run-ci.ps1` | Duplicado | `pipeline.ps1 --docker` |
| `start.ps1` | Unificado | `pipeline.ps1 --up/--down/--status` |
| `build.ps1` | Duplicado | `pipeline.ps1 --build` |
| `docker-compose.ci.yml` | Duplicado | `docker-compose.yml` |

## Flujo de Uso

```powershell
# Desarrollo rapido
.\pipeline.ps1              # Lint + Test + Build
.\pipeline.ps1 --up         # Levantar servicios

# Validacion
.\pipeline.ps1 --validate   # Verificar prerrequisitos
.\pipeline.ps1 --lint       # Solo lint

# Tests en Docker (determinismo maximo)
.\pipeline.ps1 --docker     # Tests en contenedores
.\pipeline.ps1 --all --docker   # Todo + cleanup

# Solucionar errores
.\pipeline.ps1 --build --verbose  # Build con detalles
.\pipeline.ps1 --build --force    # Reconstruir todo
.\pipeline.ps1 --down             # Bajar servicios
```

## Contrato Invariante

| Condición | Garantía |
|-----------|----------|
| Mismo contenido lógico | Mismo hash |
| Contenido cambia | Hash cambia |
| Build exitoso | Imagen existe con tag `service:hash` |
| CI falla | No se ejecutan otros pasos |
| pipeline.ps1 --up ejecuta | Imágenes ya existen (o las construye) |

## Validación de Contrato

### Para Auditoría

```powershell
# Verificar que hash es función pura del contenido
.\scripts\ci\hash.ps1 -Path ./apps/api-gateway

# Verificar que cada imagen existe
docker images | grep -E "^antigravity/"

# Verificar que docker-compose usa tags de hash
cat infra/local/docker-compose.yml | grep "image:"
```

## anti-patrones Detectados

- ❌ `docker compose up --build` (build en runtime)
- ❌ Tags `latest`, `dev`, `test`
- ❌ Descargar imágenes de registry
- ❌ Usar timestamps en hashes
- ❌ Inferir nombres desde variables
- ❌ Reutilizar `.env.ci` sin regenerar
- ❌ `docker-compose.ci.yml` (duplicado)
- ❌ `start.ps1` (usar `pipeline.ps1 --up`)

---

**Version:** 2.1.0
**Updated:** 2026-02-07
**Author:** Antigravity Engineering

© 2026 Antigravity Engineering
