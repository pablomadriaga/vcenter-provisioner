#!/usr/bin/env bash
# =============================================================================
# cache.sh - Caching utilities for expensive operations
# =============================================================================
# Cacheo de resultados de operaciones costosas
# =============================================================================

set -euo pipefail

# =============================================================================
# Cache Configuration
# =============================================================================

# Cache directory
CACHE_DIR="${CACHE_DIR:-/tmp/pipeline-cache}"
CACHE_TTL="${CACHE_TTL:-3600}"  # 1 hour default TTL

# =============================================================================
# Cache Management
# =============================================================================

# Initialize cache directory
init_cache() {
    mkdir -p "$CACHE_DIR"
}

# Get cache file path
cache_file() {
    local key="$1"
    echo "$CACHE_DIR/$(echo "$key" | tr '/' '_')"
}

# Set cache value
# Usage: cache_set "docker:version" "value" 3600
cache_set() {
    local key="$1"
    local value="$2"
    local ttl="${3:-$CACHE_TTL}"
    local file
    file=$(cache_file "$key")
    
    init_cache
    
    # Write value and expiration time
    {
        echo "$value"
        echo "$ttl"
        date +%s
    } > "$file"
}

# Get cache value if not expired
# Usage: cache_get "docker:version" && echo "Cached: $value"
cache_get() {
    local key="$1"
    local file
    file=$(cache_file "$key")
    
    if [[ ! -f "$file" ]]; then
        return 1
    fi
    
    local ttl
    local created
    local now
    ttl=$(tail -n 2 "$file" | head -1)
    created=$(tail -n 1 "$file")
    now=$(date +%s)
    
    if (( now - created > ttl )); then
        rm -f "$file"
        return 1
    fi
    
    head -n 1 "$file"
    return 0
}

# Check if cache exists and is valid
# Usage: cache_exists "docker:version"
cache_exists() {
    local key="$1"
    cache_get "$key" &>/dev/null
}

# Invalidate cache
# Usage: cache_invalidate "docker:version"
cache_invalidate() {
    local key="$1"
    local file
    file=$(cache_file "$key")
    rm -f "$file"
}

# Invalidate all cache
# Usage: cache_invalidate_all
cache_invalidate_all() {
    rm -rf "$CACHE_DIR"
}

# =============================================================================
# Cached Operations
# =============================================================================

# Get Docker version (cached)
# Usage: docker_version=$(get_docker_version_cached)
get_docker_version_cached() {
    local cache_key="docker:version"
    
    if cache_exists "$cache_key"; then
        cache_get "$cache_key"
        return 0
    fi
    
    local version
    version=$(docker --version 2>/dev/null | head -n1)
    cache_set "$cache_key" "$version"
    echo "$version"
}

# Get Docker Compose version (cached)
# Usage: compose_version=$(get_compose_version_cached)
get_compose_version_cached() {
    local cache_key="compose:version"
    
    if cache_exists "$cache_key"; then
        cache_get "$cache_key"
        return 0
    fi
    
    local version
    if docker compose version &>/dev/null; then
        version=$(docker compose version --short 2>/dev/null)
    elif command -v docker-compose &>/dev/null; then
        version=$(docker-compose --version 2>/dev/null | grep -o 'v[0-9]\+\.[0-9]\+\.[0-9]\+')
    else
        version="not found"
    fi
    
    cache_set "$cache_key" "$version"
    echo "$version"
}

# Get CPU count (cached)
# Usage: cpu_count=$(get_cpu_count_cached)
get_cpu_count_cached() {
    local cache_key="system:cpu_count"
    
    if cache_exists "$cache_key"; then
        cache_get "$cache_key"
        return 0
    fi
    
    local count
    count=$(get_cpu_count)
    cache_set "$cache_key" "$count"
    echo "$count"
}

# =============================================================================
# Export Functions
# =============================================================================

export -f init_cache
export -f cache_file
export -f cache_set
export -f cache_get
export -f cache_exists
export -f cache_invalidate
export -f cache_invalidate_all
export -f get_docker_version_cached
export -f get_compose_version_cached
export -f get_cpu_count_cached

# =============================================================================
# END OF FILE
# =============================================================================
