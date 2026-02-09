#!/bin/sh
# =============================================================================
# nginx-wrapper-simple.sh - Entrypoint para nginx (sin Probe Scheduler)
# =============================================================================
# Para provisioner-ui que no necesita probe scheduler
# =============================================================================

set -e

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚀 Starting nginx..."

# Iniciar nginx en foreground
exec nginx -g "daemon off;"
