#!/usr/bin/env bash
# =============================================================================
# lint.sh - vCenter Provisioner Architecture Lint
# =============================================================================
# Verifies architecture: PostgreSQL ONLY, NEVER SQLite
# =============================================================================
# USAGE:
#   source scripts/ci/lint.sh
#   run_all_lint_checks
# =============================================================================

# Global variables
SQLITE_FOUND=false
ISSUES_FOUND=false

# =============================================================================
# LINT FUNCTIONS
# =============================================================================

function test_sqlite_in_file() {
    local file_path="$1"
    local file_name="$2"
    
    # Skip if file doesn't exist
    if [[ ! -f "$file_path" ]]; then
        return
    fi
    
    # Skip files in excluded directories
    if [[ "$file_path" =~ (node_modules|\.venv|dist|build) ]]; then
        return
    fi
    
    # Check for SQLite URLs
    if grep -q "sqlite://" "$file_path" 2>/dev/null; then
        log_error "SQLite URL found in: $file_name"
        log_info "  Path: $file_path"
        SQLITE_FOUND=true
        ISSUES_FOUND=true
    fi
}

function test_database_config() {
    local file_path="$1"
    local file_name="$2"
    
    if [[ ! -f "$file_path" ]]; then
        return
    fi
    
    # Check for PostgreSQL configuration
    if grep -q "postgresql://\|postgres://" "$file_path" 2>/dev/null; then
        log_lint_result "$file_name" "pass" "Uses PostgreSQL"
    elif grep -q "sqlite" "$file_path" 2>/dev/null; then
        log_lint_result "$file_name" "fail" "Uses SQLite (PROHIBITED)"
        SQLITE_FOUND=true
        ISSUES_FOUND=true
    fi
}

function test_docker_compose() {
    local compose_file="$1"
    
    if [[ ! -f "$compose_file" ]]; then
        log_error "Docker Compose file not found: $compose_file"
        ISSUES_FOUND=true
        return
    fi
    
    # Check for PostgreSQL configuration
    if grep -q "postgres" "$compose_file" 2>/dev/null; then
        log_lint_result "docker-compose.yml" "pass" "PostgreSQL configured"
    else
        log_lint_result "docker-compose.yml" "fail" "No PostgreSQL found"
        ISSUES_FOUND=true
    fi
}

function test_dockerfile() {
    local dockerfile_path="$1"
    local service_name="$2"
    
    if [[ ! -f "$dockerfile_path" ]]; then
        log_lint_result "$service_name" "fail" "Dockerfile missing"
        ISSUES_FOUND=true
        return
    fi
    
    log_lint_result "$service_name" "pass" "Dockerfile exists"
}

function run_service_specific_lint() {
    local service="$1"
    local service_path="$2"
    local service_type="$3"
    
    log_step $((current_step++)) total_steps "Linting $service ($service_type)"
    
    case "$service_type" in
        "node")
            lint_node_service "$service_path"
            ;;
        "python")
            lint_python_service "$service_path"
            ;;
        "go")
            lint_go_service "$service_path"
            ;;
        "react")
            lint_react_service "$service_path"
            ;;
        "scripts")
            log_info "Skipping lint for shared-scripts (utility)"
            ;;
        *)
            log_warning "Unknown service type: $service_type for $service"
            ;;
    esac
}

function lint_node_service() {
    local service_path="$1"
    
    if [[ ! -d "$service_path" ]]; then
        log_error "Service directory not found: $service_path"
        ISSUES_FOUND=true
        return
    fi
    
    cd "$service_path" || return 1
    
    # Check package.json
    if [[ -f "package.json" ]]; then
        # Verify typescript binary exists (not just node_modules directory)
        if [[ ! -f "node_modules/.bin/tsc" ]]; then
            log_info "node_modules incomplete or missing tsc, reinstalling..."
            rm -rf node_modules
            npm install --quiet 2>/dev/null || {
                log_error "Failed to install dependencies"
                ISSUES_FOUND=true
                cd - >/dev/null
                return
            }
        fi
        
        # Run npm lint if available
        if ./node_modules/.bin/tsc --noEmit 2>/dev/null; then
            log_lint_result "tsc" "pass" "Node.js lint passed"
        else
            log_lint_result "tsc" "fail" "Node.js lint failed"
            ISSUES_FOUND=true
        fi
    else
        log_warning "No package.json found in $service_path"
    fi
    
    cd - >/dev/null
}

function lint_python_service() {
    local service_path="$1"
    
    if [[ ! -d "$service_path" ]]; then
        log_error "Service directory not found: $service_path"
        ISSUES_FOUND=true
        return
    fi
    
    # Auto-install flake8 if not available
    if ! command -v flake8 &> /dev/null; then
        log_info "flake8 not found, installing..."
        python3 -m pip install flake8 --break-system-packages --quiet 2>/dev/null || {
            log_warning "Could not install flake8, skipping Python lint"
            return
        }
    fi
    
    cd "$service_path" || return 1
    
    # Run flake8
    log_command "Running flake8 for $service_path..."
    if flake8 . --max-line-length=100 --ignore=E501,W293,E302,E712,F401 --exclude=.venv 2>/dev/null; then
        log_lint_result "flake8" "pass" "Python lint passed"
    else
        log_lint_result "flake8" "fail" "Python lint failed"
        ISSUES_FOUND=true
    fi
    
    cd - >/dev/null
}

function lint_go_service() {
    local service_path="$1"
    
    if [[ ! -d "$service_path" ]]; then
        log_error "Service directory not found: $service_path"
        ISSUES_FOUND=true
        return
    fi
    
    cd "$service_path" || return 1
    
    # Run go vet
    if command -v go &> /dev/null; then
        if go vet ./... 2>/dev/null; then
            log_lint_result "go vet" "pass" "Go lint passed"
        else
            log_lint_result "go vet" "fail" "Go lint failed"
            ISSUES_FOUND=true
        fi
    else
        log_warning "Go not available, skipping Go lint"
    fi
    
    cd - >/dev/null
}

function lint_react_service() {
    local service_path="$1"
    
    if [[ ! -d "$service_path" ]]; then
        log_error "Service directory not found: $service_path"
        ISSUES_FOUND=true
        return
    fi
    
    cd "$service_path" || return 1
    
    # Check package.json for React project
    if [[ -f "package.json" ]]; then
        # Install dependencies if node_modules doesn't exist
        if [[ ! -d "node_modules" ]]; then
            log_info "Installing dependencies for $service_path..."
            npm install --quiet 2>/dev/null || {
                log_error "Failed to install dependencies"
                ISSUES_FOUND=true
                cd - >/dev/null
                return
            }
        fi
        
        # Run eslint if available
        if ./node_modules/.bin/eslint . 2>/dev/null; then
            log_lint_result "eslint" "pass" "React lint passed"
        else
            log_lint_result "eslint" "fail" "React lint failed"
            ISSUES_FOUND=true
        fi
    else
        log_warning "No package.json found in $service_path"
    fi
    
    cd - >/dev/null
}

# =============================================================================
# ARCHITECTURE VALIDATION
# =============================================================================

function validate_postgresql_architecture() {
    log_section "Validating PostgreSQL Architecture"
    
    # Check database.py files
    log_step 1 4 "Checking database.py files..."
    local db_files
    db_files=$(find apps/ -name "database.py" -type f 2>/dev/null || true)
    
    if [[ -n "$db_files" ]]; then
        while IFS= read -r file; do
            local file_name
            file_name=$(basename "$file")
            test_database_config "$file" "$file_name"
        done <<< "$db_files"
    else
        log_warning "No database.py files found"
    fi
    
    # Search for SQLite in Python files
    log_step 2 4 "Searching for SQLite in Python files..."
    local py_files
    py_files=$(find apps/ -name "*.py" -type f 2>/dev/null || true)
    
    if [[ -n "$py_files" ]]; then
        while IFS= read -r file; do
            local file_name
            file_name=$(basename "$file")
            test_sqlite_in_file "$file" "$file_name"
        done <<< "$py_files"
    fi
    
    # Search for SQLite in JavaScript/TypeScript files
    log_step 3 4 "Searching for SQLite in JS/TS files..."
    local js_files
    js_files=$(find apps/ -name "*.js" -o -name "*.ts" -o -name "*.tsx" -type f 2>/dev/null || true)
    
    if [[ -n "$js_files" ]]; then
        while IFS= read -r file; do
            local file_name
            file_name=$(basename "$file")
            test_sqlite_in_file "$file" "$file_name"
        done <<< "$js_files"
    fi
    
    # Check docker-compose.yml
    log_step 4 4 "Checking docker-compose.yml..."
    test_docker_compose "$COMPOSE_FILE"
}

function validate_service_structure() {
    log_section "Validating Service Structure"
    
    # Get services from configuration
    local services
    services=$(jq -r '.services | keys[]' "$SERVICES_FILE" 2>/dev/null || true)
    
    local total_services
    total_services=$(echo "$services" | wc -l)
    local current_step=1
    
    for service in $services; do
        local service_path
        service_path=$(get_service_config "$service" "path" 2>/dev/null || echo "")
        local service_type
        service_type=$(get_service_config "$service" "type" 2>/dev/null || echo "")
        
        if [[ -n "$service_path" && "$service_path" != "null" ]]; then
            local full_path="$BASE_DIR/$service_path"
            
            # Check Dockerfile
            local dockerfile="$full_path/Dockerfile"
            test_dockerfile "$dockerfile" "$service"
            
            # Run service-specific lint
            run_service_specific_lint "$service" "$full_path" "$service_type"
        else
            log_warning "No path configured for service: $service"
        fi
    done
}

# =============================================================================
# MAIN LINT FUNCTION
# =============================================================================

function run_all_lint_checks() {
    log_banner "Architecture Lint - vCenter Provisioner"
    
    # Store original directory
    local original_dir
    original_dir=$(pwd)
    
    # Ensure we're in project root
    cd "$BASE_DIR" || {
        log_error "Cannot change to project directory: $BASE_DIR"
        return 1
    }
    
    # Reset global variables
    SQLITE_FOUND=false
    ISSUES_FOUND=false
    
    # Run architecture validation
    validate_postgresql_architecture
    
    # Run service structure validation
    validate_service_structure
    
    # Final result
    log_section "Lint Results"
    
    if [[ "$SQLITE_FOUND" == true ]]; then
        log_failure_banner "SQLite Detected - PROHIBITED"
        log_error_with_context "SQLite is PROHIBITED in this project" "SQLite URLs were found in the codebase" "Use PostgreSQL in Docker for all database operations"
        cd "$original_dir"
        return 1
    fi
    
    if [[ "$ISSUES_FOUND" == true ]]; then
        log_failure_banner "Lint Issues Found"
        log_error_with_context "Architecture validation failed" "Some checks failed" "Fix the issues above before proceeding"
        cd "$original_dir"
        return 1
    fi
    
    log_success_banner "Architecture Validation Passed"
    log_info "✅ PostgreSQL only, no SQLite detected"
    log_info "✅ All services have Dockerfiles"
    log_info "✅ Service-specific lint checks passed"
    
    cd "$original_dir"
    return 0
}

# =============================================================================
# QUICK LINT FUNCTIONS (for individual services)
# =============================================================================

function lint_single_service() {
    local service="$1"
    
    log_section "Linting Single Service: $service"
    
    local service_path
    service_path=$(get_service_config "$service" "path" 2>/dev/null || echo "")
    local service_type
    service_type=$(get_service_config "$service" "type" 2>/dev/null || echo "")
    
    if [[ -n "$service_path" && "$service_path" != "null" ]]; then
        local full_path="$BASE_DIR/$service_path"
        run_service_specific_lint "$service" "$full_path" "$service_type"
    else
        log_error "Service not found: $service"
        return 1
    fi
}

# =============================================================================
# EXPORT FUNCTIONS
# =============================================================================

export -f test_sqlite_in_file
export -f test_database_config
export -f test_docker_compose
export -f test_dockerfile
export -f run_service_specific_lint
export -f lint_node_service
export -f lint_python_service
export -f lint_go_service
export -f lint_react_service
export -f validate_postgresql_architecture
export -f validate_service_structure
export -f run_all_lint_checks
export -f lint_single_service

# =============================================================================
# END OF FILE
# =============================================================================