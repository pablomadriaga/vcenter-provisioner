#!/usr/bin/env bash
# =============================================================================
# ops.sh - Pipeline operations: test + cleanup
# =============================================================================

set -euo pipefail

# =============================================================================
# Test Functions
# =============================================================================

setup_test_environment() {
    log_section "Setting up Test Environment"
    for tool in python3 npm go; do
        command -v "$tool" &>/dev/null || log_warning "Tool not available: $tool"
    done
}

run_host_tests() {
    log_section "Running Host Tests (Fast)"
    local passed=0 failed=0
    
    log_step 1 4 "Testing Node.js services on host"
    for service in auth-service api-gateway credential-manager; do
        if [[ -d "apps/$service" ]]; then
            (cd "apps/$service" && npm test &>/dev/null) && \
                { log_test_result "$service" "pass" "Host tests passed"; ((passed++)); } || \
                { log_test_result "$service" "fail" "Host tests failed"; ((failed++)); } || true
        fi
    done
    
    log_step 2 4 "Testing Go services on host"
    for service in vm-orchestrator vcenter-operations monitoring-service; do
        if [[ -d "apps/$service" ]]; then
            (cd "apps/$service" && go test ./... &>/dev/null) && \
                { log_test_result "$service" "pass" "Host tests passed"; ((passed++)); } || \
                { log_test_result "$service" "fail" "Host tests failed"; ((failed++)); } || true
        fi
    done
    
    log_step 3 4 "Testing Python services on host"
    for service in typing-service stats-service backup-service; do
        if [[ -d "apps/$service" ]]; then
            (cd "apps/$service" && python3 -m pytest app/ --tb=short &>/dev/null) && \
                { log_test_result "$service" "pass" "Host tests passed"; ((passed++)); } || \
                { log_test_result "$service" "fail" "Host tests failed"; ((failed++)); } || true
        fi
    done
    
    log_step 4 4 "Testing Provisioner UI on host"
    if [[ -d "apps/provisioner-ui" ]]; then
        (cd "apps/provisioner-ui" && npm test &>/dev/null) && \
            { log_test_result "provisioner-ui" "pass" "Host tests passed"; ((passed++)); } || \
            { log_test_result "provisioner-ui" "fail" "Host tests failed"; ((failed++)); } || true
    fi
    
    log_info "Host tests completed: passed=$passed, failed=$failed"
    return $failed
}

run_docker_tests() {
    log_section "Running Docker Tests (Deterministic)"
    local passed=0 failed=0
    
    for svc in provisioner-typing provisioner-auth provisioner-stats; do
        if docker ps --format '{{.Names}}' | grep -q "^${svc}$"; then
            case "$svc" in
                provisioner-typing)  docker exec "$svc" python -m pytest app/ &>/dev/null ;;
                provisioner-auth)    docker exec "$svc" npm test &>/dev/null ;;
                provisioner-stats)   docker exec "$svc" python -m pytest &>/dev/null ;;
            esac
            if [[ $? -eq 0 ]]; then
                log_test_result "$svc" "pass" "Docker tests passed"
                ((passed++)) || true
            else
                log_test_result "$svc" "fail" "Docker tests failed"
                ((failed++)) || true
            fi
        fi
    done
    
    log_info "Docker tests completed: passed=$passed, failed=$failed"
    return $failed
}

run_hybrid_tests() {
    log_banner "Hybrid Test Suite"
    setup_test_environment
    
    local failures=0
    [[ "$RUN_TEST_HOST" == "true" || "$RUN_TEST" == "true" ]] && { run_host_tests || ((failures++)); } || true
    [[ "$RUN_TEST_DOCKER" == "true" || "$RUN_TEST" == "true" ]] && { run_docker_tests || ((failures++)); } || true
    
    log_section "Test Summary"
    log_info "Hybrid tests execution completed"
    [[ $failures -eq 0 ]] && log_success_banner "All Tests Passed" || log_failure_banner "Some Tests Failed"
    return $failures
}

# =============================================================================
# Cleanup Functions
# =============================================================================

show_cleanup_plan() {
    log_section "Cleanup Plan"
    log_info "Containers: $([ "$CLEANUP_CONTAINERS" == "true" ] && echo YES || echo NO)"
    log_info "Networks: $([ "$CLEANUP_NETWORKS" == "true" ] && echo YES || echo NO)"
    log_info "Volumes: $([ "$CLEANUP_VOLUMES" == "true" ] && echo "YES - DATA LOSS!" || echo NO)"
    log_info "Images: $([ "$CLEANUP_IMAGES" == "true" ] && echo YES || echo NO)"
    [[ "$CLEANUP_FORCE" != "true" ]] && log_warning "Use --cleanup-force to skip confirmation"
}

confirm_cleanup() {
    [[ "$CLEANUP_FORCE" == "true" ]] && return 0
    read -p "Continue with cleanup? (y/N): " -n 1 -r
    [[ $REPLY =~ ^[Yy]$ ]]
}

cleanup_containers() {
    log_section "Cleaning Containers"
    local removed=0
    for c in provisioner-typing provisioner-auth provisioner-stats provisioner-gateway \
             provisioner-vm-orchestrator provisioner-vcenter-operations provisioner-credential-manager \
             provisioner-monitoring provisioner-backup provisioner-ui \
             vcenter-provisioner-db vcenter-provisioner-redis vcenter-provisioner-migrations; do
        if docker ps -a --format '{{.Names}}' | grep -q "^${c}$"; then
            docker stop "$c" &>/dev/null || true
            if docker rm -f "$c" &>/dev/null; then
                log_success "$c removed"
                ((removed++)) || true
            else
                log_warning "$c removal failed"
            fi
        fi
    done
    log_info "Containers removed: $removed"
}

cleanup_networks() {
    log_section "Cleaning Networks"
    local removed=0
    for n in vcenter-provisioner_default vcenter-provisioner_antigravity-network; do
        if docker network ls --format '{{.Name}}' | grep -q "^${n}$"; then
            if docker network rm "$n" &>/dev/null; then
                log_success "$n removed"
                ((removed++)) || true
            else
                log_warning "$n removal failed"
            fi
        fi
    done
    log_info "Networks removed: $removed"
}

cleanup_volumes() {
    log_section "Cleaning Volumes"
    local removed=0
    for v in vcenter-provisioner_postgres_data vcenter-provisioner_redis_data; do
        if docker volume ls --format '{{.Name}}' | grep -q "^${v}$"; then
            log_warning "Removing volume: $v (DATA LOSS!)"
            if docker volume rm "$v" &>/dev/null; then
                log_success "$v removed"
                ((removed++)) || true
            else
                log_warning "$v removal failed"
            fi
        fi
    done
    [[ $removed -gt 0 ]] && log_warning "$removed volumes removed. Database data may be lost."
    log_info "Volumes removed: $removed"
}

cleanup_docker_resources() {
    log_banner "Docker Cleanup"
    show_cleanup_plan
    confirm_cleanup || { log_info "Cleanup cancelled"; return 0; }
    
    cleanup_containers
    cleanup_networks
    cleanup_volumes
    
    log_success_banner "Cleanup Completed"
}

export -f run_hybrid_tests
export -f cleanup_docker_resources
