#!/usr/bin/env bash
# =============================================================================
# pipeline.test.sh - Test runner ligero para pipeline.sh
# =============================================================================
# Uso: ./tests/pipeline.test.sh
# =============================================================================

set -uo pipefail

# Colores para tests
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Contadores
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# =============================================================================
# Test Framework Ligeras
# =============================================================================

pass() {
    echo -e "  ${GREEN}✅${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

fail() {
    echo -e "  ${RED}❌${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

skip() {
    echo -e "  ${YELLOW}⏭️${NC} $1"
    TESTS_SKIPPED=$((TESTS_SKIPPED + 1))
}

section() {
    echo ""
    echo "=== $1 ==="
}

# =============================================================================
# Tests: logging.sh
# =============================================================================

test_logging() {
    section "logging.sh"
    
    source scripts/utils/logging.sh 2>/dev/null || { fail "No carga logging.sh"; return 0; }
    pass "Carga correctamente"
    
    type log_info >/dev/null 2>&1 && pass "log_info existe" || fail "log_info no existe"
    type log_error >/dev/null 2>&1 && pass "log_error existe" || fail "log_error no existe"
    type log_success >/dev/null 2>&1 && pass "log_success existe" || fail "log_success no existe"
    type log_warning >/dev/null 2>&1 && pass "log_warning existe" || fail "log_warning no existe"
}

# =============================================================================
# Tests: docker.sh
# =============================================================================

test_docker() {
    section "docker.sh"
    
    source scripts/utils/docker.sh 2>/dev/null || { fail "No carga docker.sh"; return 0; }
    pass "Carga correctamente"
    
    type detect_compose >/dev/null 2>&1 && pass "detect_compose existe" || fail "detect_compose no existe"
    type get_compose_cmd >/dev/null 2>&1 && pass "get_compose_cmd existe" || fail "get_compose_cmd no existe"
    
    if command -v docker &>/dev/null; then
        result=$(get_compose_cmd 2>/dev/null) && pass "get_compose_cmd funciona: $result" || skip "Docker no disponible"
    else
        skip "Docker no disponible"
    fi
}

# =============================================================================
# Tests: path.sh
# =============================================================================

test_path() {
    section "path.sh"
    
    source scripts/utils/path.sh 2>/dev/null || { fail "No carga path.sh"; return 0; }
    pass "Carga correctamente"
    
    type safe_cd >/dev/null 2>&1 && pass "safe_cd existe" || fail "safe_cd no existe"
    type ensure_dir >/dev/null 2>&1 && pass "ensure_dir existe" || fail "ensure_dir no existe"
    type make_temp_dir >/dev/null 2>&1 && pass "make_temp_dir existe" || fail "make_temp_dir no existe"
    
    # Test funcionales
    cd /tmp
    safe_cd /tmp && pass "safe_cd /tmp funciona" || fail "safe_cd /tmp falla"
    
    if ! safe_cd /nonexistent_path_xyz 2>/dev/null; then
        pass "safe_cd falla correctamente en path inexistente"
    else
        fail "safe_cd debería fallar en path inexistente"
    fi
    
    tmpdir=$(make_temp_dir "test-")
    [[ -d "$tmpdir" ]] && pass "make_temp_dir crea directorio" && rm -rf "$tmpdir" || fail "make_temp_dir falla"
}

# =============================================================================
# Tests: parallel.sh
# =============================================================================

test_parallel() {
    section "parallel.sh"
    
    source scripts/utils/parallel.sh 2>/dev/null || { fail "No carga parallel.sh"; return 0; }
    pass "Carga correctamente"
    
    type parallel_exec >/dev/null 2>&1 && pass "parallel_exec existe" || fail "parallel_exec no existe"
    type parallel_with_limit >/dev/null 2>&1 && pass "parallel_with_limit existe" || fail "parallel_with_limit no existe"
    
    # Test funcionales
    parallel_exec "echo %s" "a" "b" "c" && pass "parallel_exec funciona" || fail "parallel_exec falla"
    
    # Test retry.sh (separate module)
    section "retry.sh"
    source scripts/utils/retry.sh 2>/dev/null || { fail "No carga retry.sh"; return 0; }
    pass "Carga correctamente"
    
    attempt_counter=0
    retry_test() { attempt_counter=$((attempt_counter + 1)); [[ $attempt_counter -ge 2 ]]; }
    retry_with_backoff 5 1 4 "retry_test" && pass "retry_with_backoff funciona" || fail "retry_with_backoff falla"
}

# =============================================================================
# Tests: pipeline.sh
# =============================================================================

test_pipeline() {
    section "pipeline.sh"
    
    # Cargar pipeline.sh
    source pipeline.sh 2>/dev/null || { fail "No carga pipeline.sh"; return 0; }
    pass "pipeline.sh carga correctamente"
    
    [[ -n "$BASE_DIR" ]] && pass "BASE_DIR definida: $BASE_DIR" || fail "BASE_DIR no definida"
    [[ -n "$CONFIG_DIR" ]] && pass "CONFIG_DIR definida" || fail "CONFIG_DIR no definida"
    [[ -n "$COMPOSE_FILE" ]] && pass "COMPOSE_FILE definida" || fail "COMPOSE_FILE no definida"
    
    type show_help >/dev/null 2>&1 && pass "show_help existe" || fail "show_help no existe"
    type validate_prerequisites >/dev/null 2>&1 && pass "validate_prerequisites existe" || fail "validate_prerequisites no existe"
    type start_services >/dev/null 2>&1 && pass "start_services existe" || fail "start_services no existe"
    type stop_services >/dev/null 2>&1 && pass "stop_services existe" || fail "stop_services no existe"
}

# =============================================================================
# Resumen
# =============================================================================

show_summary() {
    echo ""
    echo "=========================================="
    echo "RESUMEN DE TESTS"
    echo "=========================================="
    echo -e "  ${GREEN}Pasados:${NC}   $TESTS_PASSED"
    echo -e "  ${RED}Fallidos:${NC}  $TESTS_FAILED"
    echo -e "  ${YELLOW}Saltados:${NC} $TESTS_SKIPPED"
    echo "=========================================="
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}🎉 Todos los tests pasaron!${NC}"
        exit 0
    else
        echo -e "${RED}💥 Hay tests fallidos${NC}"
        exit 1
    fi
}

# =============================================================================
# MAIN
# =============================================================================

main() {
    echo "🧪 Test Runner - pipeline.sh v2.0"
    echo "=================================="
    
    test_logging
    test_docker
    test_path
    test_parallel
    test_pipeline
    
    show_summary
}

main "$@"
