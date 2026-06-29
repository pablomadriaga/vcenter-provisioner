#!/usr/bin/env bash
# =============================================================================
# service.sh - Docker service management utilities
# =============================================================================
# Funciones para gestionar servicios Docker
# =============================================================================

set -euo pipefail

# =============================================================================
# Container Queries
# =============================================================================

# Verificar si un contenedor está ejecutándose
# Usage: is_running "provisioner-db" && echo "Running"
is_running() {
    local container="$1"
    docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${container}$"
}

# Verificar si contenedor existe (ejecutándose o detenido)
# Usage: exists "provisioner-db" && echo "Exists"
exists() {
    local container="$1"
    docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^${container}$"
}

# Obtener estado de contenedor
# Usage: status=$(container_status "provisioner-db")
status() {
    local container="$1"
    docker ps --format '{{.Names}}:{{.Status}}' 2>/dev/null | grep "^${container}:" | cut -d':' -f2-
}

# =============================================================================
# Service Operations
# =============================================================================

# Iniciar servicio con compose
# Usage: compose_up || exit 1
compose_up() {
    local compose_cmd
    compose_cmd=$(get_compose_cmd) || return 1
    
    log_command "Starting services with Docker Compose..."
    $compose_cmd -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
}

# Detener servicios con compose
# Usage: compose_down
compose_down() {
    local compose_cmd
    compose_cmd=$(get_compose_cmd) || return 1
    
    log_command "Stopping services..."
    $compose_cmd -f "$COMPOSE_FILE" down
}

# Mostrar estado de servicios
# Usage: compose_status
compose_status() {
    local compose_cmd
    compose_cmd=$(get_compose_cmd) || return 1
    
    log_command "Checking services status..."
    $compose_cmd -f "$COMPOSE_FILE" ps
}

# =============================================================================
# Container Management
# =============================================================================

# Detener contenedor
# Usage: stop_container "provisioner-db"
stop_container() {
    local container="$1"
    
    if is_running "$container"; then
        log_debug "Stopping container: $container"
        docker stop "$container" &>/dev/null
    fi
}

# Remover contenedor
# Usage: remove_container "provisioner-db"
remove_container() {
    local container="$1"
    
    if exists "$container"; then
        log_debug "Removing container: $container"
        docker rm -f "$container" &>/dev/null
    fi
}

# =============================================================================
# Health Checks
# =============================================================================

# Esperar a que servicio esté listo
# Usage: wait_for_service "provisioner-db" 30
wait_for_service() {
    local container="$1"
    local max_attempts="${2:-30}"
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if is_running "$container"; then
            log_debug "Service $container is running (attempt $attempt/$max_attempts)"
            return 0
        fi
        sleep 1
        ((attempt++))
    done
    
    log_warning "Service $container not running after $max_attempts attempts"
    return 1
}

# =============================================================================
# Export Functions
# =============================================================================

export -f is_running
export -f exists
export -f status
export -f compose_up
export -f compose_down
export -f compose_status
export -f stop_container
export -f remove_container
export -f wait_for_service

# =============================================================================
# END OF FILE
# =============================================================================
