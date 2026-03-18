# =============================================================================
# MAPA ESTRUCTURAL — pipeline.sh
# Análisis Completo del Orquestador
# =============================================================================

## 1. ARQUITECTURA GENERAL

```
┌─────────────────────────────────────────────────────────────────┐
│                        pipeline.sh (822 líneas)                 │
├─────────────────────────────────────────────────────────────────┤
│  Capa 0: CONFIGURACIÓN (líneas 1-52)                           │
│    ├── Constantes de path (31-37)                              │
│    ├── Sources de módulos (40-51)                              │
│    └── Variables globales (57-86)                              │
├─────────────────────────────────────────────────────────────────┤
│  Capa 1: PARSING (líneas 89-243)                               │
│    └── parse_arguments() — CLI a flags                         │
├─────────────────────────────────────────────────────────────────┤
│  Capa 2: CONFIGURACIÓN (líneas 246-301)                        │
│    ├── load_config() — Setup entorno                           │
│    └── check_database_connection() — Health check              │
├─────────────────────────────────────────────────────────────────┤
│  Capa 3: TESTING (líneas 303-481)                              │
│    ├── run_host_tests() — Host mode (MVP externo)              │
│    ├── run_docker_tests() — Docker mode                        │
│    ├── install_test_dependencies() — Setup pytest              │
│    ├── generate_test_reports() — HTML reports                  │
│    ├── create_master_html_report() — Master HTML               │
│    ├── show_test_summary() — Console summary                   │
│    └── run_hybrid_tests() — Orquesta host+docker               │
├─────────────────────────────────────────────────────────────────┤
│  Capa 4: UTILIDADES (líneas 484-573)                           │
│    ├── check_tool_availability() — Validación                  │
│    ├── setup_test_environment() — Instalación                  │
│    └── validate_port_availability() — No-op actual             │
├─────────────────────────────────────────────────────────────────┤
│  Capa 5: DOCUMENTACIÓN (líneas 576-625)                        │
│    └── show_help() — CLI help                                  │
├─────────────────────────────────────────────────────────────────┤
│  Capa 6: ORQUESTACIÓN (líneas 628-822)                         │
│    └── main() — Entry point                                    │
└─────────────────────────────────────────────────────────────────┘
```

## 2. FUNCIONES — INVENTARIO COMPLETO

| # | Función | Líneas | Responsabilidad | Input | Output |
|---|---------|--------|-----------------|-------|--------|
| 1 | parse_arguments() | 152 | CLI → Flags | $@ | Variables globales |
| 2 | load_config() | 38 | Setup entorno | - | Config cargada |
| 3 | check_database_connection() | 14 | Health check BD | - | Exit 0/1 |
| 4 | run_host_tests() | 8 | Tests host (MVP) | Manifest | JSON/Exit |
| 5 | run_docker_tests() | 86 | Tests docker | - | Exit 0/1 |
| 6 | install_test_dependencies() | 15 | Instala pytest | - | Side effects |
| 7 | generate_test_reports() | 15 | Genera HTML | - | Archivos HTML |
| 8 | create_master_html_report() | 40 | Master HTML | - | master-report.html |
| 9 | show_test_summary() | 10 | Console summary | - | stdout logs |
| 10 | run_hybrid_tests() | 45 | Orquesta tests | - | Exit 0/1 |
| 11 | check_tool_availability() | 15 | Valida tools | tool name | Exit 0/1 |
| 12 | setup_test_environment() | 55 | Instala deps | - | Side effects |
| 13 | validate_port_availability() | 5 | No-op | - | - |
| 14 | show_help() | 55 | Documentación | - | stdout help |
| 15 | main() | 195 | Entry point | $@ | Exit 0/1 |

**Total líneas en funciones**: 753 (92% del archivo)  
**Total líneas infraestructura**: 69 (8% del archivo)

## 3. DEPENDENCIAS INTERNAS

### 3.1 Grafo de Llamadas (Call Graph)

```
main()
├── parse_arguments() ───────────────────────────┐
├── load_config()                                │
│   └── check_database_connection()              │
├── validate_prerequisites() [externo]           │
│   └── check_tool_availability()                │
├── run_all_lint_checks() [externo]              │
└── run_hybrid_tests() ──────────────────────────┤
    ├── run_host_tests() ────────────────────────┤
    │   └── source runner.sh [nuevo externo]     │
    ├── run_docker_tests() ──────────────────────┤
    │   └── install_test_dependencies() ─────────┤
    ├── generate_test_reports() ─────────────────┤
    │   └── create_master_html_report() ─────────┤
    └── show_test_summary() ─────────────────────┤

setup_test_environment()
└── check_tool_availability() [llamada 3 veces]

cleanup_docker_resources() [externo en cleanup.sh]
├── show_cleanup_plan()
├── confirm_cleanup_action()
├── cleanup_containers()
├── cleanup_networks()
├── cleanup_volumes()
└── cleanup_docker_images()
```

### 3.2 Dependencias de Módulos Externos

| Función | Módulo | Función externa |
|---------|--------|-----------------|
| load_config() | config.sh (lib) | validate_prerequisites() |
| run_host_tests() | runner.sh (nuevo) | run_tests() |
| run_docker_tests() | docker.sh (utils) | docker exec |
| create_master_html_report() | hash.sh (ci) | get_cache_hash() |
| main() | lint.sh (ci) | run_all_lint_checks() |
| main() | build.sh (ci) | build_all_services() |

### 3.3 Variables Globales Compartidas

```
FLAGS CLI (Escritura en parse_arguments(), Lectura en main())
├── RUN_VALIDATE → main()
├── RUN_LINT → main()
├── RUN_TEST → main(), run_hybrid_tests()
├── RUN_BUILD → main()
├── RUN_UP → main()
├── RUN_DOWN → main()
├── RUN_STATUS → main()
├── RUN_CLEANUP → main()
└── RUN_HELP → main()

FLAGS TEST (Escritura en parse_arguments(), Lectura en run_hybrid_tests())
├── RUN_TEST_HOST → run_hybrid_tests()
├── RUN_TEST_DOCKER → run_hybrid_tests()
└── RUN_TEST_SERVICE → run_hybrid_tests()

FLAGS CLEANUP (Escritura en parse_arguments(), Lectura en cleanup_*.sh)
├── CLEANUP_CONTAINERS → cleanup_containers()
├── CLEANUP_NETWORKS → cleanup_networks()
├── CLEANUP_VOLUMES → cleanup_volumes()
├── CLEANUP_IMAGES → cleanup_docker_images()
└── CLEANUP_FORCE → confirm_cleanup_action()

ESTADO (Escritura/Lectura en main())
├── PIPELINE_START_TIME → main(), show_test_summary()
└── OPERATION_SUCCESS → main() [acumulador de fallos]
```

## 4. ORDEN DE EJECUCIÓN

### 4.1 Flujo Principal (main)

```
1. parse_arguments("$@")        # Parseo CLI
2. load_config()                # Setup
   2.1 check_database_connection()
3. DECISIÓN: ¿RUN_DEFAULT_PIPELINE?
   ├── true:
   │   3.1 start_services()
   │   3.2 wait_for_services_ready()
   │   3.3 run_all_lint_checks()
   │   3.4 run_hybrid_tests()
   │   3.5 build_all_services()
   └── false:
       3.6 Ejecutar flags específicos
4. SUMMARY → show_test_summary() / log_success_banner()
5. exit $EXIT_CODE
```

### 4.2 Flujo Testing (run_hybrid_tests)

```
run_hybrid_tests()
├── IF RUN_TEST_HOST or RUN_TEST:
│   └── run_host_tests()        # MVP: source runner.sh
├── IF RUN_TEST_DOCKER or RUN_TEST:
│   └── run_docker_tests()
│       └── install_test_dependencies()
├── generate_test_reports()
│   └── create_master_html_report()
└── show_test_summary()
```

### 4.3 Secuencia de Inicialización

```
Orden de sources (líneas 40-51):
1. logging.sh        → log_*() disponibles
2. docker.sh         → get_compose_cmd(), safe_cd()
3. path.sh           → safe_cd() [redefinición]
4. parallel.sh       → parallel_exec()
5. config.sh (lib)   → validate_prerequisites()
6. service.sh (lib)  → generate_env_file()
7. hash.sh (ci)      → generate_hash(), get_cache_hash()
8. lint.sh (ci)      → run_all_lint_checks()
9. build.sh (ci)     → build_all_services()
10. resources.sh     → PROJECT_CONTAINERS, NETWORKS, VOLUMES
11. cleanup.sh       → cleanup_docker_resources()
12. services.sh      → start_services(), stop_services()
```

## 5. PRODUCCIÓN DE OUTPUTS

### 5.1 stdout (Interactivo)

| Función | Tipo | Contenido |
|---------|------|-----------|
| show_help() | Texto | Documentación CLI |
| show_test_summary() | Texto | Tabla resumen tests |
| run_tests() [externo] | JSON | Resultados estructurados |

### 5.2 stderr (Logs)

Todas las funciones usan funciones de logging.sh:
- `log_info()` → ℹ️ (stdout con color)
- `log_success()` → ✅ (stdout con color)
- `log_error()` → ❌ (stderr con color)
- `log_warning()` → ⚠️ (stderr con color)
- `log_debug()` → [DEBUG] (stderr condicional)
- `log_banner()` → === BANNER === (stdout)
- `log_section()` → === Section === (stdout)

### 5.3 Archivos Generados

| Función | Archivo | Tipo |
|---------|---------|------|
| create_master_html_report() | test-results/master-report.html | HTML |
| generate_test_reports() | test-results/services/*.html | HTML |
| load_config() | .env.ci | Config (si no existe) |

## 6. SISTEMA DE INDEXACIÓN LIGERA

### 6.1 Propuesta: Índice YAML

```yaml
# pipeline.index.yaml
schema_version: "1.0"
file: pipeline.sh
lines: 822
type: orquestador

sources:
  - name: logging
    path: scripts/utils/logging.sh
    provides: [log_info, log_success, log_error, log_warning, log_debug, log_banner]
  - name: docker
    path: scripts/utils/docker.sh
    provides: [get_compose_cmd, safe_cd]
  - name: path
    path: scripts/utils/path.sh
    provides: [safe_cd, ensure_dir]
  - name: parallel
    path: scripts/utils/parallel.sh
    provides: [parallel_exec, parallel_with_limit]
  - name: config_lib
    path: scripts/pipeline/lib/config.sh
    provides: [validate_prerequisites]
  - name: service_lib
    path: scripts/pipeline/lib/service.sh
    provides: [generate_env_file]
  - name: hash
    path: scripts/ci/hash.sh
    provides: [generate_hash, get_cache_hash]
  - name: lint
    path: scripts/ci/lint.sh
    provides: [run_all_lint_checks]
  - name: build
    path: scripts/ci/build.sh
    provides: [build_all_services]
  - name: resources
    path: scripts/pipeline/resources.sh
    provides: [PROJECT_CONTAINERS, PROJECT_NETWORKS, PROJECT_VOLUMES]
  - name: cleanup
    path: scripts/pipeline/cleanup.sh
    provides: [cleanup_docker_resources]
  - name: services
    path: scripts/pipeline/services.sh
    provides: [start_services, stop_services, show_services_status]
  - name: runner
    path: scripts/testing/runner.sh
    provides: [run_tests]

functions:
  - name: parse_arguments
    line: 92
    lines: 152
    params: ["$@"]
    writes: [RUN_VALIDATE, RUN_LINT, RUN_TEST, RUN_BUILD, RUN_UP, RUN_DOWN, FORCE_REBUILD, RUN_STATUS, RUN_HELP, RUN_CLEANUP, FORCE_BUILD, VERBOSE, RUN_TEST_HOST, RUN_TEST_DOCKER, RUN_TEST_SERVICE, RUN_TEST_PARALLEL, CLEANUP_CONTAINERS, CLEANUP_NETWORKS, CLEANUP_VOLUMES, CLEANUP_IMAGES, CLEANUP_FORCE, RUN_DEFAULT_PIPELINE]
    outputs: [side_effects]
    
  - name: load_config
    line: 246
    lines: 38
    params: []
    calls: [check_database_connection]
    writes: []
    outputs: [logs]
    
  - name: check_database_connection
    line: 288
    lines: 14
    params: []
    outputs: [exit_code]
    
  - name: run_host_tests
    line: 303
    lines: 8
    params: []
    calls: [run_tests --manifest]
    sources: [runner]
    outputs: [JSON, exit_code]
    
  - name: run_docker_tests
    line: 395
    lines: 86
    params: []
    calls: [install_test_dependencies, docker exec, log_test_result]
    outputs: [logs, exit_code]
    
  - name: install_test_dependencies
    line: 483
    lines: 15
    params: []
    calls: [docker exec pip install]
    outputs: [side_effects]
    
  - name: generate_test_reports
    line: 499
    lines: 15
    params: []
    calls: [create_master_html_report]
    outputs: [files]
    
  - name: create_master_html_report
    line: 515
    lines: 40
    params: []
    calls: [get_cache_hash, find, sed]
    outputs: [test-results/master-report.html]
    
  - name: show_test_summary
    line: 556
    lines: 10
    params: []
    outputs: [stdout logs]
    
  - name: run_hybrid_tests
    line: 568
    lines: 45
    params: []
    calls: [run_host_tests, run_docker_tests, generate_test_reports, show_test_summary]
    outputs: [exit_code]
    
  - name: check_tool_availability
    line: 615
    lines: 15
    params: [tool, description]
    outputs: [exit_code, logs]
    
  - name: setup_test_environment
    line: 632
    lines: 55
    params: []
    calls: [check_tool_availability x3, npm install, pip install]
    outputs: [side_effects]
    
  - name: validate_port_availability
    line: 689
    lines: 5
    params: []
    outputs: [noop]
    
  - name: show_help
    line: 696
    lines: 55
    params: []
    outputs: [stdout help]
    
  - name: main
    line: 753
    lines: 195
    params: ["$@"]
    calls: [parse_arguments, show_help, load_config, validate_prerequisites, run_all_lint_checks, run_hybrid_tests, build_all_services, start_services, wait_for_services_ready, stop_services, show_services_status, cleanup_docker_resources]
    outputs: [exit_code, logs]

globals:
  flags:
    - RUN_VALIDATE: bool, default=false, set_by=parse_arguments
    - RUN_LINT: bool, default=false, set_by=parse_arguments
    - RUN_TEST: bool, default=false, set_by=parse_arguments
    - RUN_BUILD: bool, default=false, set_by=parse_arguments
    - RUN_UP: bool, default=false, set_by=parse_arguments
    - RUN_DOWN: bool, default=false, set_by=parse_arguments
    - FORCE_REBUILD: bool, default=false, set_by=parse_arguments
    - RUN_STATUS: bool, default=false, set_by=parse_arguments
    - RUN_HELP: bool, default=false, set_by=parse_arguments
    - RUN_CLEANUP: bool, default=false, set_by=parse_arguments
    - FORCE_BUILD: bool, default=false, set_by=parse_arguments
    - VERBOSE: bool, default=false, set_by=parse_arguments
    - RUN_TEST_HOST: bool, default=false, set_by=parse_arguments
    - RUN_TEST_DOCKER: bool, default=false, set_by=parse_arguments
    - RUN_TEST_SERVICE: string, default="", set_by=parse_arguments
    - RUN_TEST_PARALLEL: bool, default=false, set_by=parse_arguments
    - CLEANUP_CONTAINERS: bool, default=true, set_by=parse_arguments
    - CLEANUP_NETWORKS: bool, default=true, set_by=parse_arguments
    - CLEANUP_VOLUMES: bool, default=false, set_by=parse_arguments
    - CLEANUP_IMAGES: bool, default=false, set_by=parse_arguments
    - CLEANUP_FORCE: bool, default=false, set_by=parse_arguments
    - RUN_DEFAULT_PIPELINE: bool, default=false, set_by=parse_arguments
    
  state:
    - PIPELINE_START_TIME: epoch, set_by=main
    - OPERATION_SUCCESS: bool, default=true, set_by=main

artifacts:
  generated:
    - test-results/master-report.html
    - test-results/services/*.html
    - .env.ci
  read:
    - config/test-manifest.json
    - config/ports.json
    - config/services.json
    - infra/local/docker-compose.yml
```

### 6.2 Uso del Índice

```bash
# Consultar qué función hace qué
yq '.functions[] | select(.name == "run_host_tests")' pipeline.index.yaml

# Saber qué archivos impacta una función
yq '.functions[] | select(.name == "run_host_tests") | .sources' pipeline.index.yaml

# Saber qué produce
yq '.functions[] | select(.name == "run_host_tests") | .outputs' pipeline.index.yaml

# Listar todas las funciones con más de 50 líneas
yq '.functions[] | select(.lines > 50) | .name' pipeline.index.yaml

# Encontrar funciones que escriben una variable global
yq '.functions[] | select(.writes | contains(["RUN_TEST"])) | .name' pipeline.index.yaml
```

## 7. MODO "AGENT" — DISEÑO CONCEPTUAL

### 7.1 Problema Actual

**pipeline.sh** intenta ser todo:
- Parser de CLI
- Orquestador de fases
- Implementador de lógica de testing
- Generador de reportes
- Gestor de Docker

**Resultado**: 822 líneas, acoplamiento alto, dificil de mantener

### 7.2 Propuesta: Separación de Responsabilidades

```
ANTES (Monolito):
┌─────────────────────────────────────┐
│        pipeline.sh (822 líneas)     │
│  ├─ CLI parsing                     │
│  ├─ Config loading                  │
│  ├─ Testing logic                   │
│  ├─ Report generation               │
│  └─ Docker management               │
└─────────────────────────────────────┘

DESPUÉS (Agent Mode):
┌─────────────────────────────────────┐
│     pipeline.sh (250 líneas)        │
│  ├─ CLI parsing                     │
│  ├─ Decision engine                 │
│  └─ Execution coordinator           │
└─────────────────────────────────────┘
         │
         ├─► scripts/agents/lint-agent.sh
         ├─► scripts/agents/test-agent.sh
         ├─► scripts/agents/build-agent.sh
         └─► scripts/agents/deploy-agent.sh
```

### 7.3 Qué Cambia

**pipeline.sh se convierte en**:
- **Parser CLI**: Mantiene parse_arguments()
- **Decision Engine**: Decide qué agentes ejecutar basado en flags
- **Coordinator**: Orquesta ejecución secuencial de agentes
- **State Manager**: Mantiene OPERATION_SUCCESS global

**Cada Agente es**:
- Script independiente (100-200 líneas)
- Input: JSON de configuración
- Output: JSON de resultados
- Sin variables globales
- Testeable individualmente

### 7.4 Qué Se Elimina de pipeline.sh

**Se elimina (mueve a agentes)**:
- ❌ run_host_tests() → test-agent.sh
- ❌ run_docker_tests() → test-agent.sh --mode=docker
- ❌ run_hybrid_tests() → pipeline.sh orquesta 2 llamadas
- ❌ install_test_dependencies() → test-agent.sh --setup
- ❌ generate_test_reports() → test-agent.sh --report
- ❌ create_master_html_report() → report-agent.sh
- ❌ setup_test_environment() → setup-agent.sh
- ❌ validate_port_availability() → validate-agent.sh

**Se mantiene en pipeline.sh**:
- ✅ parse_arguments() — CLI parsing
- ✅ main() — Orquestación
- ✅ Carga de sources (simplificada)
- ✅ Variables globales básicas

### 7.5 Qué Se Estructura

**Nueva estructura de directorios**:
```
scripts/
├── agents/
│   ├── lint-agent.sh           # 150 líneas
│   ├── test-agent.sh           # 200 líneas (reemplaza run_*_tests)
│   ├── build-agent.sh          # 150 líneas
│   ├── deploy-agent.sh         # 100 líneas
│   └── report-agent.sh         # 80 líneas
├── coordinators/
│   └── pipeline.sh             # 250 líneas (actual)
└── shared/
    ├── logging.sh              # Ya existe
    ├── docker.sh               # Ya existe
    └── manifest-parser.sh      # Nuevo
```

**Nuevo flujo de datos**:
```
1. pipeline.sh parsea CLI
2. pipeline.sh carga config/manifest.json
3. pipeline.sh decide: ["lint", "test", "build"]
4. Por cada paso:
   a. Ejecutar scripts/agents/<paso>-agent.sh --config=manifest.json
   b. Capturar JSON de salida
   c. Actualizar estado global
5. pipeline.sh genera reporte final
6. Exit code basado en estado global
```

### 7.6 Contrato de Agente

```yaml
# Cada agente sigue este contrato:

input:
  stdin: null
  args:
    - --config=<path>       # Ruta a manifest.json
    - --mode=<mode>         # Opcional: host|docker
    - --output=<format>     # Opcional: json|console
    
output:
  stdout: JSON estructurado
  stderr: Logs humanos
  exit_code: 0|1|2
  
json_schema:
  type: object
  required: [agent, status, duration_ms]
  properties:
    agent: string          # Nombre del agente
    status: enum           # success|failure|skipped
    duration_ms: integer
    results: object        # Datos específicos del agente
    error:                 # Solo si status=failure
      message: string
      code: string
```

### 7.7 Ventajas del Modo Agent

1. **Testeabilidad**: Cada agente se prueba individualmente
2. **Escalabilidad**: Nuevo agente = nuevo archivo (no tocar pipeline.sh)
3. **Mantenibilidad**: 250 líneas vs 822 líneas
4. **Reusabilidad**: Agentes se usan fuera del pipeline
5. **Debuggabilidad**: Ejecutar agente aislado para debug
6. **Paralelismo**: Agents pueden ejecutarse en paralelo fácilmente

### 7.8 Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Fragmentación | Difícil seguir flujo | Documentación + índice YAML |
| Overhead | Múltiples procesos | Usar source en lugar de exec |
| Estado compartido | Race conditions | Inmutabilidad del manifest |
| Breaking changes | Scripts externos | Versionado de contrato |

---

## 8. CONCLUSIÓN

**Estado actual**: pipeline.sh es un monolito de 822 líneas con múltiples responsabilidades.

**Propuesta Agent Mode**: Separar en coordinador (250 líneas) + agentes especializados (100-200 líneas cada uno).

**MVP actual**: Ya da un paso en esta dirección al externalizar `run_host_tests()` a `runner.sh`.

**Próximo paso recomendado**: Migrar `run_docker_tests()` a test-agent.sh siguiendo el mismo patrón.

**Sin implementar aún**: Esperando aprobación explícita del usuario.
