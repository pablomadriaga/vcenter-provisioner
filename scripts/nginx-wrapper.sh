#!/bin/sh
# =============================================================================
# nginx-wrapper.sh - Entrypoint para nginx con Probe Scheduler
# =============================================================================
# Uso para provisioner-ui (nginx-unprivileged)
# =============================================================================

set -e

# Lee configuración de probes desde variables de entorno
PROBE_INTERVAL="${PROBE_INTERVAL:-300}"
PROBE_MODE="${PROBE_MODE:-sample}"
PROBE_SAMPLE_COUNT="${PROBE_SAMPLE_COUNT:-3}"
PROBE_TARGETS="${PROBE_TARGETS:-}"
MONITORING_URL="${MONITORING_URL:-http://monitoring-service:8082}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚀 Starting nginx with probe scheduler..."
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📡 Mode: ${PROBE_MODE}, Interval: ${PROBE_INTERVAL}s"

# Iniciar probe scheduler en background
if [ -f "/probe-scheduler.sh" ]; then
    if [ -n "$PROBE_TARGETS" ]; then
        /probe-scheduler.sh "$PROBE_INTERVAL" "$MONITORING_URL" "$PROBE_MODE" "$PROBE_SAMPLE_COUNT" "$PROBE_TARGETS" &
    else
        /probe-scheduler.sh "$PROBE_INTERVAL" "$MONITORING_URL" "$PROBE_MODE" "$PROBE_SAMPLE_COUNT" &
    fi
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
    nginx -s quit 2>/dev/null || true
    exit 0
}

trap cleanup SIGTERM SIGINT

# Iniciar nginx en foreground
exec nginx -g "daemon off;"
