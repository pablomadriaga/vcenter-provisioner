#!/usr/bin/env sh
# =============================================================================
# wrapper.sh - Entrypoint para servicios Go con Probe Scheduler
# =============================================================================

set -e

# Configuración
PROBE_INTERVAL="${PROBE_INTERVAL:-300}"
MONITORING_URL="${MONITORING_URL:-http://monitoring-service:8082}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚀 Starting with probe scheduler..."

# Iniciar probe scheduler en background
if [ -f "/probe-scheduler.sh" ]; then
    /probe-scheduler.sh "$PROBE_INTERVAL" "$MONITORING_URL" &
    PROBE_PID=$!
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📡 Probe scheduler started (PID: $PROBE_PID)"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  Probe scheduler script not found, skipping..."
fi

# Cleanup al salir
cleanup() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🛑 Shutting down..."
    if [ -n "${PROBE_PID:-}" ]; then
        kill "$PROBE_PID" 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGTERM SIGINT

# Ejecutar el servicio principal
exec /app/service
