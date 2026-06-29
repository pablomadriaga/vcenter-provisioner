#!/usr/bin/env bash
# =============================================================================
# go-wrapper.sh - Entrypoint para servicios Go con Probe Scheduler
# =============================================================================
# Configuración de probes desde variables de entorno:
#   PROBE_INTERVAL     - Intervalo entre probes (default: 5)
#   PROBE_MODE         - 'full' o 'sample' (default: full)
#   PROBE_SAMPLE_COUNT - N servicios a probe en modo sample (default: 3)
#   PROBE_TARGETS      - Lista de targets (opcional, separados por coma)
#   MONITORING_URL     - URL del monitoring-service (default: http://monitoring-service:8082)
# =============================================================================

set -e

# Configuración de probes
PROBE_INTERVAL="${PROBE_INTERVAL:-5}"
PROBE_MODE="${PROBE_MODE:-full}"
PROBE_SAMPLE_COUNT="${PROBE_SAMPLE_COUNT:-3}"
PROBE_TARGETS="${PROBE_TARGETS:-}"
MONITORING_URL="${MONITORING_URL:-http://monitoring-service:8082}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚀 Starting with probe scheduler..."
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📡 Mode: ${PROBE_MODE}, Interval: ${PROBE_INTERVAL}s"

# Iniciar probe scheduler en background
if [ -f "/probe-scheduler.sh" ]; then
    if [ -n "$PROBE_TARGETS" ]; then
        # Modo con lista explícita de targets
        /probe-scheduler.sh "$PROBE_INTERVAL" "$MONITORING_URL" "$PROBE_MODE" "$PROBE_SAMPLE_COUNT" "$PROBE_TARGETS" &
    else
        # Modo automático
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
    exit 0
}

trap cleanup SIGTERM SIGINT

# Ejecutar el servicio principal
exec /app/service
