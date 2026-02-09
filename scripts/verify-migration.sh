#!/usr/bin/env bash
# verify-migration.sh - Script para verificar la migración Linux
# USO: ./scripts/verify-migration.sh

set -euo pipefail

readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

checks_passed=0
checks_failed=0

function log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

function log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((checks_passed++))
}

function log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((checks_failed++))
}

function check_file() {
    local file=$1
    if [[ -f "$file" ]]; then
        log_success "File exists: $file"
        return 0
    else
        log_error "Missing file: $file"
        return 1
    fi
}

function check_dir() {
    local dir=$1
    if [[ -d "$dir" ]]; then
        log_success "Directory exists: $dir"
        return 0
    else
        log_error "Missing directory: $dir"
        return 1
    fi
}

function check_command() {
    local cmd=$1
    if command -v "$cmd" &> /dev/null; then
        log_success "Command available: $cmd"
        return 0
    else
        log_error "Missing command: $cmd"
        return 1
    fi
}

function check_executable() {
    local file=$1
    if [[ -x "$file" ]]; then
        log_success "Executable: $file"
        return 0
    else
        log_error "Not executable: $file"
        return 1
    fi
}

echo "=========================================="
echo "  vCenter Provisioner - Migration Verify"
echo "=========================================="
echo ""

# 1. Check structure
echo "1. Checking directory structure..."
check_dir "apps"
check_dir "infra/local"
check_dir "config"
check_dir "scripts/ci"
check_dir "docs"
echo ""

# 2. Check critical files
echo "2. Checking critical files..."
check_file "pipeline.sh"
check_file "infra/local/docker-compose.yml"
check_file "config/services.json"
check_file "INVARIANTS.md"
echo ""

# 3. Check executables
echo "3. Checking executables..."
check_executable "pipeline.sh"
echo ""

# 4. Check commands
echo "4. Checking required commands..."
check_command "docker"
check_command "docker-compose"
check_command "git"
check_command "curl"
echo ""

# 5. Check Docker
echo "5. Checking Docker..."
if docker info &> /dev/null; then
    log_success "Docker is running"
else
    log_error "Docker is not running"
fi
echo ""

# 6. Check pipeline.sh syntax
echo "6. Checking pipeline.sh..."
if bash -n pipeline.sh 2>/dev/null; then
    log_success "pipeline.sh has valid syntax"
else
    log_error "pipeline.sh has syntax errors"
fi
echo ""

# 7. Summary
echo "=========================================="
echo "  Summary"
echo "=========================================="
echo "Checks passed: $checks_passed"
echo "Checks failed: $checks_failed"
echo ""

if [[ $checks_failed -eq 0 ]]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run: ./pipeline.sh --validate"
    echo "  2. Run: ./pipeline.sh --lint"
    echo "  3. Run: ./pipeline.sh"
    exit 0
else
    echo -e "${RED}❌ Some checks failed.${NC}"
    echo "Please fix the issues above before continuing."
    exit 1
fi
