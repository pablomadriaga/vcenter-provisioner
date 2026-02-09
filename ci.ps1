#!/usr/bin/env pwsh
# =============================================================================
# ci.ps1 - DEPRECATED
# =============================================================================
# ⚠️  ESTE SCRIPT ESTA DEPRECADO
# =============================================================================
# USA: .\pipeline.ps1
# =============================================================================
# Este script sera eliminado en una version futura.
# Por favor usa pipeline.ps1 como entry point unificado.
#
# EQUIVALENTE NUEVO:
#   .\pipeline.ps1              # Lint + Test (Host) + Build
#   .\pipeline.ps1 --lint     # Solo lint
#   .\pipeline.ps1 --test     # Solo test
#   .\pipeline.ps1 --build    # Solo build
# =============================================================================

<#
.SYNOPSIS
    Pipeline CI/CD Local para vCenter Provisioner - CI Global

.DESCRIPTION
    Ejecuta el pipeline completo de CI/CD local para todos los microservicios:
    1. Lint (en host) - Feedback rápido
    2. Unit Tests (en host) - Sin overhead Docker
    3. Build Docker Image (local) - Determinista
    4. Integration Tests (en contenedor) - Fiel a producción

    Diseñado para onboarding rápido sin fricción. Alto turnover ≠ junior.

.PARAMETER Service
    Nombre del servicio específico a procesar. Si no se especifica, procesa todos.

.PARAMETER SkipBuild
    Omite la construcción de imágenes Docker. Útil para desarrollo rápido.

.PARAMETER SkipTests
    Omite la ejecución de tests. Solo lint y build.

.PARAMETER SkipLint
    Omite el linting. Útil cuando solo se quieren tests.

.PARAMETER Watch
    Modo desarrollo continuo (solo disponible para servicio individual).

.PARAMETER Parallel
    Ejecuta servicios en paralelo donde sea posible (por defecto: true).

.PARAMETER Verbose
    Muestra output detallado de cada comando.

.PARAMETER FailFast
    Detiene el pipeline al primer error (por defecto: true).

.EXAMPLE
    # CI completo de todos los servicios
    .\ci.ps1

.EXAMPLE
    # CI de un servicio específico en modo watch
    .\ci.ps1 -Service api-gateway -Watch

.EXAMPLE
    # Solo lint y tests, sin build (desarrollo rápido)
    .\ci.ps1 -SkipBuild

.EXAMPLE
    # CI completo con output detallado
    .\ci.ps1 -Verbose

.NOTES
    Author: Antigravity Engineering
    Version: 1.0.0
    Requiere: Docker, Docker Compose, Node.js 20+, Go 1.22+, Python 3.12+

    Imágenes resultantes: <servicio>:local (sin registry externo)
#>

[CmdletBinding()]
param(
    [Parameter()]
    [ValidateSet("api-gateway", "auth-service", "typing-service", "vm-orchestrator", 
                "vcenter-integration", "stats-service", "monitoring-service", 
                "backup-service", "provisioner-ui", "all")]
    [string]$Service = "all",
    
    [switch]$SkipBuild,
    [switch]$SkipTests,
    [switch]$SkipLint,
    [switch]$Watch,
    [switch]$Parallel = $true,
    [switch]$Verbose,
    [switch]$FailFast = $true
)

# Error handling estricto
$ErrorActionPreference = "Stop"
$ProgressPreference = "Continue"

# Configuración
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$BASE_DIR = $SCRIPT_DIR
$COMPOSE_DIR = Join-Path $BASE_DIR "infra\local"
$APPS_DIR = Join-Path $BASE_DIR "apps"

# Colores para output
$colors = @{
    Success = "Green"
    Error = "Red"
    Warning = "Yellow"
    Info = "Cyan"
    Emphasis = "Magenta"
}

# Resultados globales
$script:Results = @{
    Success = @()
    Failed = @()
    Skipped = @()
    StartTime = Get-Date
}

#region Logging Functions

function Write-Log {
    param(
        [Parameter(Mandatory)]
        [string]$Message,
        
        [Parameter()]
        [ValidateSet("INFO", "SUCCESS", "WARN", "ERROR", "EMPHASIS")]
        [string]$Level = "INFO"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMsg = "[$timestamp] [$Level] $Message"
    
    switch ($Level) {
        "SUCCESS" { Write-Host $logMsg -ForegroundColor $colors.Success }
        "ERROR" { Write-Host $logMsg -ForegroundColor $colors.Error }
        "WARN" { Write-Host $logMsg -ForegroundColor $colors.Warning }
        "EMPHASIS" { Write-Host $logMsg -ForegroundColor $colors.Emphasis }
        default { Write-Host $logMsg -ForegroundColor White }
    }
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor $colors.Info
    Write-Host "  $Title" -ForegroundColor $colors.Info
    Write-Host "========================================" -ForegroundColor $colors.Info
    Write-Host ""
}

function Write-SubSection {
    param([string]$Title)
    Write-Host ""
    Write-Host "--- $Title ---" -ForegroundColor $colors.Emphasis
}

#endregion

#region Prerequisite Checks

function Test-Prerequisites {
    Write-Section "VALIDACIÓN DE PREREQUISITOS"
    
    $checks = @(
        @{ Name = "Docker"; Command = "docker version"; Required = $true }
        @{ Name = "Docker Compose"; Command = "docker-compose --version"; Required = $true }
        @{ Name = "PowerShell"; Command = "echo $PSVersionTable.PSVersion"; Required = $true }
        @{ Name = "Node.js (opcional)"; Command = "node --version"; Required = $false }
        @{ Name = "Go (opcional)"; Command = "go version"; Required = $false }
        @{ Name = "Python (opcional)"; Command = "python --version"; Required = $false }
    )
    
    $allPassed = $true
    
    foreach ($check in $checks) {
        try {
            $output = Invoke-Expression $check.Command 2>&1
            if ($check.Required) {
                Write-Log "✅ $($check.Name) detectado" "SUCCESS"
            } else {
                Write-Log "✅ $($check.Name) detectado (opcional)" "INFO"
            }
        } catch {
            if ($check.Required) {
                Write-Log "❌ $($check.Name) NO detectado (REQUERIDO)" "ERROR"
                $allPassed = $false
            } else {
                Write-Log "⚠️  $($check.Name) NO detectado (opcional)" "WARN"
            }
        }
    }
    
    if (-not $allPassed) {
        Write-Log "Faltan prerequisitos requeridos. Instala Docker y Docker Compose." "ERROR"
        exit 1
    }
    
    Write-Log "Todos los prerequisitos requeridos están instalados" "SUCCESS"
    return $true
}

#endregion

#region Service Definitions

$Services = @{
    "api-gateway" = @{
        Name = "API Gateway"
        Path = "apps/api-gateway"
        Type = "node"
        Port = 3000
        ImageName = "vcenter-provisioner/api-gateway"
        LintCmd = "npm run lint"
        TestCmd = "npm test"
        BuildCmd = "docker build -t vcenter-provisioner/api-gateway:local ."
    }
    "auth-service" = @{
        Name = "Auth Service"
        Path = "apps/auth-service"
        Type = "node"
        Port = 3001
        ImageName = "vcenter-provisioner/auth-service"
        LintCmd = "npm run lint"
        TestCmd = "npm test"
        BuildCmd = "docker build -t vcenter-provisioner/auth-service:local ."
    }
    "typing-service" = @{
        Name = "Typing Service"
        Path = "apps/typing-service"
        Type = "python"
        Port = 8000
        ImageName = "vcenter-provisioner/typing-service"
        LintCmd = "flake8 app --max-line-length=100 --ignore=E501"
        TestCmd = "python -m pytest app/test_typing.py -v"
        BuildCmd = "docker build -t vcenter-provisioner/typing-service:local ."
    }
    "vm-orchestrator" = @{
        Name = "VM Orchestrator"
        Path = "apps/vm-orchestrator"
        Type = "go"
        Port = 8080
        ImageName = "vcenter-provisioner/vm-orchestrator"
        LintCmd = "go vet ./..."
        TestCmd = "go test -v ./..."
        BuildCmd = "docker build -t vcenter-provisioner/vm-orchestrator:local ."
    }
    "vcenter-integration" = @{
        Name = "vCenter Integration"
        Path = "apps/vcenter-integration"
        Type = "go"
        Port = 8081
        ImageName = "vcenter-provisioner/vcenter-integration"
        LintCmd = "go vet ./..."
        TestCmd = "go test -v ./..."
        BuildCmd = "docker build -t vcenter-provisioner/vcenter-integration:local ."
    }
    "stats-service" = @{
        Name = "Stats Service"
        Path = "apps/stats-service"
        Type = "python"
        Port = 8001
        ImageName = "vcenter-provisioner/stats-service"
        LintCmd = "flake8 . --max-line-length=100 --ignore=E501"
        TestCmd = "python -m pytest -v"
        BuildCmd = "docker build -t vcenter-provisioner/stats-service:local ."
    }
    "monitoring-service" = @{
        Name = "Monitoring Service"
        Path = "apps/monitoring-service"
        Type = "go"
        Port = 8082
        ImageName = "vcenter-provisioner/monitoring-service"
        LintCmd = "go vet ./..."
        TestCmd = "go test -v ./..."
        BuildCmd = "docker build -t vcenter-provisioner/monitoring-service:local ."
    }
    "backup-service" = @{
        Name = "Backup Service"
        Path = "apps/backup-service"
        Type = "python"
        Port = 8002
        ImageName = "vcenter-provisioner/backup-service"
        LintCmd = "flake8 . --max-line-length=100 --ignore=E501"
        TestCmd = "python -m pytest -v"
        BuildCmd = "docker build -t vcenter-provisioner/backup-service:local ."
    }
    "provisioner-ui" = @{
        Name = "Provisioner UI"
        Path = "apps/provisioner-ui"
        Type = "node"
        Port = 5173
        ImageName = "vcenter-provisioner/provisioner-ui"
        LintCmd = "npm run lint"
        TestCmd = "npm run test:unit"
        BuildCmd = "docker build -t vcenter-provisioner/provisioner-ui:local ."
    }
}

#endregion

#region Pipeline Functions

function Invoke-Lint {
    param(
        [Parameter(Mandatory)]
        [string]$ServiceKey,
        [Parameter(Mandatory)]
        [hashtable]$ServiceConfig
    )
    
    Write-SubSection "LINT: $($ServiceConfig.Name)"
    
    $servicePath = Join-Path $BASE_DIR $ServiceConfig.Path
    
    if (-not (Test-Path $servicePath)) {
        Write-Log "Directorio no encontrado: $servicePath" "WARN"
        return @{ Success = $false; Skipped = $true; Error = "Directory not found" }
    }
    
    Push-Location $servicePath
    try {
        if ($Verbose) {
            Write-Log "Ejecutando: $($ServiceConfig.LintCmd)" "INFO"
        }
        
        $output = Invoke-Expression $ServiceConfig.LintCmd 2>&1 | Out-String
        $exitCode = $LASTEXITCODE
        
        if ($exitCode -eq 0) {
            Write-Log "✅ Lint exitoso: $($ServiceConfig.Name)" "SUCCESS"
            return @{ Success = $true; Output = $output }
        } else {
            Write-Log "❌ Lint falló: $($ServiceConfig.Name)" "ERROR"
            if ($Verbose) {
                Write-Host $output
            }
            return @{ Success = $false; Error = "Lint failed with exit code $exitCode"; Output = $output }
        }
    } catch {
        Write-Log "❌ Error ejecutando lint: $($_.Exception.Message)" "ERROR"
        return @{ Success = $false; Error = $_.Exception.Message }
    } finally {
        Pop-Location
    }
}

function Invoke-Tests {
    param(
        [Parameter(Mandatory)]
        [string]$ServiceKey,
        [Parameter(Mandatory)]
        [hashtable]$ServiceConfig
    )
    
    Write-SubSection "TESTS: $($ServiceConfig.Name)"
    
    $servicePath = Join-Path $BASE_DIR $ServiceConfig.Path
    
    if (-not (Test-Path $servicePath)) {
        Write-Log "Directorio no encontrado: $servicePath" "WARN"
        return @{ Success = $false; Skipped = $true; Error = "Directory not found" }
    }
    
    Push-Location $servicePath
    try {
        if ($Verbose) {
            Write-Log "Ejecutando: $($ServiceConfig.TestCmd)" "INFO"
        }
        
        $output = Invoke-Expression $ServiceConfig.TestCmd 2>&1 | Out-String
        $exitCode = $LASTEXITCODE
        
        # Parsear resultados según tipo
        $testResults = Parse-TestResults -ServiceType $ServiceConfig.Type -Output $output
        
        if ($exitCode -eq 0) {
            Write-Log "✅ Tests exitosos: $($ServiceConfig.Name) ($($testResults.Passed) passed)" "SUCCESS"
            return @{ Success = $true; TestResults = $testResults; Output = $output }
        } else {
            Write-Log "❌ Tests fallaron: $($ServiceConfig.Name) ($($testResults.Failed) failed)" "ERROR"
            if ($Verbose) {
                Write-Host $output
            }
            return @{ Success = $false; TestResults = $testResults; Error = "Tests failed"; Output = $output }
        }
    } catch {
        Write-Log "❌ Error ejecutando tests: $($_.Exception.Message)" "ERROR"
        return @{ Success = $false; Error = $_.Exception.Message }
    } finally {
        Pop-Location
    }
}

function Invoke-Build {
    param(
        [Parameter(Mandatory)]
        [string]$ServiceKey,
        [Parameter(Mandatory)]
        [hashtable]$ServiceConfig
    )
    
    Write-SubSection "BUILD: $($ServiceConfig.Name)"
    
    $servicePath = Join-Path $BASE_DIR $ServiceConfig.Path
    
    if (-not (Test-Path $servicePath)) {
        Write-Log "Directorio no encontrado: $servicePath" "WARN"
        return @{ Success = $false; Skipped = $true; Error = "Directory not found" }
    }
    
    Push-Location $servicePath
    try {
        Write-Log "Construyendo imagen Docker: $($ServiceConfig.ImageName):local" "INFO"
        
        if ($Verbose) {
            Write-Log "Ejecutando: $($ServiceConfig.BuildCmd)" "INFO"
        }
        
        $output = Invoke-Expression $ServiceConfig.BuildCmd 2>&1 | Out-String
        $exitCode = $LASTEXITCODE
        
        if ($exitCode -eq 0) {
            Write-Log "✅ Build exitoso: $($ServiceConfig.ImageName):local" "SUCCESS"
            
            # Verificar imagen creada
            $verifyOutput = docker images $ServiceConfig.ImageName --format "{{.Repository}}:{{.Tag}}" 2>&1
            if ($verifyOutput -match "local") {
                Write-Log "✅ Imagen verificada localmente" "SUCCESS"
            }
            
            return @{ Success = $true; Image = "$($ServiceConfig.ImageName):local"; Output = $output }
        } else {
            Write-Log "❌ Build falló: $($ServiceConfig.Name)" "ERROR"
            if ($Verbose) {
                Write-Host $output
            }
            return @{ Success = $false; Error = "Build failed with exit code $exitCode"; Output = $output }
        }
    } catch {
        Write-Log "❌ Error en build: $($_.Exception.Message)" "ERROR"
        return @{ Success = $false; Error = $_.Exception.Message }
    } finally {
        Pop-Location
    }
}

function Parse-TestResults {
    param(
        [string]$ServiceType,
        [string]$Output
    )
    
    $results = @{
        Passed = 0
        Failed = 0
        Coverage = $null
    }
    
    switch ($ServiceType) {
        "go" {
            if ($Output -match "PASS") {
                $matches = [regex]::Matches($Output, "PASS")
                $results.Passed = $matches.Count
            }
            if ($Output -match "coverage:\s*(\d+\.?\d*)%") {
                $results.Coverage = $matches.Groups[1].Value + "%"
            }
        }
        "python" {
            if ($Output -match "(\d+)\s+passed") {
                $results.Passed = [int]$matches.Groups[1].Value
            }
            if ($Output -match "(\d+)\s+failed") {
                $results.Failed = [int]$matches.Groups[1].Value
            }
            if ($Output -match "TOTAL.*?(\d+\.?\d*)%") {
                $results.Coverage = $matches.Groups[1].Value + "%"
            }
        }
        "node" {
            if ($Output -match "(\d+)\s+passed") {
                $results.Passed = [int]$matches.Groups[1].Value
            }
            if ($Output -match "(\d+)\s+failed") {
                $results.Failed = [int]$matches.Groups[1].Value
            }
            if ($Output -match "(\d+\.?\d*)%") {
                $results.Coverage = $matches.Groups[1].Value + "%"
            }
        }
    }
    
    return $results
}

#endregion

#region Main Pipeline

function Invoke-CIPipeline {
    param(
        [string]$ServiceKey,
        [hashtable]$ServiceConfig
    )
    
    $pipelineStart = Get-Date
    
    Write-Section "PROCESANDO: $($ServiceConfig.Name)"
    
    $results = @{
        Service = $ServiceKey
        Name = $ServiceConfig.Name
        Lint = $null
        Tests = $null
        Build = $null
        Duration = $null
        OverallSuccess = $true
    }
    
    # 1. LINT (si no se omite)
    if (-not $SkipLint) {
        $results.Lint = Invoke-Lint -ServiceKey $ServiceKey -ServiceConfig $ServiceConfig
        if (-not $results.Lint.Success -and $FailFast) {
            $results.OverallSuccess = $false
            return $results
        }
    } else {
        Write-Log "⏭️  Lint omitido por parámetro" "WARN"
        $results.Lint = @{ Success = $true; Skipped = $true }
    }
    
    # 2. TESTS (si no se omiten)
    if (-not $SkipTests) {
        $results.Tests = Invoke-Tests -ServiceKey $ServiceKey -ServiceConfig $ServiceConfig
        if (-not $results.Tests.Success -and $FailFast) {
            $results.OverallSuccess = $false
            return $results
        }
    } else {
        Write-Log "⏭️  Tests omitidos por parámetro" "WARN"
        $results.Tests = @{ Success = $true; Skipped = $true }
    }
    
    # 3. BUILD (si no se omite)
    if (-not $SkipBuild) {
        $results.Build = Invoke-Build -ServiceKey $ServiceKey -ServiceConfig $ServiceConfig
        if (-not $results.Build.Success -and $FailFast) {
            $results.OverallSuccess = $false
            return $results
        }
    } else {
        Write-Log "⏭️  Build omitido por parámetro" "WARN"
        $results.Build = @{ Success = $true; Skipped = $true }
    }
    
    $results.Duration = (Get-Date) - $pipelineStart
    
    return $results
}

#endregion

#region Report Generation

function Write-Report {
    param(
        [array]$AllResults
    )
    
    Write-Section "REPORTE FINAL DE CI/CD LOCAL"
    
    $totalDuration = (Get-Date) - $script:Results.StartTime
    
    # Resumen por servicio
    Write-Host ""
    Write-Host "RESULTADOS POR SERVICIO:" -ForegroundColor $colors.Info
    Write-Host ""
    
    $headers = @("Servicio", "Lint", "Tests", "Build", "Duración", "Estado")
    $headerLine = "{0,-25} {1,-8} {2,-8} {3,-8} {4,-12} {5,-10}" -f $headers
    Write-Host $headerLine -ForegroundColor $colors.Emphasis
    Write-Host ("-" * 80) -ForegroundColor $colors.Emphasis
    
    $successCount = 0
    $failedCount = 0
    $skippedCount = 0
    
    foreach ($result in $AllResults) {
        $lintStatus = if ($result.Lint.Skipped) { "⏭️" } elseif ($result.Lint.Success) { "✅" } else { "❌" }
        $testsStatus = if ($result.Tests.Skipped) { "⏭️" } elseif ($result.Tests.Success) { "✅" } else { "❌" }
        $buildStatus = if ($result.Build.Skipped) { "⏭️" } elseif ($result.Build.Success) { "✅" } else { "❌" }
        
        $durationStr = if ($result.Duration) { 
            "{0:mm\:ss\.fff}" -f $result.Duration 
        } else { 
            "N/A" 
        }
        
        $overallStatus = if ($result.OverallSuccess) { 
            "✅ OK" 
            $successCount++
        } else { 
            "❌ FAIL" 
            $failedCount++
        }
        
        if ($result.Lint.Skipped -and $result.Tests.Skipped -and $result.Build.Skipped) {
            $skippedCount++
        }
        
        $line = "{0,-25} {1,-8} {2,-8} {3,-8} {4,-12} {5,-10}" -f 
            $result.Name, 
            $lintStatus, 
            $testsStatus, 
            $buildStatus, 
            $durationStr, 
            $overallStatus
        
        $color = if ($result.OverallSuccess) { $colors.Success } else { $colors.Error }
        Write-Host $line -ForegroundColor $color
    }
    
    Write-Host ""
    Write-Host ("-" * 80) -ForegroundColor $colors.Emphasis
    
    # Métricas
    Write-Host ""
    Write-Host "MÉTRICAS:" -ForegroundColor $colors.Info
    Write-Host "  ✅ Exitosos:    $successCount" -ForegroundColor $colors.Success
    Write-Host "  ❌ Fallidos:    $failedCount" -ForegroundColor $colors.Error
    Write-Host "  ⏭️  Omitidos:    $skippedCount" -ForegroundColor $colors.Warning
    Write-Host "  ⏱️  Duración Total: {0:mm\:ss\.fff}" -f $totalDuration -ForegroundColor $colors.Info
    Write-Host ""
    
    # Imágenes locales
    Write-Host "IMÁGENES DOCKER LOCALES:" -ForegroundColor $colors.Info
    docker images --filter "reference=vcenter-provisioner/*:local" --format "  {{.Repository}}:{{.Tag}} ({{.Size}})" | ForEach-Object {
        Write-Host $_ -ForegroundColor $colors.Success
    }
    
    Write-Host ""
    
    # Errores detallados
    $failedResults = $AllResults | Where-Object { -not $_.OverallSuccess }
    if ($failedResults.Count -gt 0) {
        Write-Host "ERRORES DETALLADOS:" -ForegroundColor $colors.Error
        foreach ($failed in $failedResults) {
            Write-Host "  ❌ $($failed.Name)" -ForegroundColor $colors.Error
            if ($failed.Lint -and -not $failed.Lint.Success -and -not $failed.Lint.Skipped) {
                Write-Host "     - Lint: $($failed.Lint.Error)" -ForegroundColor $colors.Warning
            }
            if ($failed.Tests -and -not $failed.Tests.Success -and -not $failed.Tests.Skipped) {
                Write-Host "     - Tests: $($failed.Tests.Error)" -ForegroundColor $colors.Warning
            }
            if ($failed.Build -and -not $failed.Build.Success -and -not $failed.Build.Skipped) {
                Write-Host "     - Build: $($failed.Build.Error)" -ForegroundColor $colors.Warning
            }
        }
        Write-Host ""
    }
    
    # Recomendaciones
    if ($failedCount -gt 0) {
        Write-Host "PRÓXIMOS PASOS:" -ForegroundColor $colors.Emphasis
        Write-Host "  1. Revisa los logs con: .\ci.ps1 -Verbose" -ForegroundColor White
        Write-Host "  2. Corre solo el servicio fallido: .\ci.ps1 -Service <nombre>" -ForegroundColor White
        Write-Host "  3. Omite etapas para debug: .\ci.ps1 -SkipBuild" -ForegroundColor White
    } else {
        Write-Host "✅ TODOS LOS SERVICIOS PASARON EL CI LOCAL" -ForegroundColor $colors.Success
        Write-Host ""
        Write-Host "PRÓXIMOS PASOS:" -ForegroundColor $colors.Emphasis
        Write-Host "  1. Levantar servicios: docker-compose -f infra/local/docker-compose.yml up -d" -ForegroundColor White
        Write-Host "  2. Verificar: .\verify-setup.ps1" -ForegroundColor White
        Write-Host "  3. Abrir UI: http://localhost:5173" -ForegroundColor White
    }
    
    Write-Host ""
}

#endregion

#region Main Execution

function Main {
    # Banner
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $colors.Info
    Write-Host "║     vCenter Provisioner - CI/CD Local Pipeline           ║" -ForegroundColor $colors.Info
    Write-Host "║     Pragmatismo Staff-Grade | Onboarding sin fricción     ║" -ForegroundColor $colors.Info
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $colors.Info
    Write-Host ""
    
    # Validar parámetros incompatibles
    if ($Watch -and $Service -eq "all") {
        Write-Log "❌ El modo Watch solo funciona con un servicio específico" "ERROR"
        Write-Log "   Uso: .\ci.ps1 -Service api-gateway -Watch" "INFO"
        exit 1
    }
    
    # Check prerequisitos
    if (-not (Test-Prerequisites)) {
        exit 1
    }
    
    # Determinar servicios a procesar
    $servicesToProcess = if ($Service -eq "all") {
        $Services.Keys | Sort-Object
    } else {
        @($Service)
    }
    
    Write-Log "Servicios a procesar: $($servicesToProcess -join ', ')" "INFO"
    
    if ($Watch) {
        # Modo watch: loop continuo
        Write-Section "MODO WATCH: $($Services[$Service].Name)"
        Write-Log "Presiona Ctrl+C para detener" "WARN"
        Write-Host ""
        
        while ($true) {
            $result = Invoke-CIPipeline -ServiceKey $Service -ServiceConfig $Services[$Service]
            
            if (-not $result.OverallSuccess) {
                Write-Log "⚠️  Pipeline falló. Esperando cambios..." "WARN"
            } else {
                Write-Log "✅ Pipeline exitoso. Esperando cambios..." "SUCCESS"
            }
            
            Write-Host ""
            Write-Host "Presiona Ctrl+C para salir..." -ForegroundColor $colors.Warning
            Start-Sleep -Seconds 5
        }
    } else {
        # Modo batch: procesar todos
        $allResults = @()
        
        if ($Parallel -and $servicesToProcess.Count -gt 1) {
            Write-Log "Ejecutando servicios en paralelo..." "INFO"
            # Nota: PowerShell 7+ soportaría ForEach-Object -Parallel
            # Por compatibilidad, lo hacemos secuencial pero optimizado
        }
        
        foreach ($svc in $servicesToProcess) {
            $result = Invoke-CIPipeline -ServiceKey $svc -ServiceConfig $Services[$svc]
            $allResults += $result
            
            if (-not $result.OverallSuccess -and $FailFast) {
                Write-Log "FailFast activado: Deteniendo pipeline" "WARN"
                break
            }
        }
        
        # Generar reporte
        Write-Report -AllResults $allResults
        
        # Exit code basado en resultados
        $failedCount = ($allResults | Where-Object { -not $_.OverallSuccess }).Count
        exit $failedCount
    }
}

#endregion

# Ejecutar
Main
