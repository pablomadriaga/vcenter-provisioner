# =============================================================================
# REPORTE ESTRUCTURAL — pipeline.sh (Post-Refactor)
# =============================================================================
# Fecha: $(date '+%Y-%m-%d %H:%M:%S')
# Total de líneas: 905
# =============================================================================

## CLASIFICACIÓN DE FUNCIONES RESTANTES

### 1. PARSING CLI Y CONFIGURACIÓN (~215 líneas)

| Función | Líneas | Categoría | Descripción |
|---------|--------|-----------|-------------|
| parse_arguments() | 152 | PARSING CLI | Parseo completo de flags CLI |
| load_config() | 38 | CONFIGURACIÓN | Setup inicial y verificación BD |
| show_help() | ~55 | PARSING CLI/DOC | Documentación de uso |

**Total Parsing/Config:** ~245 líneas (27% del archivo)

### 2. LÓGICA DE NEGOCIO SIGNIFICATIVA (~325 líneas)

| Función | Líneas | Categoría | Descripción |
|---------|--------|-----------|-------------|
| run_host_tests() | ~90 | LÓGICA DE NEGOCIO | Tests en host (Node, Go, Python) |
| run_docker_tests() | ~85 | LÓGICA DE NEGOCIO | Tests en contenedores |
| run_hybrid_tests() | ~45 | ORQUESTACIÓN/LÓGICA | Coordina host + docker tests |
| install_test_dependencies() | ~15 | LÓGICA DE NEGOCIO | Instala dependencias de test |
| generate_test_reports() | ~15 | LÓGICA DE NEGOCIO | Genera reportes HTML |
| create_master_html_report() | ~40 | LÓGICA DE NEGOCIO | Crea reporte master HTML |
| show_test_summary() | ~10 | LÓGICA DE NEGOCIO | Muestra resumen de tests |
| check_database_connection() | 14 | LÓGICA DE NEGOCIO | Verifica PostgreSQL |

**Total Lógica de Negocio:** ~314 líneas (35% del archivo)

### 3. ORQUESTACIÓN (~80 líneas)

| Función | Líneas | Categoría | Descripción |
|---------|--------|-----------|-------------|
| main() | ~75 | ORQUESTACIÓN | Entry point principal |

**Total Orquestación:** ~75 líneas (8% del archivo)

### 4. UTILIDADES INTERNAS (~75 líneas)

| Función | Líneas | Categoría | Descripción |
|---------|--------|-----------|-------------|
| check_tool_availability() | ~15 | UTILIDAD | Verifica herramientas instaladas |
| setup_test_environment() | ~55 | UTILIDAD/CONFIG | Setup de entorno de test |
| validate_port_availability() | ~5 | UTILIDAD | Valida puertos (actualmente noop) |

**Total Utilidades:** ~75 líneas (8% del archivo)

### 5. INFRAESTRUCTURA (~196 líneas)

| Componente | Líneas | Descripción |
|------------|--------|-------------|
| Constantes PATH | ~10 | SCRIPT_DIR, BASE_DIR, CONFIG_DIR, etc. |
| Sources de módulos | ~12 | 11 archivos sourceados |
| Variables globales | ~32 | Flags CLI y estado |
| Comentarios/headers | ~30 | Separadores de secciones |
| Código misceláneo | ~112 | Espacios, líneas en blanco, etc. |

**Total Infraestructura:** ~196 líneas (22% del archivo)

---

## FUNCIÓNES > 40 LÍNEAS IDENTIFICADAS

| Función | Líneas | Categoría | ¿Extraer? |
|---------|--------|-----------|-----------|
| **parse_arguments()** | ~152 | CLI Parsing | NO - Es el parser principal |
| **run_host_tests()** | ~90 | Lógica de Negocio | SÍ - Candidata a scripts/pipeline/tests.sh |
| **run_docker_tests()** | ~85 | Lógica de Negocio | SÍ - Candidata a scripts/pipeline/tests.sh |
| **setup_test_environment()** | ~55 | Utilidad | SÍ - Candidata a scripts/pipeline/config.sh |
| **show_help()** | ~55 | CLI/DOC | NO - Documentación inline |
| **create_master_html_report()** | ~40 | Lógica de Negocio | SÍ - Candidata a scripts/pipeline/reports.sh |
| **run_hybrid_tests()** | ~45 | Orquestación/Lógica | SÍ - Candidata a scripts/pipeline/tests.sh |

**Total candidatos a extracción:** ~315 líneas adicionales (35% del archivo restante)

---

## BLOQUES QUE NO PERTENECEN A MAIN O CLI PARSING

### Bloque 1: TEST FUNCTIONS (líneas ~300-440)
**Líneas:** ~140 líneas
**Contenido:**
- run_host_tests()
- run_docker_tests()
- install_test_dependencies()

**Evaluación:** 
- ✅ Es lógica de negocio significativa
- ✅ Podría extraerse a scripts/pipeline/tests-host.sh y tests-docker.sh
- ⚠️ Depende de: log_*, docker exec, FORCE_REBUILD

### Bloque 2: REPORT FUNCTIONS (líneas ~535-598)
**Líneas:** ~65 líneas
**Contenido:**
- generate_test_reports()
- create_master_html_report()
- show_test_summary()

**Evaluación:**
- ✅ Es lógica de presentación/reportes
- ✅ Podría extraerse a scripts/pipeline/reports.sh
- ⚠️ Depende de: log_*, find, sed

### Bloque 3: TOOL DETECTION (líneas ~722-810)
**Líneas:** ~75 líneas
**Contenido:**
- check_tool_availability()
- setup_test_environment()

**Evaluación:**
- ✅ Es configuración/utilidades
- ✅ Podría moverse a scripts/pipeline/setup.sh o config.sh
- ⚠️ Depende de: log_*, command -v, npm, pip

---

## EVALUACIÓN: ¿ES UN ORQUESTADOR MINIMALISTA?

### VEREDICTO: **NO COMPLETAMENTE**

**Razones:**

1. **Lógica de Negocio Significativa (35%)**
   - ~315 líneas de testing, reportes y configuración
   - Idealmente debería ser <20% para ser "minimalista"

2. **Funciones de Orquestación solo 8%**
   - main() debería ser más visible (ahora es solo 75 líneas)
   - La mayoría del código son implementaciones, no coordinación

3. **Parsing CLI excesivo (27%)**
   - 152 líneas para parsear argumentos indica diseño CLI complejo
   - Podría simplificarse o externalizarse

### PROPUESTA DE REDUCCIÓN ADICIONAL

Si se extrae la sección TEST completa:
- **pipeline.sh:** 905 → 590 líneas (-35%)
- **tests.sh:** ~200 líneas (nuevo módulo)
- **reports.sh:** ~65 líneas (nuevo módulo)

**Resultado:** pipeline.sh sería ~65% orquestador, 35% CLI/Config

---

## CONCLUSIÓN

**Estado actual:** pipeline.sh contiene **demasiada lógica de negocio** para ser considerado un orquestador minimalista.

**Bloques candidatos a extracción:**
1. ✅ SECCIÓN TEST FUNCTIONS completa (~215 líneas)
2. ✅ REPORT FUNCTIONS (~65 líneas)
3. ✅ TOOL DETECTION & SETUP (~75 líneas)

**Beneficio potencial:** Reducción de ~350 líneas adicionales, dejando pipeline.sh como un verdadero orquestador de ~550 líneas.
