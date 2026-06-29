# PROPUESTA: Arquitectura de Testing v2 — vCenter Provisioner
# Version: 2.0
# Estado: Propuesta (No implementada)
# Objetivo: Reemplazar run_*_tests() con sistema generico basado en manifiesto

## 1. DIAGRAMA LOGICO (Texto)

```
+-------------------------------------------------------------+
|                    pipeline.sh (Orquestador)                |
|                    Responsabilidad:                         |
|             Parsear CLI → Decidir modo → Ejecutar          |
+-------------------------------------------------------------+
                          |
                          | source
                          v
+-------------------------------------------------------------+
|               scripts/testing/framework.sh                  |
|  +-----------+  +-----------+  +-----------+  +-----------+ |
|  |  log_test |  |assert_eq  |  |capture_time|  |report_json| |
|  | log_suite |  |assert_true|  |  timeout   |  |report_cons| |
|  +-----------+  +-----------+  +-----------+  +-----------+ |
+-------------------------------------------------------------+
                          |
                          | source
                          v
+-------------------------------------------------------------+
|                  scripts/testing/runner.sh                  |
|                  (CONTRATO ESTRICTO)                        |
|                                                              |
|  +-------------------------------------------------------+  |
|  |                      run_tests()                       |  |
|  |  Input:  --manifest=config/test-manifest.json         |  |
|  |          --mode=host|docker|all                       |  |
|  |          --output=json|console                        |  |
|  |          --parallel=true|false                        |  |
|  |  Output: JSON estructurado (stdout)                   |  |
|  |          Exit code: 0 (todos pasaron) | 1 (fallo)     |  |
|  +-------------------------------------------------------+  |
+-------------------------------------------------------------+
                          |
                          | Lee
                          v
+-------------------------------------------------------------+
|                   config/test-manifest.json                 |
|                                                              |
|  {                                                           |
|    "version": "2.0",                                         |
|    "suites": [                                               |
|      {                                                       |
|        "name": "auth-service",                               |
|        "path": "apps/auth-service",                          |
|        "type": "nodejs",                                     |
|        "test_command": "npm test",                           |
|        "patterns": ["**/*.test.ts", "**/*.spec.ts"],         |
|        "docker": {                                           |
|          "container": "provisioner-auth",                    |
|          "enabled": true                                     |
|        },                                                    |
|        "host": {                                             |
|          "enabled": true,                                    |
|          "requires": ["npm", "node"]                         |
|        }                                                     |
|      },                                                      |
|      {                                                       |
|        "name": "typing-service",                             |
|        "path": "apps/typing-service",                        |
|        "type": "python",                                     |
|        "test_command": "python -m pytest app/ -v",          |
|        "patterns": ["**/test_*.py"],                         |
|        "docker": {                                           |
|          "container": "provisioner-typing",                  |
|          "enabled": true,                                    |
|          "dependencies": ["pytest-html", "pytest-junitxml"]  |
|        }                                                     |
|      },                                                      |
|      {                                                       |
|        "name": "monitoring-service",                         |
|        "path": "apps/monitoring-service",                    |
|        "type": "go",                                         |
|        "test_command": "go test ./...",                     |
|        "patterns": ["**/*_test.go"],                         |
|        "docker": {                                           |
|          "enabled": false                                    |
|        }                                                     |
|      }                                                       |
|    ],                                                        |
|    "performance_tests": {                                    |
|      "enabled": false,                                       |
|      "path": "perf-tests",                                   |
|      "command": "k6 run"                                     |
|    },                                                        |
|    "infrastructure_tests": {                                 |
|      "enabled": false,                                       |
|      "path": "tests/pipeline.test.sh"                        |
|    }                                                         |
|  }                                                           |
|                                                              |
+-------------------------------------------------------------+
                          |
                          | Ejecuta
                          v
+-------------------------------------------------------------+
|                 Salida Estructurada JSON                    |
|                                                              |
|  {                                                           |
|    "timestamp": "2026-02-13T10:00:00Z",                     |
|    "duration_ms": 45230,                                     |
|    "summary": {                                              |
|      "total": 12,                                            |
|      "passed": 10,                                           |
|      "failed": 1,                                            |
|      "skipped": 1                                            |
|    },                                                        |
|    "suites": [                                               |
|      {                                                       |
|        "name": "auth-service",                               |
|        "type": "nodejs",                                     |
|        "mode": "host",                                       |
|        "status": "passed",                                   |
|        "duration_ms": 2340,                                  |
|        "tests": [                                            |
|          { "name": "auth.test.ts", "status": "passed",       |
|            "duration_ms": 800 }                              |
|        ]                                                     |
|      }                                                       |
|    ]                                                         |
|  }                                                           |
+-------------------------------------------------------------+
```

## 2. CONTRATO DEL RUNNER

### 2.1 Interfaz de Linea de Comandos

Uso obligatorio:
  run_tests --manifest=<path> --mode=<mode> [opciones]

Parametros requeridos:
  --manifest <path>     Ruta a test-manifest.json
  --mode <mode>         host | docker | all

Parametros opcionales:
  --output <format>     json (default) | console | junit
  --parallel <bool>     true | false (default: false)
  --filter <pattern>    Regex para filtrar suites
  --timeout <seconds>   Timeout por suite (default: 300)
  --verbose             Modo debug

Exit codes:
  0   Todos los tests pasaron
  1   Al menos un test fallo
  2   Error de configuracion (manifest invalido)
  3   Timeout
  4   Error del sistema (docker no disponible, etc.)

### 2.2 Formato de Salida JSON (Especificacion)

Interface TestResult:
  timestamp: string         ISO 8601
  duration_ms: number       Tiempo total
  version: "2.0"
  summary:
    total: number           Total de suites ejecutadas
    passed: number
    failed: number
    skipped: number
  suites: TestSuite[]

Interface TestSuite:
  name: string              Identificador unico
  type: "nodejs" | "python" | "go" | "custom"
  mode: "host" | "docker"
  status: "passed" | "failed" | "skipped" | "error"
  duration_ms: number
  path: string              Ruta relativa al proyecto
  tests: IndividualTest[]   Opcional
  error:                    Solo en caso de error
    message: string
    code: string
    output: string          stderr limitado a 1000 chars

Interface IndividualTest:
  name: string
  status: "passed" | "failed" | "skipped"
  duration_ms: number
  error_message: string

### 2.3 Comportamiento Garantizado

1. Deterministico: Mismo input → mismo output
2. Idempotente: Ejecutar 2 veces no cambia estado
3. Aislado: Tests docker no afectan host y viceversa
4. Time-bounded: Respeta timeouts
5. Parseable: Salida JSON valida garantizada

## 3. RESPONSABILIDADES EXACTAS DE pipeline.sh

### 3.1 Responsabilidades CONSERVADAS (Sin cambio)

Funcion                  Responsabilidad              Lineas
-------------------------------------------------------------
parse_arguments()        Parseo CLI, flags           152
show_help()              Documentacion               55
main()                   Orquestacion                75
load_config()            Setup inicial               38
Variables globales       Flags y estado              32

Total conservado: ~352 lineas

### 3.2 Responsabilidades MODIFICADAS (Delegadas)

Funcion Actual           Nueva Responsabilidad       Reduccion
-----------------------------------------------------------------
run_host_tests()         Llamar runner --mode=host   -90 lineas
run_docker_tests()       Llamar runner --mode=docker -85 lineas
run_hybrid_tests()       Llamar runner --mode=all    -45 lineas
install_test_deps()      Delegado al runner          -15 lineas
generate_test_reports()  Procesar JSON               -15 lineas
create_master_html()     Opcional: plantilla         -40 lineas

Total reducido: ~290 lineas

### 3.3 Nuevas Responsabilidades (Anadidas)

Funcion                       Descripcion                 Lineas
------------------------------------------------------------------
validate_manifest()           Validar test-manifest.json  +20 lineas
select_test_mode()            Decidir host/docker/all     +15 lineas
process_test_results()        Parsear JSON                +25 lineas

Total anadido: ~60 lineas

### 3.4 Balance Final

pipeline.sh actual:           905 lineas
  Eliminado (testing):       -290 lineas
  Anadido (orquestacion):     +60 lineas
  pipeline.sh v2:             675 lineas (-25%)

Nuevos archivos:
  scripts/testing/runner.sh        ~200 lineas
  scripts/testing/framework.sh     ~100 lineas
  config/test-manifest.json        ~80 lineas
  Total nuevo:                     ~380 lineas

## 4. PLAN DE MIGRACION INCREMENTAL

### Fase 0: Preparacion (Sin cambios en pipeline.sh)

Objetivo: Preparar terreno sin afectar comportamiento

Paso | Accion                                    | Verificacion
-----|-------------------------------------------|---------------------------
0.1  | Crear config/test-manifest.json           | Validar JSON
0.2  | Crear scripts/testing/framework.sh        | Testear funciones
0.3  | Crear scripts/testing/runner.sh (stub)    | Solo estructura
0.4  | Tests de compatibilidad                   | Carga sin errores

Duracion: 1 sprint
Riesgo: Ninguno

### Fase 1: Runner Host Mode

Objetivo: Reemplazar run_host_tests() con llamada al runner

Antes (pipeline.sh v1):
  run_host_tests() {
      # ~90 lineas de logica hardcodeada
  }

Despues (pipeline.sh v2):
  run_host_tests() {
      source "$BASE_DIR/scripts/testing/runner.sh"
      run_tests --manifest="$BASE_DIR/config/test-manifest.json" \
                --mode=host \
                --output=json
      return $?  # Propagar exit code
  }

Paso | Accion                             | Rollback
-----|------------------------------------|------------------------
1.1  | Implementar runner --mode=host     | Restaurar funcion
1.2  | Feature flag: USE_NEW_RUNNER=false | Cambiar a false
1.3  | Tests en staging                   | Revertir commit
1.4  | USE_NEW_RUNNER=true en dev         | Cambiar variable
1.5  | Monitoreo 1 semana                 | Revertir si fallos
1.6  | Produccion                         | Revertir commit

Duracion: 2 sprints
Riesgo: Medio
Mitigacion: Feature flag + rollback

### Fase 2: Runner Docker Mode

Objetivo: Reemplazar run_docker_tests()

Paso | Accion                             | Verificacion
-----|------------------------------------|---------------------------
2.1  | Extender runner con modo docker    | Tests funcionan
2.2  | Paralelismo host | docker          | Ambos coexisten
2.3  | Validar salida JSON                | Mismo formato
2.4  | Feature flag USE_NEW_DOCKER        | Variable
2.5  | Rollout gradual 10→50→100%         | Estadisticas

Duracion: 2 sprints
Riesgo: Medio-Alto (docker critico)

### Fase 3: Hybrid Mode y Reportes

Objetivo: Reemplazar run_hybrid_tests()

Nueva version:
  run_hybrid_tests() {
      run_tests --mode=all --output=json > "$RESULTS_FILE"
      generate_report_from_json "$RESULTS_FILE"
  }

Paso | Accion                             | Beneficio
-----|------------------------------------|---------------------------
3.1  | Unificar host + docker             | Elimina duplicacion
3.2  | Implementar --output=junit         | Integracion CI/CD
3.3  | Reportes HTML desde JSON           | Plantilla customizable
3.4  | Eliminar funciones viejas          | -215 lineas

Duracion: 1 sprint
Riesgo: Bajo

### Fase 4: Integraciones Opcionales

4.1 Performance Tests:

// test-manifest.json
{
  "performance_tests": {
    "enabled": true,
    "suites": [
      {
        "name": "auth-load",
        "file": "perf-tests/auth-load-test.js",
        "tool": "k6",
        "triggers": ["pre-release", "nightly"]
      }
    ]
  }
}

CLI: ./pipeline.sh --test --perf  # Nueva flag

4.2 Infrastructure Tests:

Opcion A: Wrapper
  scripts/testing/infra-runner.sh  # Llama a tests/pipeline.test.sh

Opcion B: Unificacion
  Mover tests/pipeline.test.sh a scripts/testing/

### Fase 5: Deprecacion y Limpieza

Paso | Accion                             | Resultado
-----|------------------------------------|---------------------------
5.1  | Eliminar funciones viejas          | -215 lineas
5.2  | Eliminar feature flags             | Codigo limpio
5.3  | Actualizar documentacion           | README, docs/
5.4  | Archivar analisis                  | Retrospectiva

## 5. SCHEMA DE test-manifest.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Test Manifest v2",
  "type": "object",
  "required": ["version", "suites"],
  "properties": {
    "version": {
      "type": "string",
      "enum": ["2.0"]
    },
    "suites": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/suite"
      }
    },
    "performance_tests": {
      "$ref": "#/definitions/performance"
    },
    "infrastructure_tests": {
      "$ref": "#/definitions/infrastructure"
    }
  },
  "definitions": {
    "suite": {
      "type": "object",
      "required": ["name", "path", "type"],
      "properties": {
        "name": { "type": "string" },
        "path": { "type": "string" },
        "type": { 
          "type": "string",
          "enum": ["nodejs", "python", "go", "custom"]
        },
        "test_command": { "type": "string" },
        "patterns": {
          "type": "array",
          "items": { "type": "string" }
        },
        "host": {
          "type": "object",
          "properties": {
            "enabled": { "type": "boolean" },
            "requires": {
              "type": "array",
              "items": { "type": "string" }
            }
          }
        },
        "docker": {
          "type": "object",
          "properties": {
            "enabled": { "type": "boolean" },
            "container": { "type": "string" },
            "dependencies": {
              "type": "array",
              "items": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

## 6. CHECKLIST DE VALIDACION

Antes de cada fase:
- [ ] Tests existentes pasan con runner nuevo
- [ ] Salida JSON valida segun schema
- [ ] Exit codes correctos
- [ ] Tiempos de ejecucion <= 110% de version anterior
- [ ] Logs visibles identicos (o mejorados)
- [ ] Documentacion actualizada
- [ ] Rollback plan documentado

Metricas de exito:
  Metrica                  Objetivo      Medicion
  --------------------------------------------------
  Cobertura de tests       >= actual     runner vs pipeline
  Tiempo de ejecucion      <= 110%       CI/CD metrics
  Lineas de pipeline.sh    -25%          wc -l
  Mantenibilidad           Mejorada      Tiempo para nuevo servicio
  Bugs                     0 criticos    Issues

## 7. EJEMPLO DE USO FINAL

Usuario ejecuta:

  # Caso 1: Flujo actual (sin cambios visibles)
  ./pipeline.sh --test

  # Caso 2: Solo tests en host
  ./pipeline.sh --test-host

  # Caso 3: Solo tests en docker
  ./pipeline.sh --test-docker

  # Caso 4: Tests + Performance (nuevo)
  ./pipeline.sh --test --perf

  # Caso 5: Salida JSON estructurada (para CI/CD)
  ./pipeline.sh --test --output=json > results.json

  # Caso 6: Infra tests (opcional)
  ./pipeline.sh --test-infra

Internamente (pipeline.sh v2):

  main() {
      parse_arguments "$@"
      # ... setup ...
      
      if [[ "$RUN_TEST" == true ]]; then
          source "$BASE_DIR/scripts/testing/runner.sh"
          
          local mode="all"
          [[ "$RUN_TEST_HOST" == true ]] && mode="host"
          [[ "$RUN_TEST_DOCKER" == true ]] && mode="docker"
          
          run_tests \
              --manifest="$BASE_DIR/config/test-manifest.json" \
              --mode="$mode" \
              --output="json" \
              --parallel="$RUN_TEST_PARALLEL"
          
          local exit_code=$?
          [[ $exit_code -ne 0 ]] && OPERATION_SUCCESS=false
      fi
      # ... resto ...
  }

## 8. DECISIONES DE DISENO

Por que JSON para el manifiesto?
  Parseable por bash (jq) y cualquier lenguaje
  Schema validable
  Facil de generar automaticamente
  Estandar de la industria

Por que separar framework.sh de runner.sh?
  Reutilizacion
  Testing unitario del framework
  Separacion de concerns

Por que no usar tests/pipeline.test.sh como base?
  Es mas limpio que run_*_tests()
  Pero usa framework propio
  Dificil integrar con JSON estructurada
  Mejor mantener como infra tests separados

Por que feature flags en vez de branch?
  Rollback instantaneo
  Comparacion A/B en produccion
  Menor riesgo

## 9. CONCLUSION

Esta propuesta permite:

1. Reducir pipeline.sh en 25% (905 → 675 lineas)
2. Eliminar duplicacion (72% del codigo de testing)
3. Anadir servicios sin tocar codigo (solo editar JSON)
4. Integrar performance tests (opcional)
5. Mantener compatibilidad (migracion incremental)
6. Mejorar mantenibilidad

NO PROCEDER sin aprobacion explicita.
