#!/usr/bin/env pwsh
# =============================================================================
# run-ci.ps1 - DEPRECATED
# =============================================================================
# ⚠️  ESTE SCRIPT ESTA DEPRECADO
# =============================================================================
# USA: .\pipeline.ps1 --docker
# =============================================================================
# Este script sera eliminado en una version futura.
# Por favor usa pipeline.ps1 como entry point unificado.
#
# EQUIVALENTE NUEVO:
#   .\pipeline.ps1 --docker     # Tests en Docker (determinismo)
#   .\pipeline.ps1 --all        # Todo (lint + test + build)
#   .\pipeline.ps1 --all --docker  # Tests en Docker + cleanup
# =============================================================================

$ErrorActionPreference = "Stop"

$script:startTime = [System.Diagnostics.Stopwatch]::StartNew()

function Write-Banner {
    param([string]$Message)
    Write-Host "`n" -NoNewline
    Write-Host ("=" * 70) -ForegroundColor Cyan
    Write-Host "  $Message" -ForegroundColor Cyan
    Write-Host ("=" * 70) -ForegroundColor Cyan
}

function Write-Section {
    param([string]$Message)
    Write-Host "`n📋 $Message" -ForegroundColor Yellow
}

function Write-Step {
    param(
        [int]$Step,
        [int]$Total,
        [string]$Message
    )
    Write-Host "`n[$Step/$Total] $Message" -ForegroundColor Magenta
}

function Write-Info {
    param([string]$Message)
    Write-Host "  ℹ️  $Message" -ForegroundColor Gray
}

function Write-Success {
    param([string]$Message)
    Write-Host "  ✅ $Message" -ForegroundColor Green
}

function Write-Fail {
    param([string]$Message)
    Write-Host "  ❌ $Message" -ForegroundColor Red
}

function Write-Result {
    param(
        [string]$Name,
        [bool]$Passed,
        [int]$Duration = 0
    )
    if ($Passed) {
        Write-Success "$Name ($(if ($Duration -gt 0) { "${Duration}s" }))"
    } else {
        Write-Fail "$Name ($(if ($Duration -gt 0) { "${Duration}s" }))"
    }
}

function Show-Help {
    Write-Host @"

USO:
    ./run-ci.ps1 [OPCIONES]

OPCIONES:
    --lint-only        Solo ejecutar lint (verificación de arquitectura)
    --test-only        Solo ejecutar tests
    --cleanup          Limpiar contenedores después de ejecutar
    --full             Ejecutar lint + tests + cleanup
    --skip-lint        Saltar verificación de lint
    --skip-tests       Saltar ejecución de tests
    --skip-cleanup     Saltar limpieza final
    --force            No pedir confirmación para cleanup
    -h, --help         Mostrar esta ayuda

EJEMPLOS:
    ./run-ci.ps1                  # Ejecutar lint + tests
    ./run-ci.ps1 --full           # Ejecutar lint + tests + cleanup
    ./run-ci.ps1 --lint-only      # Solo verificar arquitectura
    ./run-ci.ps1 --test-only      # Solo ejecutar tests
    ./run-ci.ps1 --cleanup        # Tests + cleanup (sin lint)

"@
}

# ============================================
# PARSEAR ARGUMENTOS
# ============================================

$skipLint = $false
$skipTests = $false
$skipCleanup = $false
$cleanupAfter = $false
$fullRun = $false
$forceMode = $false

foreach ($arg in $args) {
    switch ($arg) {
        "--lint-only" { $skipTests = $true; $skipCleanup = $true }
        "--test-only" { $skipLint = $true; $skipCleanup = $true }
        "--cleanup" { $cleanupAfter = $true }
        "--full" { $fullRun = $true; $cleanupAfter = $true }
        "--skip-lint" { $skipLint = $true }
        "--skip-tests" { $skipTests = $true }
        "--skip-cleanup" { $skipCleanup = $true }
        "--force" { $forceMode = $true }
        "-h" { Show-Help; exit 0 }
        "--help" { Show-Help; exit 0 }
        default {
            Write-Fail "Opción desconocida: $arg"
            Show-Help
            exit 1
        }
    }
}

# Si es modo full, asegurar todas las opciones
if ($fullRun) {
    $skipLint = $false
    $skipTests = $false
    $skipCleanup = $false
    $cleanupAfter = $true
}

# ============================================
# MAIN
# ============================================

Write-Banner "CI/CD Local - vCenter Provisioner"

# Cambiar al directorio del proyecto
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if ($projectRoot -ne (Get-Location).Path) {
    Write-Info "Cambiando a: $projectRoot"
    Push-Location $projectRoot
}

$script:steps = @()
$totalSteps = 0
if (-not $skipLint) { $totalSteps++ }
if (-not $skipTests) { $totalSteps++ }
$totalSteps++
if ($cleanupAfter) { $totalSteps++ }

$currentStep = 0

try {
    # Paso 1: Lint
    if (-not $skipLint) {
        $currentStep++
        Write-Step $currentStep $totalSteps "Verificando arquitectura (Anti-SQLite)..."

        $lintStart = [System.Diagnostics.Stopwatch]::StartNew()
        $lintResult = & "$PSScriptRoot/scripts/ci/lint.ps1" 2>&1
        $lintExit = $LASTEXITCODE
        $lintDuration = [math]::Round($lintStart.Elapsed.TotalSeconds, 2)

        Write-Host $lintResult

        if ($lintExit -ne 0) {
            Write-Result "Lint" $false $lintDuration
            Write-Fail "Lint falló. Revisa los errores arriba."
            $script:startTime.Stop()
            Pop-Location
            exit 1
        }

        Write-Result "Lint" $true $lintDuration
        $script:steps += @{ Name = "Lint"; Passed = $true; Duration = $lintDuration }
    }

    # Paso 2: Levantar servicios
    if (-not $skipTests) {
        $currentStep++
        Write-Step $currentStep $totalSteps "Levantando servicios con Docker Compose..."

        $composeStart = [System.Diagnostics.Stopwatch]::StartNew()
        Write-Info "Ejecutando: docker compose up -d"

        $composeOutput = docker compose -f infra/local/docker-compose.yml up -d 2>&1
        $composeExit = $LASTEXITCODE
        $composeDuration = [math]::Round($composeStart.Elapsed.TotalSeconds, 2)

        if ($composeExit -ne 0) {
            Write-Host $composeOutput
            Write-Result "Docker Compose" $false $composeDuration
            Write-Fail "Error al levantar servicios."
            $script:startTime.Stop()
            Pop-Location
            exit 1
        }

        Write-Result "Docker Compose" $true $composeDuration
        $script:steps += @{ Name = "Docker Compose"; Passed = $true; Duration = $composeDuration }

        # Esperar a que PostgreSQL esté listo
        Write-Info "Esperando a PostgreSQL..."
        $maxRetries = 30
        $retries = 0
        while ($retries -lt $maxRetries) {
            $pgReady = docker exec vcenter-provisioner-db pg_isready -U antigravity 2>&1
            if ($pgReady -match "accepting connections") {
                break
            }
            Start-Sleep -Seconds 1
            $retries++
        }

        if ($retries -eq $maxRetries) {
            Write-Fail "PostgreSQL no respondió a tiempo."
            $script:startTime.Stop()
            Pop-Location
            exit 1
        }
        Write-Success "PostgreSQL listo"
    }

    # Paso 3: Ejecutar Tests
    if (-not $skipTests) {
        $currentStep++
        Write-Step $currentStep $totalSteps "Ejecutando tests..."

        $testStart = [System.Diagnostics.Stopwatch]::StartNew()
        $testResult = & "$PSScriptRoot/scripts/ci/test.ps1" 2>&1
        $testExit = $LASTEXITCODE
        $testDuration = [math]::Round($testStart.Elapsed.TotalSeconds, 2)

        Write-Host $testResult

        if ($testExit -ne 0) {
            Write-Result "Tests" $false $testDuration
            Write-Fail "Tests fallaron."
            $script:startTime.Stop()
            if ($cleanupAfter) {
                Write-Info "Limpiando contenedores..."
                & "$PSScriptRoot/scripts/ci/cleanup.ps1" -Force 2>&1 | Out-Null
            }
            Pop-Location
            exit 1
        }

        Write-Result "Tests" $true $testDuration
        $script:steps += @{ Name = "Tests"; Passed = $true; Duration = $testDuration }
    }

    # Paso 4: Build con hashes deterministas
    $currentStep++
    Write-Step $currentStep $totalSteps "Build con hashes deterministas..."

    $buildStart = [System.Diagnostics.Stopwatch]::StartNew()
    $buildResult = & "$PSScriptRoot/scripts/ci/build.ps1" 2>&1
    $buildExit = $LASTEXITCODE
    $buildDuration = [math]::Round($buildStart.Elapsed.TotalSeconds, 2)

    Write-Host $buildResult

    if ($buildExit -ne 0) {
        Write-Result "Build" $false $buildDuration
        Write-Fail "Build falló."
        $script:startTime.Stop()
        if ($cleanupAfter) {
            Write-Info "Limpiando contenedores..."
            & "$PSScriptRoot/scripts/ci/cleanup.ps1" -Force 2>&1 | Out-Null
        }
        Pop-Location
        exit 1
    }

    Write-Result "Build" $true $buildDuration
    $script:steps += @{ Name = "Build"; Passed = $true; Duration = $buildDuration }

    # Paso 5: Cleanup (si está habilitado)
    if ($cleanupAfter) {
        $currentStep++
        Write-Step $currentStep $totalSteps "Limpiando contenedores..."

        $cleanupStart = [System.Diagnostics.Stopwatch]::StartNew()
        $cleanupResult = & "$PSScriptRoot/scripts/ci/cleanup.ps1" -Force 2>&1
        $cleanupExit = $LASTEXITCODE
        $cleanupDuration = [math]::Round($cleanupStart.Elapsed.TotalSeconds, 2)

        Write-Host $cleanupResult

        Write-Result "Cleanup" $($cleanupExit -eq 0) $cleanupDuration
        $script:steps += @{ Name = "Cleanup"; Passed = $($cleanupExit -eq 0); Duration = $cleanupDuration }
    }

    $script:startTime.Stop()

    # ========================================
    # RESUMEN FINAL
    # ========================================

    Write-Banner "CI/CD COMPLETADO"

    Write-Host "`n📊 RESUMEN" -ForegroundColor White
    Write-Host ("-" * 50) -ForegroundColor Gray

    $totalDuration = [math]::Round($script:startTime.Elapsed.TotalSeconds, 2)
    $passedSteps = ($script:steps | Where-Object { $_.Passed }).Count
    $failedSteps = ($script:steps | Where-Object { -not $_.Passed }).Count

    foreach ($step in $script:steps) {
        $status = if ($step.Passed) { "✅" } else { "❌" }
        Write-Host "  $status $($step.Name.PadRight(20)) $($step.Duration)s" -ForegroundColor $(if ($step.Passed) { "Green" } else { "Red" })
    }

    Write-Host ("-" * 50) -ForegroundColor Gray
    Write-Host "  Tiempo total: ${totalDuration}s" -ForegroundColor White
    Write-Host "  Pasados: $passedSteps / $($script:steps.Count)" -ForegroundColor Green
    if ($failedSteps -gt 0) {
        Write-Host "  Fallidos: $failedSteps" -ForegroundColor Red
    }

    Write-Host "`n📄 Reportes generados:" -ForegroundColor White
    Write-Host "  - test-results/master-report.html" -ForegroundColor Gray

    if ($failedSteps -eq 0) {
        Write-Host "`n" -NoNewline
        Write-Host ("=" * 70) -ForegroundColor Green
        Write-Host "  ✅ CI/CD EXITOSO" -ForegroundColor Green
        Write-Host ("=" * 70) -ForegroundColor Green
        Pop-Location
        exit 0
    } else {
        Write-Host "`n" -NoNewline
        Write-Host ("=" * 70) -ForegroundColor Red
        Write-Host "  ❌ CI/CD FALLÓ" -ForegroundColor Red
        Write-Host ("=" * 70) -ForegroundColor Red
        Pop-Location
        exit 1
    }

} catch {
    $script:startTime.Stop()
    Write-Fail "Error inesperado: $_"
    Write-Host $_.Exception
    Write-Host $_.ScriptStackTrace
    if ($cleanupAfter) {
        & "$PSScriptRoot/scripts/ci/cleanup.ps1" -Force 2>&1 | Out-Null
    }
    Pop-Location
    exit 1
}
