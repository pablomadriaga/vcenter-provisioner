#!/usr/bin/env bash
# =============================================================================
# pipeline.sh - Estructura actual post-refactor
# =============================================================================
# Este script ahora es un ORQUESTADOR minimalista que coordina módulos
# =============================================================================

# CONSTANTES Y CONFIGURACIÓN (líneas 31-48)
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly BASE_DIR="$SCRIPT_DIR"
readonly CONFIG_DIR="$BASE_DIR/config"
readonly COMPOSE_FILE="$BASE_DIR/infra/local/docker-compose.yml"
readonly ENV_FILE="$BASE_DIR/.env.ci"
readonly PORTS_FILE="$CONFIG_DIR/ports.json"
readonly SERVICES_FILE="$CONFIG_DIR/services.json"

# SOURCES DE MÓDULOS (líneas 40-51)
# - logging.sh, docker.sh, path.sh, parallel.sh (utils)
# - config.sh, service.sh (pipeline/lib)
# - hash.sh, lint.sh, build.sh (ci)
# - resources.sh, cleanup.sh, services.sh (pipeline)

# VARIABLES GLOBALES (líneas 53-83)
# - Flags CLI (RUN_VALIDATE, RUN_LINT, etc.)
# - Flags de test (RUN_TEST_HOST, RUN_TEST_DOCKER, etc.)
# - Flags de cleanup (CLEANUP_CONTAINERS, CLEANUP_NETWORKS, etc.)
# - Estado (PIPELINE_START_TIME, OPERATION_SUCCESS, RUN_DEFAULT_PIPELINE)

# =============================================================================
# FUNCIÓN: parse_arguments() (líneas 89-240)
# Categoría: PARSING CLI
# Descripción: Parsea argumentos de línea de comandos
# Complejidad: ~150 líneas
# =============================================================================

# =============================================================================
# FUNCIÓN: load_config() (líneas 246-283)
# Categoría: CONFIGURACIÓN / ORQUESTACIÓN
# Descripción: Carga configuración y verifica conexión a BD
# Complejidad: ~38 líneas
# =============================================================================

# =============================================================================
# FUNCIÓN: check_database_connection() (líneas 285-298)
# Categoría: LÓGICA DE NEGOCIO (podría moverse a services.sh)
# Descripción: Verifica conexión a PostgreSQL
# Complejidad: ~14 líneas
# =============================================================================

# =============================================================================
# SECCIÓN: TEST FUNCTIONS
# Categoría: LÓGICA DE NEGOCIO SIGNIFICATIVA
# =============================================================================
# - run_host_tests() (~90 líneas)
# - run_docker_tests() (~85 líneas)
# - install_test_dependencies() (~15 líneas)
# - generate_test_reports() (~15 líneas)
# - create_master_html_report() (~40 líneas)
# - show_test_summary() (~10 líneas)
# - run_hybrid_tests() (~45 líneas)
# TOTAL: ~300 líneas de lógica de testing
# =============================================================================

# =============================================================================
# SECCIÓN: TOOL DETECTION & SETUP
# Categoría: UTILIDADES / CONFIGURACIÓN
# =============================================================================
# - check_tool_availability() (~15 líneas)
# - setup_test_environment() (~55 líneas)
# - validate_port_availability() (~5 líneas)
# TOTAL: ~75 líneas
# =============================================================================

# =============================================================================
# FUNCIÓN: show_help() (líneas ~1000-1050)
# Categoría: PARSING CLI / DOCUMENTACIÓN
# Descripción: Muestra ayuda
# Complejidad: ~50 líneas
# =============================================================================

# =============================================================================
# FUNCIÓN: main() (líneas ~1055-1130)
# Categoría: ORQUESTACIÓN
# Descripción: Orquesta todo el pipeline
# Complejidad: ~75 líneas
# =============================================================================

# RESUMEN ESTRUCTURAL:
# ===================
# Total de líneas en pipeline.sh: ~905
# 
# Distribución por categoría:
# - ORQUESTACIÓN: ~115 líneas (main, load_config)
# - PARSING CLI: ~200 líneas (parse_arguments, show_help)
# - LÓGICA DE NEGOCIO: ~375 líneas (tests, database)
# - UTILIDADES: ~75 líneas (tool detection, port validation)
# - CONSTANTES/SOURCES/VARIABLES: ~140 líneas
#
# Funciones > 40 líneas identificadas:
# 1. parse_arguments() - ~150 líneas (CLI)
# 2. run_host_tests() - ~90 líneas (LÓGICA)
# 3. run_docker_tests() - ~85 líneas (LÓGICA)
# 4. run_hybrid_tests() - ~45 líneas (LÓGICA)
# 5. setup_test_environment() - ~55 líneas (UTILIDAD)
# 6. create_master_html_report() - ~40 líneas (LÓGICA)
# 7. show_help() - ~50 líneas (CLI/DOC)
#
# Bloques candidatos a extracción (no main ni CLI):
# - SECCIÓN TEST FUNCTIONS completa (~300 líneas)
# - check_database_connection() (~14 líneas)
# - setup_test_environment() (~55 líneas)
# - validate_port_availability() (~5 líneas)
