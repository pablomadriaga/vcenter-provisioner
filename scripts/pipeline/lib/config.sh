#!/usr/bin/env bash
# =============================================================================
# config.sh - Configuration loading utilities
# =============================================================================
# Carga y parsing de configuraciones JSON
# =============================================================================

set -euo pipefail

# =============================================================================
# Config File Loading
# =============================================================================

# Cargar archivo de configuración JSON
# Usage: load_config "ports" "config/ports.json"
load_config() {
    local config_name="$1"
    local config_file="$2"
    
    if [[ ! -f "$config_file" ]]; then
        log_error "Config file not found: $config_file"
        return 1
    fi
    
    log_debug "Loaded config: $config_name from $config_file"
    return 0
}

# =============================================================================
# JSON Query Functions (usando jq)
# =============================================================================

# Obtener valor de puerto para un servicio
# Usage: port=$(get_port "api-gateway" "external")
get_port() {
    local service="$1"
    local port_type="${2:-external}"
    local ports_file="${PORTS_FILE:-config/ports.json}"
    
    jq -r ".ports[\"$service\"][\"$port_type\"] // empty" "$ports_file" 2>/dev/null || {
        log_error "Port not found for service: $service"
        return 1
    }
}

# Obtener configuración de servicio
# Usage: service_path=$(get_service "api-gateway" "path")
get_service() {
    local service="$1"
    local field="$2"
    local services_file="${SERVICES_FILE:-config/services.json}"
    
    jq -r ".services[\"$service\"][\"$field\"] // empty" "$services_file" 2>/dev/null || {
        log_error "Service field '$field' not found for: $service"
        return 1
    }
}

# Listar todos los servicios
# Usage: services=($(get_all_services))
get_all_services() {
    local services_file="${SERVICES_FILE:-config/services.json}"
    jq -r '.services | keys[]' "$services_file" 2>/dev/null
}

# Obtener lista de puertos externos
# Usage: external_ports=($(get_external_ports))
get_external_ports() {
    local ports_file="${PORTS_FILE:-config/ports.json}"
    jq -r '.ports[] | select(.external != null) | .external' "$ports_file" 2>/dev/null
}

# =============================================================================
# Validation Helpers
# =============================================================================

# Verificar que archivo de configuración existe
# Usage: validate_config_file "$PORTS_FILE" "Ports"
validate_config_file() {
    local file="$1"
    local name="$2"
    
    if [[ ! -f "$file" ]]; then
        log_error "$name configuration file not found: $file"
        return 1
    fi
    
    log_debug "$name configuration file found: $file"
    return 0
}

# =============================================================================
# Export Functions
# =============================================================================

export -f load_config
export -f get_port
export -f get_service
export -f get_all_services
export -f get_external_ports
export -f validate_config_file

# =============================================================================
# END OF FILE
# =============================================================================
