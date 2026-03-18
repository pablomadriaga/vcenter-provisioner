#!/usr/bin/env bash
# =============================================================================
# retry.sh - Retry utilities with exponential backoff
# =============================================================================

set -euo pipefail

# Retry with exponential backoff
# Usage: retry_with_backoff 5 1 32 "command"
retry_with_backoff() {
    local max="${1:-5}" delay="${2:-1}" max_delay="${3:-32}" cmd="$4"
    shift 4 || true
    local attempt=1
    while [[ $attempt -le $max ]]; do
        if eval "$cmd" "$@" 2>/dev/null; then return 0; fi
        local d=$((delay * 2 ** (attempt - 1)))
        [[ $d -gt $max_delay ]] && d=$max_delay
        [[ $attempt -lt $max ]] && sleep $d
        ((attempt++)) || true
    done
    return 1
}

# Retry with timeout per attempt
# Usage: retry_with_timeout 30 5 1 8 "command"
retry_with_timeout() {
    local timeout="${1:-30}" max="${2:-5}" delay="${3:-1}" max_delay="${4:-32}" cmd="$5"
    shift 5 || true
    local attempt=1
    while [[ $attempt -le $max ]]; do
        if timeout "$timeout" bash -c "$cmd" "$@" 2>/dev/null; then return 0; fi
        local d=$((delay * 2 ** (attempt - 1)))
        [[ $d -gt $max_delay ]] && d=$max_delay
        [[ $attempt -lt $max ]] && sleep $d
        ((attempt++)) || true
    done
    return 1
}

# Common patterns
retry_db()   { local cmd="$1"; retry_with_backoff 30 1 8 "$cmd"; }
retry_docker() { local cmd="$1"; retry_with_backoff 10 1 4 "$cmd"; }
retry_http() { local cmd="$1"; retry_with_backoff 5 2 16 "$cmd"; }

export -f retry_with_backoff
export -f retry_with_timeout
export -f retry_db
export -f retry_docker
export -f retry_http
