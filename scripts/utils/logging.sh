#!/usr/bin/env bash
# =============================================================================
# logging.sh - Terminal colors and logging utilities
# =============================================================================

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

# Symbols
readonly CHECKMARK="✅"
readonly CROSSMARK="❌"
readonly WARNING="⚠️"
readonly INFO="ℹ️"
readonly GEAR="⚙️"

# Logging functions
log_info()    { echo -e "${INFO} $*"; }
log_success() { echo -e "${CHECKMARK} $*"; }
log_error()   { echo -e "${CROSSMARK} $*" >&2; }
log_warning() { echo -e "${WARNING} $*" >&2; }
log_debug()   { [[ "${DEBUG:-}" == "true" ]] && echo -e "[DEBUG] $*" || :; }
log_command() { echo -e "${GEAR} $*"; }

# Banner functions
log_banner() {
    echo ""
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}  $*${NC}"
    echo -e "${CYAN}============================================================================${NC}"
}

log_failure_banner() {
    echo ""
    echo -e "${RED}============================================================================${NC}"
    echo -e "${RED}  $* FAILED${NC}"
    echo -e "${RED}============================================================================${NC}"
}

log_success_banner() {
    echo ""
    echo -e "${GREEN}============================================================================${NC}"
    echo -e "${GREEN}  $* COMPLETED SUCCESSFULLY${NC}"
    echo -e "${GREEN}============================================================================${NC}"
}

log_section() {
    echo ""
    echo -e "${YELLOW}=== $* ===${NC}"
}

log_step() {
    echo -e "${BLUE}[${1}/${2}]${NC} ${3}"
}

# Result logging
log_service_status() {
    local service="$1" status="$2" msg="$3"
    case "$status" in
        up|running|healthy)  echo -e "${GREEN}[${service}]${NC} ${CHECKMARK} ${msg}" ;;
        down|stopped|unhealthy) echo -e "${RED}[${service}]${NC} ${CROSSMARK} ${msg}" ;;
        warning|pending) echo -e "${YELLOW}[${service}]${NC} ${WARNING} ${msg}" ;;
        *) echo "[${service}] ${msg}" ;;
    esac
}

log_test_result() {
    local service="$1" result="$2" details="$3"
    case "$result" in
        pass|passed)  echo -e "${GREEN}[TEST]${NC} ${service}: ${CHECKMARK} ${details}" ;;
        fail|failed) echo -e "${RED}[TEST]${NC} ${service}: ${CROSSMARK} ${details}" ;;
        skip|skipped) echo -e "${YELLOW}[TEST]${NC} ${service}: ${WARNING} ${details}" ;;
        *) echo -e "[TEST] ${service}: ${details}" ;;
    esac
}

log_lint_result() {
    local service="$1" result="$2" details="$3"
    if [[ "$result" == "pass" ]]; then
        echo -e "${GREEN}[LINT]${NC} ${service}: ${CHECKMARK} ${details}"
    else
        echo -e "${RED}[LINT]${NC} ${service}: ${CROSSMARK} ${details}"
    fi
}

log_build_result() {
    local service="$1" result="$2" hash="$3"
    if [[ "$result" == "success" ]]; then
        echo -e "${GREEN}[BUILD]${NC} ${service}: ${CHECKMARK} (${hash})"
    else
        echo -e "${RED}[BUILD]${NC} ${service}: ${CROSSMARK} Failed"
    fi
}

# Timing
log_time() {
    local label="$1" start="$2" end="${3:-$(date +%s)}"
    local dur=$((end - start))
    local h=$((dur / 3600)) m=$(((dur % 3600) / 60)) s=$((dur % 60))
    if [[ $h -gt 0 ]]; then echo "${label}: ${h}h ${m}m ${s}s"
    elif [[ $m -gt 0 ]]; then echo "${label}: ${m}m ${s}s"
    else echo "${label}: ${s}s"; fi
}

log_error_with_context() {
    echo ""
    echo -e "${RED}ERROR: $*${NC}"
    echo ""
}

# Progress bar
log_progress() {
    local cur="$1" tot="$2" msg="$3"
    local pct=$((cur * 100 / tot))
    local bar=$((pct * 50 / 100))
    local empty=$((50 - bar))
    printf "${BLUE}[${pct}%%${NC}] [${bar}=${empty} ] ${msg}"
    [[ "$cur" -eq "$tot" ]] && echo ""
}

export -f log_info
export -f log_success
export -f log_error
export -f log_warning
export -f log_debug
export -f log_command
export -f log_banner
export -f log_failure_banner
export -f log_success_banner
export -f log_section
export -f log_step
export -f log_service_status
export -f log_test_result
export -f log_lint_result
export -f log_build_result
export -f log_time
export -f log_error_with_context
export -f log_progress
