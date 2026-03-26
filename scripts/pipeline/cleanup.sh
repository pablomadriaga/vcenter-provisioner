# =============================================================================
# CLEANUP FUNCTIONS
# =============================================================================

function show_cleanup_plan() {
    log_section "Cleanup Plan"
    
    log_info "Containers: $([ "$CLEANUP_CONTAINERS" == "true" ] && echo "YES" || echo "NO")"
    log_info "Networks: $([ "$CLEANUP_NETWORKS" == "true" ] && echo "YES" || echo "NO")"
    log_info "Volumes: $([ "$CLEANUP_VOLUMES" == "true" ] && echo "YES - DANGER: Data loss possible!" || echo "NO")"
    log_info "Orphaned images: $([ "$CLEANUP_IMAGES" == "true" ] && echo "YES" || echo "NO")"
    
    if [[ "$CLEANUP_FORCE" != "true" ]]; then
        echo ""
        log_warning "This action will remove Docker resources."
        log_info "Use --cleanup-force to skip confirmation."
    else
        log_info "Force mode enabled - skipping confirmation"
    fi
}

function confirm_cleanup_action() {
    log_debug "CLEANUP_FORCE value: '$CLEANUP_FORCE'"
    if [[ "$CLEANUP_FORCE" == "true" ]]; then
        log_debug "Skipping confirmation due to --cleanup-force flag"
        return 0
    fi
    
    echo ""
    read -p "⚠️  Continue with cleanup? (y/N): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cleanup cancelled by user"
        return 1
    fi
    
    return 0
}

function cleanup_containers() {
    if [[ "$CLEANUP_CONTAINERS" != "true" ]]; then
        return 0
    fi
    
    log_section "Cleaning Containers"
    
    local containers_removed=0
    
    for container in "${PROJECT_CONTAINERS[@]}"; do
        if docker ps -a --format "{{.Names}}" | grep -q "^${container}$"; then
            log_command "Removing container: $container"
            
            # Stop if running
            if docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
                docker stop "$container" >/dev/null 2>&1 || true
            fi
            
            # Remove container
            if docker rm -f "$container" >/dev/null 2>&1; then
                log_success "$container removed"
                ((containers_removed++))
            else
                log_warning "$container removal failed"
            fi
        else
            log_debug "$container not found (skipping)"
        fi
    done
    
    log_info "Containers removed: $containers_removed"
    return 0
}

function cleanup_networks() {
    if [[ "$CLEANUP_NETWORKS" != "true" ]]; then
        return 0
    fi
    
    log_section "Cleaning Networks"
    
    local networks_removed=0
    
    for network in "${PROJECT_NETWORKS[@]}"; do
        if docker network ls --format "{{.Name}}" | grep -q "^${network}$"; then
            log_command "Removing network: $network"
            
            if docker network rm "$network" >/dev/null 2>&1; then
                log_success "$network removed"
                ((networks_removed++))
            else
                log_warning "$network removal failed"
            fi
        else
            log_debug "$network not found (skipping)"
        fi
    done
    
    log_info "Networks removed: $networks_removed"
    return 0
}

function cleanup_volumes() {
    if [[ "$CLEANUP_VOLUMES" != "true" ]]; then
        return 0
    fi
    
    log_section "Cleaning Volumes"
    
    local volumes_removed=0
    
    for volume in "${PROJECT_VOLUMES[@]}"; do
        if docker volume ls --format "{{.Name}}" | grep -q "^${volume}$"; then
            log_warning "Removing volume: $volume"
            log_warning "⚠️  This will delete all data in this volume!"
            
            if docker volume rm "$volume" >/dev/null 2>&1; then
                log_success "$volume removed"
                ((volumes_removed++))
            else
                log_warning "$volume removal failed"
            fi
        else
            log_debug "$volume not found (skipping)"
        fi
    done
    
    if [[ $volumes_removed -gt 0 ]]; then
        log_warning "⚠️  $volumes_removed volume(s) were removed."
        log_warning "   Database data may be lost. Run './pipeline.sh --up' to recreate."
    fi
    
    log_info "Volumes removed: $volumes_removed"
    return 0
}

function cleanup_docker_images() {
    if [[ "$CLEANUP_IMAGES" != "true" ]]; then
        return 0
    fi
    
    log_section "Cleaning Orphaned Images"
    
    log_command "Running docker system prune..."
    if docker system prune -f >/dev/null 2>&1; then
        log_success "Orphaned images cleaned"
    else
        log_warning "Docker prune failed"
    fi
    
    return 0
}

function cleanup_docker_resources() {
    log_banner "Docker Cleanup"
    
    # Force mode: use docker system prune -a -f (skip confirmation, clean all system resources)
    if [[ "$CLEANUP_FORCE" == "true" ]]; then
        log_section "Force Cleanup Mode"
        log_warning "This will remove ALL Docker resources on the system!"
        log_command "Running docker system prune -a -f..."
        
        if docker system prune -a -f >/dev/null 2>&1; then
            log_success "System prune completed - all Docker resources cleaned"
        else
            log_warning "Docker system prune completed with some errors"
        fi
        
        log_success_banner "Cleanup Completed"
        return 0
    fi
    
    # Show cleanup plan
    show_cleanup_plan
    
    # Get confirmation (unless forced)
    if ! confirm_cleanup_action; then
        return 1
    fi
    
    local cleanup_start_time=$(date +%s)
    
    # Execute cleanup operations
    cleanup_containers
    cleanup_networks
    cleanup_volumes
    cleanup_docker_images
    
    # Additional docker-compose cleanup
    log_section "Docker Compose Cleanup"
    
    safe_cd "$BASE_DIR" || return 1
    
    local compose_cmd
    compose_cmd=$(get_compose_cmd) || true
    
    if [[ -n "$compose_cmd" ]]; then
        log_command "Running docker-compose cleanup..."
        $compose_cmd -f "$COMPOSE_FILE" down --volumes --remove-orphans >/dev/null 2>&1 || true
    fi
    
    popd &>/dev/null || true
    
    local cleanup_end_time=$(date +%s)
    local total_duration=$((cleanup_end_time - cleanup_start_time))
    
    log_time "Total cleanup time" "$cleanup_start_time" "$cleanup_end_time"
    
    log_success_banner "Cleanup Completed"
    return 0
}
