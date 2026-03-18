#!/usr/bin/env bash
# =============================================================================
# hash.sh - Deterministic Hash Calculation
# =============================================================================
# Generates deterministic SHA256 hash of directory contents.
# USED BY: pipeline.sh, build.sh
# =============================================================================
# USAGE:
#   source scripts/ci/hash.sh
#   hash=$(get_directory_hash "./apps/api-gateway")
# =============================================================================

# Exclusion patterns - files/directories to ignore when calculating hash
readonly EXCLUDED_PATTERNS=(
    "node_modules"
    "__pycache__"
    ".git"
    ".env"
    ".env.*"
    ".vscode"
    ".idea"
    ".dockerignore"
    "*.log"
    "dist"
    "build"
    ".cache"
    ".pytest_cache"
    "*.egg-info"
    "*.pyc"
    ".coverage"
    "htmlcov"
    "test-results"
    "secrets.json"
    "*.pem"
    "*.key"
    ".DS_Store"
    "Thumbs.db"
    ".nvmrc"
    ".python-version"
    ".ruby-version"
    "coverage.xml"
    ".nyc_output"
)

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

function is_excluded() {
    local path="$1"
    
    for pattern in "${EXCLUDED_PATTERNS[@]}"; do
        if [[ "$pattern" == *"*"* ]]; then
            # Wildcard pattern
            if [[ "$path" == $pattern ]]; then
                return 0
            fi
        else
            # Exact match or contains pattern
            if [[ "$path" == "$pattern" || "$path" == *"/$pattern/"* || "$path" == "$pattern/"* ]]; then
                return 0
            fi
        fi
    done
    
    return 1
}

function normalize_path() {
    local path="$1"
    # Convert to forward slashes and remove leading/trailing slashes
    echo "$path" | sed 's|\\|/|g' | sed 's|^/||' | sed 's|/$||'
}

# =============================================================================
# MAIN HASH FUNCTIONS
# =============================================================================

function get_directory_hash() {
    local directory_path="$1"
    
    if [[ ! -d "$directory_path" ]]; then
        echo "Error: Directory '$directory_path' does not exist" >&2
        return 1
    fi
    
    # Get absolute path
    local root_dir
    root_dir=$(cd "$directory_path" && pwd)
    
    local content=""
    local temp_file
    temp_file=$(mktemp)
    
    # Find all files, sort them, and calculate content
    # Use find with proper absolute path handling
    if [[ -d "$root_dir" ]]; then
        while IFS= read -r -d '' file; do
            local relative_path="${file#$root_dir/}"
            relative_path=$(normalize_path "$relative_path")
            
            # Skip excluded files/directories
            if is_excluded "$relative_path"; then
                continue
            fi
            
            # Calculate file hash
            local file_hash
            file_hash=$(sha256sum "$file" | cut -d' ' -f1)
            
            # Add to content
            echo "$relative_path:$file_hash" >> "$temp_file"
            
        done < <(find "$root_dir" -type f -print0 | sort -z)
    fi
    
    # Sort the content and create final hash
    if [[ -f "$temp_file" && -s "$temp_file" ]]; then
        local final_hash
        final_hash=$(sort "$temp_file" | sha256sum | cut -d' ' -f1)
        
        # Return first 10 characters (matching PowerShell behavior)
        echo "${final_hash:0:10}"
    else
        echo "0000000000"  # Empty directory hash
    fi
    
    # Cleanup
    rm -f "$temp_file"
}

function get_service_hash() {
    local service_path="$1"
    local shared_scripts_hash="${2:-}"
    
    # 1. Get code hash for the service
    local code_hash
    code_hash=$(get_directory_hash "$service_path")
    
    # 2. If shared scripts hash is provided, combine them
    if [[ -n "$shared_scripts_hash" && "$shared_scripts_hash" != "null" ]]; then
        local combined="$service_path:$code_hash+$shared_scripts_hash"
        local combined_hash
        combined_hash=$(echo "$combined" | sha256sum | cut -d' ' -f1)
        echo "${combined_hash:0:10}"
    else
        # Just the code hash (backwards compatible)
        echo "$code_hash"
    fi
}

function get_file_hash() {
    local file_path="$1"
    
    if [[ ! -f "$file_path" ]]; then
        echo "Error: File '$file_path' does not exist" >&2
        return 1
    fi
    
    local file_hash
    file_hash=$(sha256sum "$file_path" | cut -d' ' -f1)
    echo "${file_hash:0:10}"
}

# =============================================================================
# BATCH HASH FUNCTIONS
# =============================================================================

# Need to load this from the parent script or define it here
if ! declare -f get_service_config >/dev/null 2>&1; then
    function get_service_config() {
        local service="$1"
        local field="$2"
        local services_file="${SERVICES_FILE:-$BASE_DIR/config/services.json}"
        
        jq -r ".services[\"$service\"][\"$field\"]" "$services_file" 2>/dev/null || {
            log_error "Service field '$field' not found for: $service"
            return 1
        }
    }
fi

function calculate_all_service_hashes() {
    local services_file="${1:-$SERVICES_FILE}"
    local shared_scripts_hash="${2:-}"
    
    if [[ ! -f "$services_file" ]]; then
        echo "Error: Services file not found: $services_file" >&2
        return 1
    fi
    
    # Suppress logging during hash calculation to avoid ANSI codes in output
    # Only log to stderr if needed for debugging
    
    # First calculate shared-scripts hash if not provided
    if [[ -z "$shared_scripts_hash" ]]; then
        shared_scripts_hash=$(get_directory_hash "scripts")
    fi
    
    # Calculate hash for each service
    local services
    services=$(jq -r '.services | keys[]' "$services_file" 2>/dev/null || true)
    
    for service in $services; do
        if [[ "$service" == "shared-scripts" ]]; then
            echo "$service=$shared_scripts_hash"
            continue
        fi
        
        local service_path
        service_path=$(get_service_config "$service" "path" 2>/dev/null || echo "")
        
        if [[ -n "$service_path" && -d "$BASE_DIR/$service_path" ]]; then
            local service_hash
            service_hash=$(get_service_hash "$BASE_DIR/$service_path" "$shared_scripts_hash")
            echo "$service=$service_hash"
        else
            echo "$service=0000000000"
        fi
    done
}

function generate_env_file() {
    local env_file="${1:-$ENV_FILE}"
    local services_file="${2:-$SERVICES_FILE}"
    
    local temp_env
    temp_env=$(mktemp)
    
    # Header
    cat > "$temp_env" << EOF
# NO EDITAR. Generado automáticamente por pipeline.sh
# Fecha: $(date '+%Y-%m-%d %H:%M:%S')
# Force: ${FORCE_BUILD:-false}

EOF
    
    # Calculate and add hashes
    calculate_all_service_hashes "$services_file" | while IFS='=' read -r service hash; do
        local var_name
        # Convert service name to environment variable format
        var_name=$(echo "$service" | tr '[:lower:]' '[:upper:]' | tr '-' '_')
        echo "${var_name}_HASH=$hash" >> "$temp_env"
    done
    
    # Move temp file to final location
    mv "$temp_env" "$env_file"
    
    echo "Environment file generated: $env_file" >&2
    echo "Contains $(grep -c '_HASH=' "$env_file") service hashes" >&2
}

# =============================================================================
# VALIDATION FUNCTIONS
# =============================================================================

function validate_hash_consistency() {
    local service="$1"
    local expected_hash="$2"
    local service_path="${3:-}"
    
    if [[ -z "$service_path" ]]; then
        service_path=$(get_service_config "$service" "path" 2>/dev/null || echo "")
        service_path="$BASE_DIR/$service_path"
    fi
    
    if [[ ! -d "$service_path" ]]; then
        log_error "Service directory not found: $service_path"
        return 1
    fi
    
    local current_hash
    current_hash=$(get_directory_hash "$service_path")
    
    if [[ "$current_hash" == "$expected_hash" ]]; then
        log_success "Hash validation passed for $service: $current_hash"
        return 0
    else
        log_warning "Hash validation failed for $service: expected $expected_hash, got $current_hash"
        return 1
    fi
}

# =============================================================================
# EXPORT FUNCTIONS
# =============================================================================

export -f is_excluded
export -f normalize_path
export -f get_directory_hash
export -f get_service_hash
export -f get_file_hash
export -f calculate_all_service_hashes
export -f generate_env_file
export -f validate_hash_consistency

# =============================================================================
# END OF FILE
# =============================================================================