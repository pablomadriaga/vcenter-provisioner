# =============================================================================
# ANÁLISIS PROFUNDO: Arquitectura de Testing
# =============================================================================
# Objetivo: Determinar si pipeline.sh es runner o contenedor de lógica
# =============================================================================

## 1. ANÁLISIS DE run_*_tests() — ¿Lógica Real vs Llamadas Externas?

### run_host_tests() (~90 líneas)

**Lógica CONTENIDA en pipeline.sh:**
```bash
# 1. Bucles de iteración sobre servicios (hardcoded lists)
for service in "auth-service" "api-gateway"; do      # Node.js
for service in "vm-orchestrator" "vcenter-operations" "monitoring-service"; do  # Go
for service in "typing-service" "stats-service" "credential-manager" "backup-service"; do  # Python

# 2. Verificación de disponibilidad de herramientas
npm run 2>/dev/null | grep -q " test"
command -v go >/dev/null 2>&1
python3 -c "import pytest" 2>/dev/null

# 3. Contadores de pass/fail
local host_tests_passed=0
local host_tests_failed=0
((host_tests_passed++))  # en cada éxito
((host_tests_failed++))  # en cada fallo

# 4. Cálculo de duración
local host_test_start_time=$(date +%s)
local host_test_end_time=$(date +%s)
local host_test_duration=$((host_test_end_time - host_test_start_time))

# 5. Logging de resultados
log_test_result "$service" "pass" "Host tests passed"
log_test_result "$service" "fail" "Host tests failed"
```

**Llamadas EXTERNAS (delegadas):**
```bash
npm run test 2>/dev/null           # Node.js tests
go test ./... 2>/dev/null          # Go tests
python3 -m pytest app/ ...         # Python tests
```

**⚠️ PROBLEMA IDENTIFICADO:** 
- La lista de servicios está HARDCODEADA (9 servicios)
- La lógica de detección de stack (Node/Go/Python) está duplicada 3 veces
- El patrón "check → run → count" se repite para cada lenguaje

---

### run_docker_tests() (~85 líneas)

**Lógica CONTENIDA en pipeline.sh:**
```bash
# 1. Verificación de contenedores corriendo (hardcoded)
if docker ps --format "table {{.Names}}" | grep -q "provisioner-typing"
if docker ps --format "table {{.Names}}" | grep -q "provisioner-auth"
if docker ps --format "table {{.Names}}" | grep -q "provisioner-stats"

# 2. Lógica de FORCE_REBUILD (duplicada 3 veces)
if [[ "$FORCE_REBUILD" == "true" ]]; then
    docker-compose -f infra/local/docker-compose.yml stop <service>
    docker-compose -f infra/local/docker-compose.yml up -d <service>
    sleep 5
fi

# 3. Pattern matching en output (frágil)
docker exec ... 2>&1 | tail -10 | grep -q "passed"
docker exec ... 2>&1 | tail -5 | grep -q "collected 0 items"
docker exec ... 2>&1 | tail -10 | grep -q "No test files found"

# 4. Manejo de fallo fail-fast
log_failure_banner "Tests Failed - Stopping Pipeline (Fail-Fast)"
exit 1

# 5. Contadores (igual que host)
local docker_tests_passed=0
local docker_tests_failed=0
```

**Llamadas EXTERNAS (delegadas):**
```bash
docker exec provisioner-typing python -m pytest ...
docker exec provisioner-auth npm test
docker exec provisioner-stats python -m pytest ...
```

**⚠️ PROBLEMA CRÍTICO:**
- ¡DUPLICACIÓN MASIVA! El patrón "docker ps → docker exec → grep" se repite 3 veces
- Nombres de contenedores hardcodeados
- Lógica de rebuild duplicada
- Patrones de grep frágiles (dependen de formato de salida)

---

### install_test_dependencies() (~15 líneas)

**Lógica CONTENIDA:**
```bash
# Hardcoded a 2 servicios específicos
if docker ps ... | grep -q "provisioner-typing"
    docker exec provisioner-typing pip install pytest-html pytest-junitxml
if docker ps ... | grep -q "provisioner-stats"
    docker exec provisioner-stats pip install pytest-html pytest-junitxml
```

**⚠️ PROBLEMA:** 
- Solo 2 de 9+ servicios tienen instalación de dependencias
- Lógica ad-hoc, no escalable

---

## 2. DUPLICACIÓN IDENTIFICADA

### Duplicación Interna (dentro de pipeline.sh)

| Patrón | Ocurrencias | Líneas Duplicadas |
|--------|-------------|-------------------|
| Iteración de servicios | 6x | ~60 líneas |
| Check → Run → Count | 9x | ~90 líneas |
| FORCE_REBUILD logic | 3x | ~30 líneas |
| Pattern matching grep | 6x | ~30 líneas |
| Contadores pass/fail | 2x | ~10 líneas |

**Total duplicación interna:** ~220 líneas (72% del código de testing)

---

### Duplicación Externa (pipeline.sh vs tests/)

#### tests/pipeline.test.sh vs pipeline.sh

**tests/pipeline.test.sh** (~197 líneas):
- Framework de testing propio (pass/fail/skip)
- Tests para utils: logging, docker, path, parallel, retry
- Tests de carga para pipeline.sh
- Es un **test runner del INFRAESTRUCTURA**, no de la app

**pipeline.sh run_*_tests()** (~215 líneas):
- Hardcoded service lists
- Ejecuta tests de aplicación (npm, go, pytest)
- Es un **test runner de la APLICACIÓN**

**⚠️ PROBLEMA ARQUITECTÓNICO:**
```
Tenemos DOS sistemas de testing:
├─ tests/pipeline.test.sh → Testea el pipeline mismo (infra)
└─ pipeline.sh → Testea la aplicación (app)

Pero pipeline.test.sh es más limpio:
✓ Tiene framework de testing (pass/fail/skip)
✓ No tiene lógica hardcodeada
✓ Es modular y extensible

Mientras que pipeline.sh es:
✗ Spaghetti code con duplicación
✗ Hardcoded a servicios específicos
✗ Mezcla lógica de negocio con orquestación
```

---

### Directorios de Tests

```
vcenter-provisioner/
├── tests/
│   └── pipeline.test.sh          # Test runner de INFRA (197 líneas)
├── security-tests/               # VACÍO
│   └── (empty)
├── perf-tests/                   # NO EXISTE
│
└── apps/
    ├── auth-service/
    │   └── src/
    │       └── auth.test.ts      # Tests de app (Vitest)
    │       └── integration.spec.ts  # Tests de integración
    ├── typing-service/
    │   └── app/
    │       └── test_typing.py    # Tests de app (pytest)
    └── ...
```

**OBSERVACIÓN:**
- `tests/` solo contiene tests del pipeline (infra), no de la app
- Los tests de aplicación están dispersos en `apps/*/`
- `security-tests/` está vacío
- `perf-tests/` no existe

---

## 3. ROL DE pipeline.sh: ¿Runner o Contenedor de Lógica?

### EVIDENCIA: Es AMBOS (problema de diseño)

**Como RUNNER:**
```bash
# ✅ Aspectos de runner (bien)
- Coordina ejecución de tests
- Decide secuencia (host → docker)
- Maneja flags CLI (--test, --test-host, --test-docker)
- Reporta resultados agregados
```

**Como CONTENEDOR DE LÓGICA (mal):**
```bash
# ❌ Aspectos de contenedor de lógica (problema)
- Tiene hardcoded lists de servicios
- Implementa lógica de detección de stack
- Contiene lógica de FORCE_REBUILD
- Tiene pattern matching frágil
- Implementa contadores y métricas
```

### COMPARACIÓN: tests/pipeline.test.sh es mejor diseñado

| Aspecto | tests/pipeline.test.sh | pipeline.sh run_*_tests |
|---------|----------------------|------------------------|
| Framework | ✅ Sí (pass/fail/skip) | ❌ No (logs directos) |
| Hardcoded | ✅ No (genérico) | ❌ Sí (servicios) |
| Extensible | ✅ Sí (fácil añadir tests) | ❌ No (editar código) |
| Modular | ✅ Sí (una función por módulo) | ❌ No (todo junto) |
| Reutilizable | ✅ Sí | ❌ No |

---

## 4. PROPUESTA DE ARQUITECTURA FUTURA

### Opción A: Extracción Simple (Corto Plazo)

Mover funciones a `scripts/pipeline/tests.sh`:
- ✅ Reduce pipeline.sh en ~215 líneas
- ⚠️ No resuelve duplicación interna
- ⚠️ Mantiene hardcoded lists

### Opción B: Refactor Profundo (Recomendado)

**Nueva arquitectura de testing:**

```
scripts/testing/
├── framework.sh              # Framework base (tipo tests/pipeline.test.sh)
│   ├── test_runner()         # Orquesta tests
│   ├── assert_equals()       # Assertions
│   ├── test_suite()          # Agrupa tests
│   └── report()              # Genera reportes
│
├── runners/
│   ├── host-runner.sh        # Wrapper para npm/go/pytest
│   ├── docker-runner.sh      # Wrapper para docker exec
│   └── discovery.sh          # Descubre tests en apps/*/
│
├── reporters/
│   ├── html-reporter.sh      # Reemplaza create_master_html_report()
│   └── console-reporter.sh   # Logging bonito
│
└── config/
    └── test-manifest.json    # Lista de servicios y sus tipos de test
```

**pipeline.sh se convierte en ORQUESTADOR puro:**

```bash
# pipeline.sh (post-refactor completo)
source "$BASE_DIR/scripts/testing/framework.sh"
source "$BASE_DIR/scripts/testing/runners/host-runner.sh"
source "$BASE_DIR/scripts/testing/runners/docker-runner.sh"
source "$BASE_DIR/scripts/testing/reporters/html-reporter.sh"

run_hybrid_tests() {
    # Solo orquestación, no lógica de negocio
    test_runner --type=host --manifest=config/test-manifest.json
    test_runner --type=docker --manifest=config/test-manifest.json
    generate_report --format=html
}
```

### Opción C: Migración a tests/pipeline.test.sh

Reutilizar el framework existente en `tests/`:

```bash
# Mover tests/pipeline.test.sh a scripts/testing/
# Extenderlo para soportar tests de aplicación
# Eliminar run_*_tests() de pipeline.sh
```

**Ventajas:**
- ✅ Framework ya existe y funciona
- ✅ Es limpio y extensible
- ✅ Elimina duplicación

---

## 5. CONCLUSIONES Y RECOMENDACIONES

### Problemas Críticos Identificados

1. **Duplicación masiva interna** (72% del código de testing)
2. **Hardcoded service lists** (imposible mantener)
3. **Mezcla de responsabilidades** (runner + lógica de negocio)
4. **Dos frameworks de testing** (uno bueno en tests/, otro malo en pipeline.sh)

### Recomendación

**NO extraer funciones de testing a módulos separados todavía.**

**En su lugar:**
1. **Refactor interno** de run_*_tests() para eliminar duplicación
2. **Extraer listas hardcoded** a configuración (JSON/YAML)
3. **Reutilizar framework** de tests/pipeline.test.sh
4. **Luego** extraer a scripts/testing/

**Beneficio:**
- Reduce pipeline.sh de 905 → ~750 líneas
- Elimina ~150 líneas de duplicación
- Prepara terreno para arquitectura limpia

---

## APÉNDICE: Métricas de Complejidad

| Métrica | Valor |
|---------|-------|
| Lógica contenida en run_*_tests | ~215 líneas |
| Llamadas externas | ~15 comandos |
| Duplicación interna | ~220 líneas (72%) |
| Servicios hardcodeados | 9 servicios |
| Patrones de diseño usados | 0 (spaghetti) |
| Framework de testing | ❌ Ninguno |
| Configuración externalizada | ❌ Ninguna |
