#!/usr/bin/env bash
# =============================================================================
# parallel.sh - Parallel execution utilities
# =============================================================================
# Parallel execution utilities with proper error handling
# =============================================================================

set -euo pipefail

# =============================================================================
# Logging Fallbacks (in case error.sh not loaded)
# =============================================================================

# Silent logging fallbacks
_log_debug() { :; }
_log_warning() { echo "WARNING: $1" >&2; }
_log_error() { echo "ERROR: $1" >&2; }
_log_progress() { :; }

# Use external logging if available
if declare -f log_debug &>/dev/null; then
    _log_debug() { log_debug "$@"; }
    _log_warning() { log_warning "$@"; }
    _log_error() { log_error "$@"; }
fi

# =============================================================================
# Parallel Execution
# =============================================================================

# Execute commands in parallel and collect results
# Usage: parallel_exec "cmd %s" "arg1" "arg2" "arg3"
# Returns: Number of failed commands
parallel_exec() {
    local cmd_template="$1"
    shift || true
    local pids=()
    local failed=0
    local total=${#@}
    local current=0
    
    # Launch all commands in background
    for arg in "$@"; do
        local cmd
        cmd=$(printf "$cmd_template" "$arg")
        eval "$cmd" &>/dev/null &
        pids+=($!)
        ((current++)) || true
        _log_debug "Started process ${pids[-1]} for: $arg"
    done
    
    # Wait for all and check results
    for pid in "${pids[@]}"; do
        if ! wait "$pid"; then
            ((failed++)) || true
            _log_warning "Process $pid failed"
        fi
    done
    
    _log_debug "Parallel execution: $((total - failed))/$total succeeded"
    return $failed
}

# Execute commands in parallel with concurrency limit
# Usage: parallel_with_limit 4 "cmd %s" "arg1" "arg2" ...
parallel_with_limit() {
    local max_jobs="${1:-4}"
    local cmd_template="$2"
    shift 2 || true
    local pids=()
    local failed=0
    
    for arg in "$@"; do
        local cmd
        cmd=$(printf "$cmd_template" "$arg")
        
        # Wait if we've reached max jobs
        while [[ ${#pids[@]} -ge $max_jobs ]]; do
            for i in "${!pids[@]}"; do
                if ! kill -0 "${pids[i]}" 2>/dev/null; then
                    if ! wait "${pids[i]}"; then
                        ((failed++)) || true
                    fi
                    unset 'pids[i]' || true
                fi
            done
        done
        
        # Launch new job
        eval "$cmd" &>/dev/null &
        pids+=($!)
        _log_debug "Job ${pids[-1]} started (${#pids[@]}/$max_jobs)"
    done
    
    # Wait for remaining jobs
    for pid in "${pids[@]}"; do
        if ! wait "$pid"; then
            ((failed++)) || true
        fi
    done
    
    return $failed
}

# =============================================================================
# Batch Operations
# =============================================================================

# Apply operation to batch of items
# Usage: batch_apply "echo %s" "item1" "item2" "item3"
batch_apply() {
    local cmd_template="$1"
    shift || true
    local total=${#@}
    local current=0
    
    for item in "$@"; do
        ((current++)) || true
        local cmd
        cmd=$(printf "$cmd_template" "$item")
        eval "$cmd"
    done
    
    _log_debug "Batch apply completed: $total items"
}

# Apply operation to batch with error collection
# Usage: errors=($(batch_with_errors "might-fail %s" "risky1" "risky2"))
batch_with_errors() {
    local cmd_template="$1"
    shift || true
    local errors=()
    
    for item in "$@"; do
        local cmd
        cmd=$(printf "$cmd_template" "$item")
        if ! eval "$cmd" &>/dev/null; then
            errors+=("$item")
        fi
    done
    
    printf '%s\n' "${errors[@]}"
}

# =============================================================================
# Execution with Timeout
# =============================================================================

# Execute single command with timeout
# Usage: timed_exec 30 "long-running-command"
timed_exec() {
    local timeout="${1:-30}"
    local cmd="$2"
    shift 2 || true
    
    if timeout "$timeout" bash -c "$cmd" "$@"; then
        return 0
    else
        local exit_code=$?
        if [[ $exit_code -eq 124 ]]; then
            _log_warning "Command timed out after ${timeout}s"
        fi
        return $exit_code
    fi
}

# =============================================================================
# Export Functions
# =============================================================================

export -f parallel_exec
export -f parallel_with_limit
export -f batch_apply
export -f batch_with_errors
export -f timed_exec

# =============================================================================
# END OF FILE
# =============================================================================
