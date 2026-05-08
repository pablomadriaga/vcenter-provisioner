#!/usr/bin/env bash
# =============================================================================
# probe-scheduler.sh - Probeador de Red para Monitoreo
# =============================================================================
# ENVÍA RESULTADOS DE PROBES AL MONITORING-SERVICE
# =============================================================================
# USO:
#   ./probe-scheduler.sh <interval_seconds> <monitoring_url> [mode] [sample_count] [targets]
#
# ARGUMENTOS:
#   interval_seconds  - Intervalo entre ejecuciones (default: 5)
#   monitoring_url   - URL del monitoring-service (default: http://monitoring-service:8082)
#   mode             - 'full' o 'sample' (default: full)
#   sample_count      - N servicios a probe en modo sample (default: 3)
#   targets          - Lista de servicios a probear (default: todos, separados por coma)
#
# EJEMPLOS:
#   ./probe-scheduler.sh 5 http://monitoring-service:8082 full           # Gateway
#   ./probe-scheduler.sh 20 http://monitoring-service:8082 sample 3     # Sampling
#   ./probe-scheduler.sh 20 http://monitoring-service:8082 full "" "api-gateway,auth-service"  # Targets específicos
#
# VARIABLES DE ENTORNO:
#   PROBE_INTERVAL    - Override de interval_seconds
#   PROBE_MODE        - Override de mode
#   PROBE_SAMPLE_COUNT - Override de sample_count
#   PROBE_TARGETS     - Override de targets
#   MONITORING_URL    - Override de monitoring_url
# =============================================================================

set -euo pipefail

# Configuración desde argumentos o variables de entorno
INTERVAL="${PROBE_INTERVAL:-${1:-5}}"
MONITORING_URL="${MONITORING_URL:-${2:-http://monitoring-service:8082}}"
MODE="${PROBE_MODE:-${3:-full}}"
SAMPLE_COUNT="${PROBE_SAMPLE_COUNT:-${4:-3}}"
TARGETS_ARG="${PROBE_TARGETS:-${5:-}}"

HOSTNAME="${HOSTNAME:-$(hostname)}"

# Lista completa de servicios (solo para referencia, no se usa si TARGETS_ARG está definido)
ALL_SERVICES=(
    "api-gateway:3000"
    "auth-service:3001"
    "typing-service:8000"
    "vm-orchestrator:8080"
    "vcenter-operations:8091"
    "credential-manager:8090"
    "stats-service:8001"
    "monitoring-service:8082"
    "backup-service:8002"
    "provisioner-ui:80"
)

# Construir lista de targets
get_targets() {
    if [ -n "$TARGETS_ARG" ]; then
        # Usar lista explícita de targets
        echo "$TARGETS_ARG" | tr ',' '\n' | tr -d ' '
    else
        # Modo full: usar todos los servicios
        for svc in "${ALL_SERVICES[@]}"; do
            echo "$svc" | cut -d':' -f1
        done
    fi
}

# Obtener puerto de un servicio
get_port() {
    local svc_name="$1"
    for svc in "${ALL_SERVICES[@]}"; do
        if [[ "$svc" == "${svc_name}:"* ]]; then
            echo "$svc" | cut -d':' -f2
            return
        fi
    done
    echo "3000"  # Default
}

# Seleccionar N servicios aleatorios (excluyendo self)
sample_targets() {
    local all_targets=("$@")
    local self="${HOSTNAME%%-*}"  # Extraer nombre sin sufijo numérico
    local filtered=()

    # Filtrar self
    for target in "${all_targets[@]}"; do
        local target_base="${target%%-[0-9]*}"  # Normalizar (provisioner-ui-1 -> provisioner-ui)
        if [[ "$target" != "$self"* ]] && [[ "$target_base" != "$self" ]]; then
            filtered+=("$target")
        fi
    done

    # Si hay menos de sample_count, usar todos
    if [ ${#filtered[@]} -le "$SAMPLE_COUNT" ]; then
        printf '%s\n' "${filtered[@]}"
        return
    fi

    # Fisher-Yates shuffle y tomar sample_count
    local n=${#filtered[@]}
    for ((i=n-1; i>0; i--)); do
        local j=$((RANDOM % (i+1)))
        local tmp="${filtered[i]}"
        filtered[i]="${filtered[j]}"
        filtered[j]="$tmp"
    done

    for ((i=0; i<SAMPLE_COUNT; i++)); do
        echo "${filtered[i]}"
    done
}

# Función para hacer probe a un servicio
probe_service() {
    local service_host="$1"
    local service_port="$2"

    local start_time=$(python3 -c 'import time; print(int(time.time() * 1000))' 2>/dev/null || date +%s 2>/dev/null)
    local status="down"
    local latency=0
    local error_msg=""

    # Hacer curl con timeout (--fail-with-body preserva HTTP code real en output)
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --fail-with-body --connect-timeout 2 --max-time 5 "http://${service_host}:${service_port}/health" 2>&1) || http_code="000"

    local end_time=$(python3 -c 'import time; print(int(time.time() * 1000))' 2>/dev/null || date +%s 2>/dev/null)
    latency=$(( end_time - start_time ))

    # Verificar HTTP 200 o respuesta JSON con status ok
    if [ "$http_code" = "200" ]; then
        status="up"
    else
        status="down"
        error_msg="HTTP $http_code"
        if [ -z "$error_msg" ]; then
            error_msg="timeout or connection refused"
        fi
    fi

    # Enviar resultado al monitoring-service
    send_probe_result "$service_host" "$status" "$latency" "$error_msg"
}

# Función para enviar resultado al monitoring-service
send_probe_result() {
    local target="$1"
    local status="$2"
    local latency="$3"
    local error_msg="$4"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    local payload=$(cat <<EOF
{
    "source": "${HOSTNAME}",
    "target": "${target}",
    "latency_ms": ${latency},
    "status": "${status}",
    "error_message": "${error_msg}",
    "timestamp": "${timestamp}"
}
EOF
)

    # Enviar con retry
    local max_retries=3
    local retry=0
    local success=false

    while [ $retry -lt $max_retries ]; do
        if curl -sf -X POST "${MONITORING_URL}/api/probe-result" \
            -H "Content-Type: application/json" \
            -d "$payload" > /dev/null 2>&1; then
            success=true
            break
        fi
        retry=$((retry + 1))
        sleep 1
    done

    if [ "$success" = true ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ ${target}: ${status} (${latency}ms)"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ ${target}: ${status} (${latency}ms) - failed to send" >&2
    fi
}

# Función principal del probe
run_probes() {
    local pids=()

    # Obtener lista de targets
    local targets
    targets=$(get_targets)

    if [ "$MODE" = "sample" ]; then
        # Modo sampling: seleccionar N aleatorios
        local targets_array=()
        while IFS= read -r line; do
            targets_array+=("$line")
        done <<< "$targets"
        targets=$(sample_targets "${targets_array[@]}")
    fi

    # Ejecutar probes en paralelo
    while IFS= read -r service; do
        if [ -n "$service" ]; then
            local port
            port=$(get_port "$service")
            probe_service "$service" "$port" &
            pids+=($!)
        fi
    done <<< "$targets"

    # Esperar a todos los probes
    for pid in "${pids[@]}"; do
        wait "$pid" 2>/dev/null || true
    done
}

# Loop principal
main() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚀 Probe scheduler started (interval: ${INTERVAL}s, mode: ${MODE}, sample: ${SAMPLE_COUNT})"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📡 Monitoring: ${MONITORING_URL}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🏠 Hostname: ${HOSTNAME}"

    while true; do
        run_probes
        sleep "$INTERVAL"
    done
}

main
