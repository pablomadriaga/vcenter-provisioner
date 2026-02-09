#!/usr/bin/env pwsh
# =============================================================================
# self-test.ps1 - Validación del Sistema
# =============================================================================
# Valida que la configuración del sistema este correcta.
# USADO POR: pipeline.ps1, desarrolladores
# =============================================================================
# USO:
#   .\scripts\self-test.ps1           # Validacion basica
#   .\scripts\self-test.ps1 --help   # Esta ayuda
# =============================================================================

$ErrorActionPreference = "Stop"

$script:MyPath = $MyInvocation.MyCommand.Path
$script:SCRIPT_DIR = Split-Path -Parent $script:MyPath
$scriptDirLeaf = Split-Path -Leaf $script:SCRIPT_DIR
$scriptDirParent = Split-Path -Parent $script:SCRIPT_DIR
$scriptDirParentLeaf = Split-Path -Leaf $scriptDirParent

if ($scriptDirLeaf -eq "scripts") {
    $script:ROOT_DIR = $scriptDirParent
    if ($scriptDirParentLeaf -eq "projects") {
        $script:ROOT_DIR = $scriptDirParent
    }
}
else {
    $script:ROOT_DIR = $script:SCRIPT_DIR
}

$script:CONFIG_DIR = Join-Path $script:ROOT_DIR "config"
$script:INFRA_DIR = Join-Path $script:ROOT_DIR "infra/local"

# =============================================================================
# FUNCIONES DE TEST
# =============================================================================

function Test-ConfigFiles {
    Write-Section "Configuracion Centralizada"

    $results = @{}

    # ports.ps1 existe
    $results["ports.ps1 existe"] = (Test-Path (Join-Path $CONFIG_DIR "ports.ps1"))

    # services.ps1 existe
    $results["services.ps1 existe"] = (Test-Path (Join-Path $CONFIG_DIR "services.ps1"))

    # Cargar ports.ps1
    try {
        $portsFile = Join-Path $CONFIG_DIR "ports.ps1"
        if (Test-Path $portsFile) {
            . $portsFile -ErrorAction Stop
            $results["ports.ps1 carga"] = $true
            $results["ports.ps1 contiene servicios"] = ($null -ne $global:PORTS -and $global:PORTS.Count -gt 0)
        }
        else {
            $results["ports.ps1 carga"] = $false
        }
    }
    catch {
        $results["ports.ps1 carga"] = $false
    }

    # Cargar services.ps1
    try {
        $servicesFile = Join-Path $CONFIG_DIR "services.ps1"
        if (Test-Path $servicesFile) {
            . $servicesFile -ErrorAction Stop
            $results["services.ps1 carga"] = $true
            $results["services.ps1 contiene servicios"] = ($null -ne $global:SERVICES -and $global:SERVICES.Count -gt 0)
        }
        else {
            $results["services.ps1 carga"] = $false
        }
    }
    catch {
        $results["services.ps1 carga"] = $false
    }

    foreach ($key in $results.Keys) {
        $status = if ($results[$key]) { "OK" } else { "FAIL" }
        Write-Host "  [$status] $key" -ForegroundColor $(if ($results[$key]) { "Green" } else { "Red" })
    }

    return ($results.Values -notcontains $false)
}

function Test-Ports {
    Write-Section "Puertos Definidos"

    $expectedPorts = @(
        "api-gateway",
        "auth-service",
        "typing-service",
        "vm-orchestrator",
        "vcenter-integration",
        "vcenter-config",
        "stats-service",
        "monitoring-service",
        "backup-service",
        "provisioner-ui"
    )

    $allOk = $true
    foreach ($svc in $expectedPorts) {
        $hasInternal = $global:PORTS[$svc]["internal"] -ne $null
        $hasExternal = $global:PORTS[$svc]["external"] -ne $null

        if ($hasInternal -and $hasExternal) {
            Write-Host "  [OK] $svc`: $($global:PORTS[$svc]["internal"]):$($global:PORTS[$svc]["external"])" -ForegroundColor Green
        }
        else {
            Write-Host "  [FAIL] $svc`: Faltan puertos" -ForegroundColor Red
            $allOk = $false
        }
    }

    return $allOk
}

function Test-DockerCompose {
    Write-Section "Docker Compose"

    $results = @{}

    # Existe
    $composeFile = Join-Path $INFRA_DIR "docker-compose.yml"
    $results["docker-compose.yml existe"] = (Test-Path $composeFile)

    # No existe el old docker-compose.ci.yml
    $oldCompose = Join-Path $INFRA_DIR "docker-compose.ci.yml"
    $results["docker-compose.ci.yml eliminado"] = (-not (Test-Path $oldCompose))

    # Usa :hash tags
    try {
        $content = Get-Content $composeFile -Raw
        $results["usa tags hash"] = ($content -match '\$\{[^}]+_HASH')
        $results["NO usa :version"] = ($content -notmatch ':v\d+\.\d+\.\d+')
    }
    catch {
        $results["usa tags hash"] = $false
    }

    foreach ($key in $results.Keys) {
        $status = if ($results[$key]) { "OK" } else { "FAIL" }
        Write-Host "  [$status] $key" -ForegroundColor $(if ($results[$key]) { "Green" } else { "Red" })
    }

    return ($results.Values -notcontains $false)
}

function Test-Scripts {
    Write-Section "Scripts Principales"

    $results = @{}

    # pipeline.ps1 existe
    $results["pipeline.ps1 existe"] = (Test-Path (Join-Path $ROOT_DIR "pipeline.ps1"))

    # start.ps1 existe
    $results["start.ps1 existe"] = (Test-Path (Join-Path $ROOT_DIR "start.ps1"))

    # ci.ps1 marcado como deprecated
    try {
        $ciContent = Get-Content (Join-Path $ROOT_DIR "ci.ps1") -Raw
        $results["ci.ps1 deprecated"] = ($ciContent -match "DEPRECATED")
    }
    catch {
        $results["ci.ps1 deprecated"] = $false
    }

    # run-ci.ps1 marcado como deprecated
    try {
        $runCiContent = Get-Content (Join-Path $ROOT_DIR "run-ci.ps1") -Raw
        $results["run-ci.ps1 deprecated"] = ($runCiContent -match "DEPRECATED")
    }
    catch {
        $results["run-ci.ps1 deprecated"] = $false
    }

    foreach ($key in $results.Keys) {
        $status = if ($results[$key]) { "OK" } else { "FAIL" }
        Write-Host "  [$status] $key" -ForegroundColor $(if ($results[$key]) { "Green" } else { "Red" })
    }

    return ($results.Values -notcontains $false)
}

function Test-Contract {
    Write-Section "Documentacion"

    $results = @{}

    # CONTRACT.md existe
    $results["CONTRACT.md existe"] = (Test-Path (Join-Path $ROOT_DIR "docs/CONTRACT.md"))

    # CI-CD-LOCAL.md existe
    $results["CI-CD-LOCAL.md existe"] = (Test-Path (Join-Path $ROOT_DIR "docs/CI-CD-LOCAL.md"))

    # CONTRACT.md actualizado a 2.0.0
    try {
        $contractContent = Get-Content (Join-Path $ROOT_DIR "docs/CONTRACT.md") -Raw
        $results["CONTRACT.md version 2.0.0"] = ($contractContent -match "VERSION:\s*2\.0\.0")
    }
    catch {
        $results["CONTRACT.md version 2.0.0"] = $false
    }

    foreach ($key in $results.Keys) {
        $status = if ($results[$key]) { "OK" } else { "FAIL" }
        Write-Host "  [$status] $key" -ForegroundColor $(if ($results[$key]) { "Green" } else { "Red" })
    }

    return ($results.Values -notcontains $false)
}

function Write-Section {
    param([string]$Message)
    Write-Host ""
    Write-Host "--- $Message ---" -ForegroundColor Cyan
}

function Show-Help {
    Write-Host @"

USO:
    .\scripts\self-test.ps1           # Validacion basica
    .\scripts\self-test.ps1 --help   # Esta ayuda

VALIDA:
    - Archivos de configuracion
    - Puertos centralizados
    - Docker Compose unificado
    - Scripts principales
    - Documentacion

"@
}

function Main {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  vCenter Provisioner - Self Test" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    if ($Help) {
        Show-Help
        exit 0
    }

    $tests = @(
        @{ Name = "Configuracion Centralizada"; Func = ${function:Test-ConfigFiles} }
        @{ Name = "Puertos Definidos"; Func = ${function:Test-Ports} }
        @{ Name = "Docker Compose"; Func = ${function:Test-DockerCompose} }
        @{ Name = "Scripts Principales"; Func = ${function:Test-Scripts} }
        @{ Name = "Documentacion"; Func = ${function:Test-Contract} }
    )

    $passed = 0
    $failed = 0

    foreach ($test in $tests) {
        $result = & $test.Func
        if ($result) { $passed++ } else { $failed++ }
    }

    Write-Host ""
    Write-Host "========================================" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
    Write-Host "  RESULTADO: $passed/$($tests.Count) tests pasaron" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
    Write-Host "========================================" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })

    if ($failed -gt 0) {
        Write-Host ""
        Write-Host "[FAIL] Hay errores. Corrige los problemas arriba." -ForegroundColor Red
        Write-Host ""
        Write-Host "COMANDOS UTILES:" -ForegroundColor Yellow
        Write-Host "  .\pipeline.ps1 --build     # Generar .env.ci" -ForegroundColor Gray
        Write-Host "  .\pipeline.ps1 --validate  # Validar prerrequisitos" -ForegroundColor Gray
    }
    else {
        Write-Host ""
        Write-Host "[OK] Sistema configurado correctamente." -ForegroundColor Green
        Write-Host ""
        Write-Host "PROXIMOS PASOS:" -ForegroundColor Yellow
        Write-Host "  .\pipeline.ps1 --build     # Build de imagenes" -ForegroundColor Gray
        Write-Host "  .\start.ps1              # Levantar servicios" -ForegroundColor Gray
    }

    exit $(if ($failed -gt 0) { 1 } else { 0 })
}

Main
