#!/usr/bin/env bash
# MVP Fase 1 - Test Runner (Host Mode Only)
# Uso: run_tests --manifest=<path>

function run_tests() {
    # Validar jq instalado
    if ! command -v jq &>/dev/null; then
        echo "Error: jq no esta instalado" >&2
        return 2
    fi
    
    # Parsear argumentos
    local MANIFEST=""
    for arg in "$@"; do
        case "$arg" in
            --manifest=*)
                MANIFEST="${arg#*=}"
                ;;
        esac
    done
    
    # Validar manifest
    if [[ -z "$MANIFEST" ]]; then
        echo "Error: --manifest es requerido" >&2
        return 2
    fi

    if [[ ! -f "$MANIFEST" ]]; then
        echo "Error: Manifest no encontrado: $MANIFEST" >&2
        return 2
    fi

    # Validar estructura minima
    if ! jq -e '.version' "$MANIFEST" &>/dev/null; then
        echo "Error: Manifest invalido - falta version" >&2
        return 2
    fi

    if ! jq -e '.suites' "$MANIFEST" &>/dev/null; then
        echo "Error: Manifest invalido - falta suites" >&2
        return 2
    fi

    if ! jq -e '.suites | type == "array"' "$MANIFEST" &>/dev/null; then
        echo "Error: Manifest invalido - suites debe ser array" >&2
        return 2
    fi

    # Inicializar resultados
    local START_TIME=$(date +%s%N)
    local TOTAL=0
    local PASSED=0
    local FAILED=0
    local SUITES_JSON="[]"

    # Ejecutar suites
    while IFS= read -r suite; do
        local NAME=$(echo "$suite" | jq -r '.name // empty')
        local SERVICE_PATH=$(echo "$suite" | jq -r '.path // empty')
        local CMD=$(echo "$suite" | jq -r '.command // empty')
        
        # Validar suite
        if [[ -z "$NAME" || -z "$SERVICE_PATH" || -z "$CMD" ]]; then
            echo "Warning: Suite invalida, requiere name, path y command" >&2
            continue
        fi
        
        TOTAL=$((TOTAL + 1))
        
        echo "Ejecutando: $NAME" >&2
        
        local SUITE_START=$(date +%s%N)
        local STATUS="failed"
        
        if [[ -d "$SERVICE_PATH" ]]; then
            if (cd "$SERVICE_PATH" && eval "$CMD" >/dev/null 2>&1); then
                STATUS="passed"
                PASSED=$((PASSED + 1))
                echo "  ✓ $NAME paso" >&2
            else
                FAILED=$((FAILED + 1))
                echo "  ✗ $NAME fallo" >&2
            fi
        else
            FAILED=$((FAILED + 1))
            echo "  ✗ $NAME: directorio no existe" >&2
        fi
        
        local SUITE_END=$(date +%s%N)
        local SUITE_DURATION=$(( (SUITE_END - SUITE_START) / 1000000 ))
        
        # Agregar a suites JSON
        SUITES_JSON=$(echo "$SUITES_JSON" | jq \
            --arg name "$NAME" \
            --arg status "$STATUS" \
            --argjson duration "$SUITE_DURATION" \
            '. + [{name: $name, status: $status, duration_ms: $duration}]')
            
    done < <(jq -c '.suites[]' "$MANIFEST")

    local END_TIME=$(date +%s%N)
    local DURATION=$(( (END_TIME - START_TIME) / 1000000 ))

    # Generar JSON final con jq -n
    jq -n \
        --arg version "1" \
        --arg timestamp "$(date -Iseconds)" \
        --argjson duration "$DURATION" \
        --argjson total "$TOTAL" \
        --argjson passed "$PASSED" \
        --argjson failed "$FAILED" \
        --argjson suites "$SUITES_JSON" \
        '{
            version: $version,
            timestamp: $timestamp,
            duration_ms: $duration,
            summary: {
                total: $total,
                passed: $passed,
                failed: $failed
            },
            suites: $suites
        }'

    # Exit code
    if [[ $FAILED -gt 0 ]]; then
        return 1
    else
        return 0
    fi
}
