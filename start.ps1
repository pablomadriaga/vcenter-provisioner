#!/usr/bin/env pwsh
# =============================================================================
# start.ps1 - DEPRECADO
# =============================================================================
# ⚠️  ESTE SCRIPT ESTÁ DEPRECADO
# =============================================================================
# USA pipeline.ps1 EN SU LUGAR:
#   .\pipeline.ps1 --up      # Levantar servicios
#   .\pipeline.ps1 --down    # Bajar servicios
#   .\pipeline.ps1 --status  # Ver estado
# =============================================================================

[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$Build,
    [switch]$Status,
    [switch]$Down,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Red
Write-Host "  ⚠️  DEPRECADO" -ForegroundColor Red
Write-Host ("=" * 70) -ForegroundColor Red
Write-Host ""
Write-Host "  start.ps1 ya no se mantiene." -ForegroundColor Yellow
Write-Host ""
Write-Host "  USA pipeline.ps1:" -ForegroundColor Cyan
Write-Host ""
Write-Host "    .\pipeline.ps1 --up      # Levantar servicios" -ForegroundColor Gray
Write-Host "    .\pipeline.ps1 --down    # Bajar servicios" -ForegroundColor Gray
Write-Host "    .\pipeline.ps1 --status  # Ver estado" -ForegroundColor Gray
Write-Host ""
Write-Host "  BENEFICIOS:" -ForegroundColor Cyan
Write-Host "    - Un solo punto de entrada" -ForegroundColor Gray
Write-Host "    - Mismas funciones de logging" -ForegroundColor Gray
Write-Host "    - Mejores mensajes de error" -ForegroundColor Gray
Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Red
Write-Host ""

exit 0

function Write-Section {
    param([string]$Message)
    Write-Host "`n$Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "  ℹ️  $Message" -ForegroundColor Gray
}

function Write-Success {
    param([string]$Message)
    Write-Host "  ✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "  ⚠️  $Message" -ForegroundColor DarkYellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "  ❌ $Message" -ForegroundColor Red
}

# Cargar configuracion
$script:SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:BASE_DIR = $SCRIPT_DIR
$script:COMPOSE_FILE = Join-Path $BASE_DIR "infra/local/docker-compose.yml"
$script:ENV_FILE = Join-Path $BASE_DIR ".env.ci"

function Write-Banner {
    param([string]$Message)
    Write-Host "`n" -NoNewline
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host "  $Message" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
}

function Show-Help {
    Write-Host @"

USO:
    .\start.ps1              # Levantar servicios
    .\start.ps1 --build      # Build si falta .env.ci
    .\start.ps1 --force      # Reconstruir todo
    .\start.ps1 --status     # Ver estado
    .\start.ps1 --down       # Bajar servicios
    .\start.ps1 --help       # Esta ayuda

QUE HACE:
    1. Valida prerrequisitos (Docker)
    2. Genera .env.ci si falta (hashes deterministas)
    3. Verifica que imagenes existan
    4. Levanta contenedores

"@
}

function Test-Docker {
    Write-Info "Validando Docker..."
    try {
        $output = docker version 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Docker no esta disponible"
            Write-Host ""
            Write-Host "SOLUCION:" -ForegroundColor Yellow
            Write-Host "  1. Instala Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor Gray
            Write-Host "  2. Inicia Docker Desktop (espera icono verde)" -ForegroundColor Gray
            Write-Host "  3. Vuelve a ejecutar .\start.ps1" -ForegroundColor Gray
            return $false
        }
        Write-Success "Docker disponible"
        return $true
    }
    catch {
        Write-Error "Docker no esta ejecutandose"
        Write-Host ""
        Write-Host "SOLUCION:" -ForegroundColor Yellow
        Write-Host "  1. Abre Docker Desktop" -ForegroundColor Gray
        Write-Host "  2. Espera a que el icono este verde" -ForegroundColor Gray
        Write-Host "  3. Vuelve a ejecutar .\start.ps1" -ForegroundColor Gray
        return $false
    }
}

function Get-EnvCiHashes {
    if (-not (Test-Path $script:ENV_FILE)) { return $null }

    $hashes = @{}
    Get-Content $script:ENV_FILE | ForEach-Object {
        if ($_ -match '^([^=]+)=(.+)$') {
            $hashes[$matches[1]] = $matches[2]
        }
    }
    return $hashes
}

function New-EnvCiIfMissing {
    if (Test-Path $script:ENV_FILE) {
        Write-Info ".env.ci ya existe"
        return $true
    }

    Write-Warning ".env.ci no encontrado"
    Write-Host ""
    Write-Host "OPCIONES:" -ForegroundColor Yellow
    Write-Host "  1. Generar .env.ci ahora (recomendado)" -ForegroundColor Gray
    Write-Host "  2. Ejecutar .\pipeline.ps1 --build" -ForegroundColor Gray
    Write-Host ""

    $response = Read-Host "Generar .env.ci? (S/n)"
    if ($response -eq 'n' -or $response -eq 'N') {
        Write-Host ""
        Write-Host "Para generar .env.ci, ejecuta:" -ForegroundColor Cyan
        Write-Host "  .\pipeline.ps1 --build" -ForegroundColor Gray
        exit 0
    }

    # Generar .env.ci automaticamente
    Write-Host ""
    Write-Section "Generando .env.ci..."

    # Cargar hash.ps1
    $hashScript = Join-Path $SCRIPT_DIR "scripts/ci/hash.ps1"
    if (-not (Test-Path $hashScript)) {
        Write-Error "No encontrado: $hashScript"
        return $false
    }

    . $hashScript

    # Cargar servicios
    $configDir = Join-Path $SCRIPT_DIR "config"
    . "$configDir/services.ps1"

    $lines = @("# Generado por start.ps1")
    $lines += "# $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $lines += ""

    foreach ($serviceName in $global:SERVICES.Keys) {
        $service = $global:SERVICES[$serviceName]
        $servicePath = Join-Path $BASE_DIR $service.Path
        $hash = Get-DirectoryHash -Path $servicePath
        $envVar = "$($serviceName.ToUpper().Replace('-', '_'))_HASH=$hash"
        $lines += $envVar
        Write-Info $envVar
    }

    $lines | Out-File -FilePath $script:ENV_FILE -Encoding UTF8
    Write-Success ".env.ci generado: $script:ENV_FILE"
    return $true
}

function Test-Images {
    param([hashtable]$Hashes)

    if (-not $Hashes) {
        Write-Warning "No hay hashes definidos"
        return $false
    }

    $missing = @()
    foreach ($key in $Hashes.Keys) {
        $hash = $Hashes[$key]
        $rawName = $key.ToLower().Replace('_hash', '')
        $serviceName = $rawName.Replace('_', '-')
        $tag = "antigravity/$serviceName`:$hash"

        $exists = docker images -q $tag 2>$null
        if (-not $exists) {
            $missing += $serviceName
            Write-Warning "Falta: $tag"
        }
    }

    if ($missing.Count -gt 0) {
        Write-Host ""
        Write-Host "SOLUCION:" -ForegroundColor Yellow
        Write-Host "  .\pipeline.ps1 --build" -ForegroundColor Gray
        Write-Host "  O" -ForegroundColor Gray
        Write-Host "  .\start.ps1 --build" -ForegroundColor Gray
        return $false
    }

    Write-Success "Todas las imagenes existen"
    return $true
}

function Start-Services {
    Write-Section "Levantando servicios..."
    Write-Info "Esperando healthchecks..."

    $output = docker compose -f $script:COMPOSE_FILE --env-file $script:ENV_FILE up -d --wait 2>&1
    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        Write-Error "Error al levantar servicios"
        Write-Host $output
        Write-Host ""
        Write-Warning "Mostrando logs de contenedores con problemas:"
        docker compose -f $script:COMPOSE_FILE logs --tail=20
        return $false
    }

    Write-Success "Servicios levantados"
    Write-Host ""
    Write-Host "Servicios:" -ForegroundColor Cyan

    $status = docker compose -f $script:COMPOSE_FILE ps --format "table {{.Service}}\t{{.Status}}"

    $failed = @()
    foreach ($line in $status) {
        if ($line -match '(provisioner-ui|api-gateway|auth-service|typing-service|vm-orchestrator|vcenter-integration|vcenter-config|stats-service|monitoring-service|backup-service).*\t(Restarting|Fcreated|Pulled|Exited)' -or
            $line -match '(provisioner-ui|api-gateway|auth-service|typing-service|vm-orchestrator|vcenter-integration|vcenter-config|stats-service|monitoring-service|backup-service).*\t(Up.*\(unhealthy\)|removing)') {
            $failed += $matches[1]
            Write-Host $line -ForegroundColor Red
        }
        else {
            Write-Host $line -ForegroundColor $(if ($line -match 'Up.*healthy') { "Green" } else { "Gray" })
        }
    }

    if ($failed.Count -gt 0) {
        Write-Host ""
        Write-Error "Contenedores con problemas: $($failed -join ', ')"
        Write-Host ""
        Write-Host "Para ver detalles:" -ForegroundColor Yellow
        Write-Host "  docker compose -f infra/local/docker-compose.yml logs <servicio>" -ForegroundColor Gray
        return $false
    }

    Write-Host ""
    Write-Host "UI: http://localhost:5173" -ForegroundColor Cyan
    Write-Host "API: http://localhost:3000" -ForegroundColor Cyan

    return $true
}

function Show-Status {
    Write-Section "Estado de Servicios"
    docker compose -f $script:COMPOSE_FILE ps
}

function Stop-Services {
    Write-Warning "Este comando está deprecado."
    Write-Info "Usa 'pipeline.ps1 --cleanup' en su lugar."
    Write-Host ""
    
    Write-Section "Deteniendo Servicios..."
    docker compose -f $script:COMPOSE_FILE down
    Write-Success "Servicios detenidos"
}

function Main {
    if ($Help) {
        Show-Help
        exit 0
    }

    Write-Banner "vCenter Provisioner - Start"

    # Status
    if ($Status) {
        Show-Status
        exit 0
    }

    # Down
    if ($Down) {
        Stop-Services
        exit 0
    }

    # Force = build + start
    if ($Force) {
        Write-Section "Reconstruyendo todo..."
        $buildResult = & "$SCRIPT_DIR/pipeline.ps1" --build
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Build falló"
            exit 1
        }
    }

    # Build solo
    if ($Build) {
        $buildResult = & "$SCRIPT_DIR/pipeline.ps1" --build
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Build falló"
            exit 1
        }
        Write-Success "Build completado"
        exit 0
    }

    # Validar Docker
    $dockerOk = Test-Docker
    if (-not $dockerOk) { exit 1 }

    # Generar .env.ci si falta
    $envResult = New-EnvCiIfMissing
    if (-not $envResult) { exit 1 }

    # Verificar imagenes
    $hashes = Get-EnvCiHashes
    $imagesOk = Test-Images -Hashes $hashes
    if (-not $imagesOk) {
        Write-Host ""
        $response = Read-Host "Deseas construir las imagenes ahora? (S/n)"
        if ($response -eq 's' -or $response -eq 'S' -or $response -eq '') {
            $buildResult = & "$SCRIPT_DIR/pipeline.ps1" --build
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Build falló"
                exit 1
            }
        }
        else {
            Write-Host "Ejecuta .\pipeline.ps1 --build para construir imagenes"
            exit 0
        }
    }

    # Levantar
    $startResult = Start-Services
    exit $(if ($startResult) { 0 } else { 1 })
}

Main
