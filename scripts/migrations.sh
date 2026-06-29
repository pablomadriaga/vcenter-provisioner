#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
AUTH_SERVICE_DIR="$BASE_DIR/apps/auth-service"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-vcenter_provisioner}"
DB_USER="${DB_USER:-antigravity}"
DB_PASSWORD="${DB_PASSWORD:?FATAL: DB_PASSWORD environment variable is required}"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { printf '%b\n' "${BLUE}[INFO]${NC} $1"; }
log_success() { printf '%b\n' "${GREEN}[OK]${NC} $1"; }
log_warn() { printf '%b\n' "${YELLOW}[WARN]${NC} $1"; }
log_error() { printf '%b\n' "${RED}[ERROR]${NC} $1" >&2; }

wait_for_db() {
    local max_attempts=30
    local attempt=1

    log_info "Waiting for database to be ready..."
    log_info "Host: $DB_HOST:$DB_PORT, Database: $DB_NAME"

    while [ $attempt -le $max_attempts ]; do
        if docker exec vcenter-provisioner-db psql -U antigravity -d vcenter_provisioner -c "SELECT 1" &>/dev/null; then
            log_success "Database is ready!"
            return 0
        fi
        log_warn "Attempt $attempt/$max_attempts: Database not ready, waiting 2s..."
        sleep 2
        attempt=$((attempt + 1))
    done

    log_error "Database never became ready after $max_attempts attempts"
    return 1
}

run_init_sql() {
    local init_sql_path="$BASE_DIR/infra/local/init.sql"
    
    if [ -f "$init_sql_path" ]; then
        log_info "Found init.sql, executing..."
        docker exec -i vcenter-provisioner-db psql -U "$DB_USER" -d "$DB_NAME" < "$init_sql_path"
        log_success "init.sql executed!"
    else
        log_info "No init.sql found, skipping..."
    fi
}

run_migrations() {
    log_info "Running migrations with node-pg-migrate..."

    cd "$AUTH_SERVICE_DIR"

    log_info "Checking existing migrations..."
    local existing_migrations=$(docker exec vcenter-provisioner-db psql -U antigravity -d vcenter_provisioner -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pgmigrations';" 2>/dev/null || echo "")

    if [ -z "$existing_migrations" ]; then
        log_info "Creating migrations table..."
    fi

    log_info "Executing: node-pg-migrate up"
    DATABASE_URL="$DATABASE_URL" npx node-pg-migrate up

    log_success "Migrations completed!"
}

verify_migrations() {
    log_info "Verifying migrations..."

    local tables=("vcenter_connections" "vcenter_credentials_audit")

    for table in "${tables[@]}"; do
        if docker exec vcenter-provisioner-db psql -U antigravity -d vcenter_provisioner -c "\dt $table" &>/dev/null; then
            log_success "Table exists: $table"
        else
            log_warn "Table not found: $table"
        fi
    done
}

main() {
    printf '\n'
    printf '==========================================\n'
    printf '  Database Migration Runner\n'
    printf '  Using: node-pg-migrate (Best Practice)\n'
    printf '==========================================\n'
    printf '\n'
    log_info "Database URL: $DATABASE_URL"
    log_info "Auth Service: $AUTH_SERVICE_DIR"
    printf '\n'

    if [ ! -d "$AUTH_SERVICE_DIR" ]; then
        log_error "auth-service not found at $AUTH_SERVICE_DIR"
        exit 1
    fi

    if ! wait_for_db; then
        log_error "Failed to connect to database"
        exit 1
    fi

    run_init_sql
    run_migrations
    verify_migrations

    printf '\n'
    log_success "All migrations completed successfully!"
    printf '\n'
}

main "$@"
