# =============================================================================
# SERVICES MANAGEMENT FUNCTIONS
# =============================================================================

function wait_for_services_ready() {
    log_info "Waiting for infrastructure services to be ready..."
    
    local max_retries=60
    local retry_count=0
    local all_ready=false
    
    while [[ $retry_count -lt $max_retries ]]; do
        all_ready=true
        
        # Check PostgreSQL
        if ! docker exec vcenter-provisioner-db pg_isready -U antigravity -d vcenter_provisioner &>/dev/null; then
            all_ready=false
            log_debug "PostgreSQL not ready yet..."
        fi
        
        # Check Redis (if running)
        if docker ps --format "{{.Names}}" | grep -q "vcenter-provisioner-redis"; then
            if ! docker exec vcenter-provisioner-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
                all_ready=false
                log_debug "Redis not ready yet..."
            fi
        fi
        
        if [[ "$all_ready" == true ]]; then
            log_success "All infrastructure services are ready"
            return 0
        fi
        
        sleep 1
        ((retry_count++))
        
        if (( retry_count % 10 == 0 )); then
            log_info "Still waiting for services... (${retry_count}/${max_retries})"
        fi
    done
    
    log_error "Services failed to become ready after ${max_retries} seconds"
    return 1
}

function start_services() {
    log_banner "Starting Services"
    
    # Check if .env.ci exists, generate if needed
    if [[ ! -f "$ENV_FILE" ]]; then
        log_warning ".env.ci file not found, generating..."
        if ! generate_env_file "$ENV_FILE" "$SERVICES_FILE"; then
            log_error "Failed to generate .env.ci file"
            return 1
        fi
    fi
    
    # Validate docker-compose file exists
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_error "Docker Compose file not found: $COMPOSE_FILE"
        return 1
    fi
    
    # Store original directory
    local original_dir
    original_dir=$(pwd)
    
    # Change to project root
    cd "$BASE_DIR" || {
        log_error "Cannot change to project directory: $BASE_DIR"
        return 1
    }
    
    # Start services using docker-compose
    log_command "Starting services with Docker Compose..."
    
    # Determine compose command based on what's available
    local compose_cmd
    compose_cmd=$(get_compose_cmd) || {
        log_error "Neither docker compose nor docker-compose is available"
        popd &>/dev/null || true
        return 1
    }
    
    # Start services
    if $compose_cmd -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d; then
        log_success "Services started successfully"
        popd &>/dev/null || true
        return 0
    else
        log_error "Failed to start services"
        popd &>/dev/null || true
        return 1
    fi
}

function stop_services() {
    log_banner "Stopping Services"
    
    # Store original directory
    local original_dir
    original_dir=$(pwd)
    
    # Change to project root
    safe_cd "$BASE_DIR" || return 1
    
    # Determine compose command
    local compose_cmd
    compose_cmd=$(get_compose_cmd) || {
        log_error "Neither docker compose nor docker-compose is available"
        popd &>/dev/null || true
        return 1
    }
    
    # Stop services
    log_command "Stopping services..."
    if $compose_cmd -f "$COMPOSE_FILE" down; then
        log_success "Services stopped successfully"
        popd &>/dev/null || true
        return 0
    else
        log_error "Failed to stop services"
        popd &>/dev/null || true
        return 1
    fi
}

function show_services_status() {
    log_banner "Services Status"
    
    # Store original directory
    local original_dir
    original_dir=$(pwd)
    
    # Change to project root
    safe_cd "$BASE_DIR" || return 1
    
    # Determine compose command
    local compose_cmd
    compose_cmd=$(get_compose_cmd) || {
        log_error "Neither docker compose nor docker-compose is available"
        popd &>/dev/null || true
        return 1
    }
    
    # Show services status
    log_command "Checking services status..."
    $compose_cmd -f "$COMPOSE_FILE" ps
    
    popd &>/dev/null || true
}
