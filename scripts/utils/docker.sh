#!/usr/bin/env bash
# =============================================================================
# docker.sh - Docker utilities with proper error handling
# =============================================================================
# Docker utilities with retry logic and robust error handling
# =============================================================================

set -euo pipefail

# =============================================================================
# Docker Compose Detection
# =============================================================================

# Detect and return the appropriate docker compose command
# Returns: "docker compose" or "docker-compose" or empty if neither available
# Usage: compose_cmd=$(detect_compose)
detect_compose() {
    if docker compose version &>/dev/null; then
        echo "docker compose"
        return 0
    elif command -v docker-compose &>/dev/null; then
        echo "docker-compose"
        return 0
    else
        log_error "Neither 'docker compose' nor 'docker-compose' is available"
        return 1
    fi
}

# Cached version of detect_compose for performance
# Use this when compose command is needed multiple times
declare COMPOSE_CMD
COMPOSE_CMD=$(detect_compose) || true

# Get compose command, using cache if available
get_compose_cmd() {
    if [[ -n "$COMPOSE_CMD" ]]; then
        echo "$COMPOSE_CMD"
    else
        detect_compose
    fi
}

# =============================================================================
# Docker Service Helpers
# =============================================================================

# Check if a specific container is running
# Usage: is_container_running "provisioner-db" && echo "Running"
is_container_running() {
    local container_name="$1"
    docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${container_name}$"
}

# Check if container exists (running or stopped)
# Usage: container_exists "provisioner-db" && echo "Exists"
container_exists() {
    local container_name="$1"
    docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^${container_name}$"
}

# Get container status
# Usage: status=$(get_container_status "provisioner-db")
get_container_status() {
    local container_name="$1"
    docker ps --format '{{.Names}}:{{.Status}}' 2>/dev/null | grep "^${container_name}:" | cut -d':' -f2-
}

# =============================================================================
# Docker Validation Helpers
# =============================================================================

# Validate Docker daemon is running with retry
# Usage: validate_docker_daemon || exit 1
validate_docker_daemon() {
    local max_attempts="${1:-3}"
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if docker info &>/dev/null; then
            return 0
        fi
        
        log_debug "Docker daemon check failed (attempt $attempt/$max_attempts)"
        
        if [[ $attempt -lt $max_attempts ]]; then
            sleep 2
        fi
        ((attempt++)) || true
    done
    
    log_error "Docker daemon is not running after $max_attempts attempts"
    log_info "Try: sudo systemctl start docker (or start Docker Desktop)"
    return 1
}

# Get Docker version info
# Usage: docker_version_info
docker_version_info() {
    local version
    version=$(get_docker_version_cached)
    local compose_version
    compose_version=$(get_compose_version_cached)
    
    echo "Docker: $version, Compose: $compose_version"
}

# =============================================================================
# Image Helpers
# =============================================================================

# Check if image exists locally
# Usage: image_exists "antigravity/api-gateway:v1.0.0"
image_exists() {
    local image="$1"
    docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | grep -q "^${image}$"
}

# Get image ID
# Usage: image_id=$(get_image_id "antigravity/api-gateway:v1.0.0")
get_image_id() {
    local image="$1"
    docker images --format '{{.ID}}' --filter "reference=${image}" 2>/dev/null | head -1
}

# =============================================================================
# Network Helpers
# =============================================================================

# Check if network exists
# Usage: network_exists "vcenter-provisioner_default"
network_exists() {
    local network="$1"
    docker network ls --format '{{.Name}}' 2>/dev/null | grep -q "^${network}$"
}

# =============================================================================
# Volume Helpers
# =============================================================================

# Check if volume exists
# Usage: volume_exists "vcenter-provisioner_postgres_data"
volume_exists() {
    local volume="$1"
    docker volume ls --format '{{.Name}}' 2>/dev/null | grep -q "^${volume}$"
}

# =============================================================================
# Retry-Enabled Helpers
# =============================================================================

# Wait for container to be running
# Usage: wait_for_container "provisioner-db" 30
wait_for_container() {
    local container="$1"
    local max_attempts="${2:-30}"
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if is_container_running "$container"; then
            log_debug "Container $container is running (attempt $attempt/$max_attempts)"
            return 0
        fi
        sleep 1
        ((attempt++)) || true
    done
    
    log_warning "Container $container not running after $max_attempts attempts"
    return 1
}

# Wait for container to be healthy
# Usage: wait_for_health "provisioner-db" 60
wait_for_health() {
    local container="$1"
    local max_attempts="${2:-60}"
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        local health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null)
        
        if [[ "$health" == "healthy" ]]; then
            log_debug "Container $container is healthy (attempt $attempt/$max_attempts)"
            return 0
        elif [[ "$health" == "unhealthy" ]]; then
            log_error "Container $container is unhealthy"
            return 1
        fi
        
        sleep 1
        ((attempt++)) || true
    done
    
    log_warning "Container $container not healthy after $max_attempts attempts"
    return 1
}

# =============================================================================
# Export Functions
# =============================================================================

export -f detect_compose
export -f get_compose_cmd
export -f is_container_running
export -f container_exists
export -f get_container_status
export -f validate_docker_daemon
export -f docker_version_info
export -f image_exists
export -f get_image_id
export -f network_exists
export -f volume_exists
export -f wait_for_container
export -f wait_for_health

# =============================================================================
# END OF FILE
# =============================================================================
