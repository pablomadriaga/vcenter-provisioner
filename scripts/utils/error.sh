#!/usr/bin/env bash
# =============================================================================
# error.sh - Professional error handling with context
# =============================================================================
# Error trapping, context, and recovery mechanisms
# =============================================================================

set -euo pipefail

# =============================================================================
# Error Configuration
# =============================================================================

# Error log file
readonly PIPELINE_ERROR_LOG="${PIPELINE_ERROR_LOG:-/tmp/pipeline-errors-$$.log}"

# Error tracking
declare -g ERROR_COUNT=0
declare -g WARNING_COUNT=0

# =============================================================================
# Error Trapping
# =============================================================================

# Setup error trap with context
# Usage: setup_error_trap
setup_error_trap() {
    trap 'error_handler $LINENO $?' ERR
}

# Error handler with full context
# Usage: error_handler $LINENO $?
error_handler() {
    local line=$1
    local exit_code=$2
    local cmd="${BASH_COMMAND}"
    local func="${FUNCNAME[1]:-main}"
    
    ERROR_COUNT=$((ERROR_COUNT + 1))
    
    # Log to file
    {
        echo "=========================================="
        echo "ERROR at line $line in $func"
        echo "Command: $cmd"
        echo "Exit code: $exit_code"
        echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "=========================================="
    } >> "$PIPELINE_ERROR_LOG"
    
    # Log to console if not in test mode
    if [[ "${PIPELINE_QUIET:-false}" != "true" ]]; then
        log_error "Error in $func (line $line): exit code $exit_code"
        log_debug "Command: $cmd"
        log_debug "See $PIPELINE_ERROR_LOG for details"
    fi
    
    # In strict mode, exit immediately
    if [[ "${PIPELINE_STRICT:-false}" == "true" ]]; then
        log_error "Strict mode enabled - exiting"
        exit $exit_code
    fi
}

# =============================================================================
# Warning Handler
# =============================================================================

# Track warnings
warning_handler() {
    local line=$1
    local cmd="${BASH_COMMAND}"
    
    WARNING_COUNT=$((WARNING_COUNT + 1))
    
    log_debug "Warning at line $line: $cmd"
}

# =============================================================================
# Error Recovery
# =============================================================================

# Try-catch like pattern
# Usage: try; command; catch { handle_error; }
try() {
    local error_var="${1:-ERROR_VAR}"
    eval "$*" 2>/dev/null
    local status=$?
    eval "$error_var=$status"
    return $status
}

# Catch errors
catch() {
    local error_var="${1:-ERROR_VAR}"
    local handler="${2:-default_handler}"
    
    if [[ "${!error_var}" -ne 0 ]]; then
        eval "$handler"
    fi
}

# Default error handler
default_handler() {
    log_warning "An error occurred, continuing..."
}

# =============================================================================
# Assert Functions
# =============================================================================

# Assert that a command succeeds
# Usage: assert "docker ps" "Docker must be running"
assert() {
    local cmd="$1"
    local message="${2:-Command failed: $cmd}"
    
    if ! eval "$cmd" &>/dev/null; then
        log_error "$message"
        return 1
    fi
    return 0
}

# Assert that a value is not empty
# Usage: assert_not_empty "$var" "Variable must be set"
assert_not_empty() {
    local value="$1"
    local message="${2:-Value cannot be empty}"
    
    if [[ -z "$value" ]]; then
        log_error "$message"
        return 1
    fi
    return 0
}

# Assert that a file exists
# Usage: assert_file_exists "/path/to/file" "Config file required"
assert_file_exists() {
    local file="$1"
    local message="${2:-File not found: $file}"
    
    if [[ ! -f "$file" ]]; then
        log_error "$message"
        return 1
    fi
    return 0
}

# Assert that a directory exists
# Usage: assert_dir_exists "/path/to/dir" "Working directory required"
assert_dir_exists() {
    local dir="$1"
    local message="${2:-Directory not found: $dir}"
    
    if [[ ! -d "$dir" ]]; then
        log_error "$message"
        return 1
    fi
    return 0
}

# =============================================================================
# Bail Out Functions
# =============================================================================

# Exit with error message
# Usage: bail "Something went wrong" 1
bail() {
    local message="${1:-Unknown error}"
    local code="${2:-1}"
    
    log_error "$message"
    exit $code
}

# Exit if previous command failed
# Usage: bail_on_error $? "Operation failed"
bail_on_error() {
    local code=$1
    local message="${2:-Command failed with exit code $code}"
    
    if [[ $code -ne 0 ]]; then
        bail "$message" $code
    fi
}

# =============================================================================
# Error Summary
# =============================================================================

# Show error summary
# Usage: show_error_summary
show_error_summary() {
    if [[ $ERROR_COUNT -gt 0 ]]; then
        log_warning "Errors encountered: $ERROR_COUNT"
        if [[ -f "$PIPELINE_ERROR_LOG" ]]; then
            log_info "Error log: $PIPELINE_ERROR_LOG"
        fi
    fi
    
    if [[ $WARNING_COUNT -gt 0 ]]; then
        log_warning "Warnings: $WARNING_COUNT"
    fi
}

# Clear error log
# Usage: clear_error_log
clear_error_log() {
    if [[ -f "$PIPELINE_ERROR_LOG" ]]; then
        rm -f "$PIPELINE_ERROR_LOG"
    fi
    ERROR_COUNT=0
    WARNING_COUNT=0
}

# =============================================================================
# Export Functions
# =============================================================================

export -f setup_error_trap
export -f error_handler
export -f warning_handler
export -f try
export -f catch
export -f default_handler
export -f assert
export -f assert_not_empty
export -f assert_file_exists
export -f assert_dir_exists
export -f bail
export -f bail_on_error
export -f show_error_summary
export -f clear_error_log

# =============================================================================
# END OF FILE
# =============================================================================
