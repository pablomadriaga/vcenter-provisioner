# =============================================================================
# INVENTARIO COMPLETO DE TESTS — vCenter Provisioner
# =============================================================================
# Excluyendo: node_modules/, .git/
# Fecha: $(date)
# =============================================================================

## 📊 RESUMEN EJECUTIVO

| Categoría | Cantidad | Estado |
|-----------|----------|--------|
| **Tests de Aplicación** | 12 archivos | ✅ Activos |
| **Performance Tests** | 3 archivos | ⚠️ No integrados |
| **Infraestructura** | 1 archivo | ✅ Activo |
| **Seguridad Tests** | 0 archivos | ❌ Vacío |
| **Resultados** | 2 directorios | ✅ Generados por pipeline |
| **Documentación** | 7 archivos | ✅ Referencia |

---

## 1. TESTS DE APLICACIÓN (12 archivos)

### 1.1 TypeScript/JavaScript (Node.js)

| Ruta | Framework | Tipo | Ejecutado por pipeline.sh |
|------|-----------|------|---------------------------|
| `apps/api-gateway/src/gateway.test.ts` | Vitest | Unit | ✅ Sí (línea 312) |
| `apps/api-gateway/src/integration-real.test.ts` | Vitest | Integration | ✅ Sí (línea 312) |
| `apps/api-gateway/src/security.test.ts.skip` | Vitest | Security | ❌ No (.skip) |
| `apps/auth-service/src/auth.test.ts` | Vitest | Unit | ✅ Sí (línea 312) |
| `apps/auth-service/src/integration.spec.ts` | Vitest | Integration | ✅ Sí (línea 312) |
| `apps/vcenter-config-service/tests/credentialManager.test.ts` | Vitest | Unit | ❌ No (no está en lista) |

**Configuración:**
- `apps/api-gateway/vitest.config.ts` — Config Vitest
- `apps/auth-service/vitest.config.ts` — Config Vitest
- `apps/vcenter-config-service/vitest.config.ts` — Config Vitest

**Qué ejecuta:**
```bash
npm run test  # Ejecuta todos los *.test.ts y *.spec.ts
```

**Estado:**
- 5 tests activos, 1 desactivado (.skip)
- 1 no referenciado en pipeline.sh (credentialManager.test.ts)

---

### 1.2 Go Tests

| Ruta | Framework | Tipo | Ejecutado por pipeline.sh |
|------|-----------|------|---------------------------|
| `apps/monitoring-service/main_test.go` | Go testing | Unit | ✅ Sí (línea 337) |
| `apps/vcenter-integration/main_test.go` | Go testing | Unit | ✅ Sí (línea 337) |
| `apps/vm-orchestrator/main_test.go` | Go testing | Unit | ✅ Sí (línea 337) |

**Qué ejecuta:**
```bash
go test ./...  # Ejecuta todos los *_test.go
```

**Estado:**
- 3 tests activos
- Todos referenciados en pipeline.sh

---

### 1.3 Python Tests

| Ruta | Framework | Tipo | Ejecutado por pipeline.sh |
|------|-----------|------|---------------------------|
| `apps/stats-service/app/test_stats.py` | pytest | Unit | ❌ No (no está en lista) |
| `apps/typing-service/app/test_typing.py` | pytest | Unit | ✅ Sí (línea 415-416) |

**Configuración:**
- `apps/stats-service/pytest.ini` — Config pytest
- `apps/typing-service/pytest.ini` — Config pytest

**Qué ejecuta:**
```bash
python -m pytest app/ -v --tb=short
```

**Estado:**
- 1 test activo (typing)
- 1 no referenciado (stats)

---

### 1.4 Variables de Entorno de Test

| Ruta | Uso |
|------|-----|
| `apps/auth-service/.env.test` | Variables para tests de auth-service |

---

## 2. PERFORMANCE TESTS (3 archivos)

| Ruta | Framework | Tipo | Ejecutado por pipeline.sh |
|------|-----------|------|---------------------------|
| `perf-tests/auth-load-test.js` | k6 | Load Test | ❌ NO |
| `perf-tests/full-flow-load-test.js` | k6 | E2E Load Test | ❌ NO |
| `perf-tests/provision-load-test.js` | k6 | Load Test | ❌ NO |

**Qué ejecutan:**
```bash
k6 run auth-load-test.js  # Simula carga de autenticación
```

**Características:**
- Usan k6 (herramienta de load testing)
- Definen escenarios de ramp-up/ramp-down
- Métricas personalizadas (auth_errors, auth_latency)
- Thresholds configurados

**Estado:**
- ⚠️ **NO INTEGRADOS** en pipeline.sh
- Scripts huérfanos (no se ejecutan automáticamente)
- Requieren k6 instalado

---

## 3. INFRAESTRUCTURA (1 archivo)

| Ruta | Tipo | Ejecutado por pipeline.sh |
|------|------|---------------------------|
| `tests/pipeline.test.sh` | Test Runner | ❌ NO |

**Descripción:**
- Framework de testing propio para utils/
- Tests de carga de módulos (logging.sh, docker.sh, path.sh, etc.)
- Tests funcionales (safe_cd, parallel_exec, retry)
- NO testea la aplicación, testea el pipeline mismo

**Qué ejecuta:**
```bash
./tests/pipeline.test.sh
```

**Estado:**
- ⚠️ **NO INTEGRADO** en pipeline.sh
- Script independiente
- Más limpio que run_*_tests() de pipeline.sh

---

## 4. SEGURIDAD TESTS (0 archivos activos)

| Ruta | Estado |
|------|--------|
| `security-tests/` | ❌ **VACÍO** |

**Archivo inactivo:**
- `apps/api-gateway/src/security.test.ts.skip` — Renombrado con .skip

**Estado:**
- Directorio existe pero está vacío
- No hay tests de seguridad activos

---

## 5. RESULTADOS (2 directorios)

| Ruta | Contenido | Generado por |
|------|-----------|--------------|
| `test-results/` | Reportes HTML | ✅ pipeline.sh (create_master_html_report) |
| `test-results/master-report.html` | Reporte master | ✅ Generado dinámicamente |
| `test-results/services/` | Reportes individuales | ✅ Generado por pytest |

**Estado:**
- Directorio generado automáticamente
- Contenido efímero (debería estar en .gitignore)

---

## 6. DOCUMENTACIÓN (7 archivos)

| Ruta | Tipo | Contenido |
|------|------|-----------|
| `docs/DOCKER-COMPOSE-TEST-RESULTS.md` | Resultados | Resultados de tests en Docker |
| `docs/e2e-performance-tests.md` | Guía | Guía de tests E2E y performance |
| `docs/integration-tests.md` | Guía | Guía de tests de integración |
| `docs/retrospective-aar.md` | Retrospectiva | After Action Review |
| `docs/security-accessibility-tests.md` | Guía | Tests de seguridad y accesibilidad |
| `docs/test-report.md` | Reporte | Reporte de tests generado |
| `docs/testing-plan.md` | Plan | Plan de testing del proyecto |
| `docs/ux-specification.md` | Especificación | Especificación UX |
| `ANALISIS_TESTING_ARQUITECTURA.md` | Análisis | Análisis de arquitectura de testing |

**Estado:**
- Documentación de referencia
- No ejecutables

---

## 🔍 ANÁLISIS DE COBERTURA

### Tests Referenciados en pipeline.sh

**run_host_tests() ejecuta:**
- ✅ Node: auth-service, api-gateway
- ✅ Go: vm-orchestrator, vcenter-integration, monitoring-service
- ✅ Python: typing-service, stats-service, vcenter-config, backup-service

**run_docker_tests() ejecuta:**
- ✅ typing-service (docker exec)
- ✅ auth-service (docker exec)
- ✅ stats-service (docker exec)

**❌ NO EJECUTADOS (referenciados pero no funcionan):**
- credentialManager.test.ts (no está en lista)
- test_stats.py (no está en lista docker)

### Brechas Identificadas

| Servicio | Test Existe | En run_host_tests | En run_docker_tests |
|----------|-------------|-------------------|---------------------|
| api-gateway | ✅ gateway.test.ts | ✅ Sí | ❌ No |
| api-gateway | ✅ integration-real.test.ts | ✅ Sí | ❌ No |
| auth-service | ✅ auth.test.ts | ✅ Sí | ✅ Sí |
| auth-service | ✅ integration.spec.ts | ✅ Sí | ✅ Sí |
| vcenter-config | ✅ credentialManager.test.ts | ❌ No | ❌ No |
| monitoring | ✅ main_test.go | ✅ Sí | ❌ No |
| vcenter-integration | ✅ main_test.go | ✅ Sí | ❌ No |
| vm-orchestrator | ✅ main_test.go | ✅ Sí | ❌ No |
| typing-service | ✅ test_typing.py | ✅ Sí | ✅ Sí |
| stats-service | ✅ test_stats.py | ✅ Sí | ❌ No |

---

## 📋 CLASIFICACIÓN POR TIPO

### Frameworks de Testing Usados

| Framework | Servicios | Ubicación |
|-----------|-----------|-----------|
| **Vitest** | Node.js apps | apps/*/node_modules |
| **Go testing** | Go apps | Standard library |
| **pytest** | Python apps | pip install |
| **k6** | Performance | Global (no en node_modules) |
| **Bash** | Infraestructura | Custom (tests/pipeline.test.sh) |

### Runner vs Colección vs Framework

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `pipeline.sh run_*_tests()` | 🏃 Runner | Orquesta ejecución, contiene lógica |
| `tests/pipeline.test.sh` | 🏃 Runner + Framework | Framework propio + runner |
| `apps/*/*.test.ts` | 📦 Colección | Tests individuales (Vitest) |
| `apps/*/*.spec.ts` | 📦 Colección | Tests individuales (Vitest) |
| `apps/*/*_test.go` | 📦 Colección | Tests individuales (Go) |
| `apps/*/test_*.py` | 📦 Colección | Tests individuales (pytest) |
| `perf-tests/*.js` | 📦 Colección + Config | Tests k6 con escenarios |

---

## ⚠️ PROBLEMAS IDENTIFICADOS

### 1. Tests Huérfanos (No Ejecutados)
- `apps/vcenter-config-service/tests/credentialManager.test.ts`
- `apps/stats-service/app/test_stats.py` (en docker)
- `perf-tests/*.js` (3 archivos)
- `tests/pipeline.test.sh`

### 2. Tests Desactivados
- `apps/api-gateway/src/security.test.ts.skip`

### 3. Directorios Vacíos
- `security-tests/`

### 4. Inconsistencias
- Algunos tests Python no se ejecutan en docker
- credentialManager.test.ts no está en ninguna lista

---

## 📊 ESTADÍSTICAS FINALES

| Métrica | Valor |
|---------|-------|
| **Tests activos** | 12 archivos |
| **Tests desactivados** | 1 archivo |
| **Tests huérfanos** | 5 archivos |
| **Total archivos de test** | 18 |
| **Tests ejecutados por pipeline.sh** | 10 |
| **Cobertura estimada** | ~56% |
| **Frameworks usados** | 5 (Vitest, Go, pytest, k6, Bash) |

---

## 🎯 RECOMENDACIONES

### Alta Prioridad
1. **Integrar perf-tests/** en pipeline.sh o eliminar
2. **Mover tests/pipeline.test.sh** a scripts/testing/
3. **Activar credentialManager.test.ts** añadiéndolo a la lista
4. **Ejecutar test_stats.py** en docker

### Media Prioridad
5. **Eliminar security-tests/** o añadir tests
6. **Renombrar** security.test.ts.skip o eliminar
7. **Añadir** test-results/ a .gitignore

### Baja Prioridad
8. **Unificar** framework de testing (actualmente 5 diferentes)
9. **Crear** test-manifest.json para evitar hardcoded lists
