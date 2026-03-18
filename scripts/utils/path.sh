#!/usr/bin/env bash
# =============================================================================
# path.sh - Path utilities with safe navigation
# =============================================================================

set -euo pipefail

# =============================================================================
# Safe Directory Change
# =============================================================================

# Change to directory with proper error handling
# Usage: safe_cd "/path/to/dir" || return 1
safe_cd() {
    local dir="$1"
    
    if [[ ! -d "$dir" ]]; then
        log_error "Directory does not exist: $dir"
        return 1
    fi
    
    if ! cd "$dir" 2>/dev/null; then
        log_error "Cannot change to directory: $dir"
        log_debug "Check permissions for: $dir"
        return 1
    fi
    
    return 0
}

# Change to directory with fallback
# Usage: safe_cd_with_fallback "/preferred/path" "/fallback/path"
safe_cd_with_fallback() {
    local primary="$1"
    local fallback="$2"
    
    if safe_cd "$primary"; then
        return 0
    elif safe_cd "$fallback"; then
        log_warning "Fell back to: $fallback"
        return 0
    else
        log_error "Cannot change to either directory: $primary or $fallback"
        return 1
    fi
}

# =============================================================================
# Directory Existence and Creation
# =============================================================================

# Create directory if it doesn't exist
# Usage: ensure_dir "/path/to/dir"
ensure_dir() {
    local dir="$1"
    
    if [[ ! -d "$dir" ]]; then
        log_debug "Creating directory: $dir"
        mkdir -p "$dir"
    fi
}

# Create temporary directory and return path
# Usage: tmpdir=$(make_temp_dir "pipeline-")
make_temp_dir() {
    local prefix="${1:-temp-}"
    mktemp -d "/tmp/${prefix}.XXXXXX"
}

# =============================================================================
# File Operations
# =============================================================================

# Check if file exists and is readable
# Usage: assert_readable "/path/to/file" || exit 1
assert_readable() {
    local file="$1"
    
    if [[ ! -f "$file" ]]; then
        log_error "File not found: $file"
        return 1
    fi
    
    if [[ ! -r "$file" ]]; then
        log_error "File not readable: $file"
        return 1
    fi
    
    return 0
}

# Check if file exists and is writable
# Usage: assert_writable "/path/to/file" || exit 1
assert_writable() {
    local file="$1"
    
    if [[ ! -f "$file" ]]; then
        # Try to create it
        touch "$file" 2>/dev/null || {
            log_error "Cannot create or write to: $file"
            return 1
        }
    elif [[ ! -w "$file" ]]; then
        log_error "File not writable: $file"
        return 1
    fi
    
    return 0
}

# =============================================================================
# Path Utilities
# =============================================================================

# Get absolute path
# Usage: abs_path=$(get_absolute_path "./relative/path")
get_absolute_path() {
    local path="$1"
    
    if [[ -d "$path" ]]; then
        cd "$path" && pwd
    elif [[ -f "$path" ]]; then
        local dir=$(dirname "$path")
        local file=$(basename "$path")
        local abs_dir
        abs_dir=$(cd "$dir" && pwd)
        echo "$abs_dir/$file"
    else
        echo "$path"
    fi
}

# Get relative path from base
# Usage: rel_path=$(get_relative_path "/base/dir" "/target/dir")
get_relative_path() {
    local base="$1"
    local target="$2"
    
    # Normalize paths
    base=$(cd "$base" 2>/dev/null && pwd)
    target=$(cd "$target" 2>/dev/null && pwd)
    
    if [[ -z "$base" || -z "$target" ]]; then
        echo "$target"
        return
    fi
    
    # Simple approach for common cases
    if [[ "$target" == "$base"/* ]]; then
        echo "${target#$base/}"
    else
        echo "$target"
    fi
}

# Get filename without extension
# Usage: name=$(get_basename "file.txt")
get_basename() {
    local file="$1"
    basename "$file" | sed 's/\.[^.]*$//'
}

# Get file extension
# Usage: ext=$(get_extension "file.txt")
get_extension() {
    local file="$1"
    echo "${file##*.}"
}

# =============================================================================
# Export Functions
# =============================================================================

export -f safe_cd
export -f safe_cd_with_fallback
export -f ensure_dir
export -f make_temp_dir
export -f assert_readable
export -f assert_writable
export -f get_absolute_path
export -f get_relative_path
export -f get_basename
export -f get_extension

# =============================================================================
# END OF FILE
# =============================================================================
