#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Pipeline CI/CD Local - Template para Microservicios

.DESCRIPTION
    Template para ejecutar el pipeline CI/CD local de un microservicio individual.
    
    Este script debe ser personalizado para cada servicio específico.
    
    Pipeline:
    1. Lint (en host) - Feedback rápido
    2. Unit Tests (en host) - Sin overhead Docker
    3. Build Docker Image (local) - Determinista
    
    Uso típico:
    - Desarrollo continuo: .\ci.ps1 -Watch
    - CI rápido: .\ci.ps1 -SkipBuild
    - Full CI: .\ci.ps1

.PARAMETER SkipBuild
    Omite la construcción de imagen Docker

.PARAMETER SkipTests
    Omite la ejecución de tests

.PARAMETER SkipLint
    Omite el linting

.PARAMETER Watch
    Modo desarrollo continuo (observa cambios y re-ejecuta)

.PARAMETER Verbose
    Muestra output detallado

.EXAMPLE
    # CI completo del servicio
    .\ci.ps1

.EXAMPLE
    # Modo watch para desarrollo continuo
    .\ci.ps1 -Watch

.EXAMPLE
    # Solo lint y tests (rápido)
    .\ci.ps1 -SkipBuild

.NOTES
    Copiar este template y personalizar las variables de configuración.
    
    Variables a personalizar:
    - $ServiceName: Nombre del servicio
    - $ServiceType: Tipo (node|python|go)
    - $ImageName: Nombre de la imagen Docker
    - $LintCommand: Comando de linting
    - $TestCommand: Comando de tests
    - $BuildCommand: Comando de build Docker
#>

[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [switch]$SkipTests,
    [switch]$SkipLint,
    [switch]$Watch,
    [switch]$Verbose
)

# =============================================================================
# CONFIGURACIÓN DEL SERVICIO - PERSONALIZAR ESTAS VARIABLES
# =============================================================================

$ServiceName = "TEMPLATE-SERVICE"  # Ej: "api-gateway", "typing-service"
$ServiceType = "TEMPLATE-TYPE"       # Ej: "node", "python", "go"
$ImageName = "vcenter-provisioner/TEMPLATE-SERVICE"

# Comandos de pipeline (personalizar según tecnología)
$LintCommand = "echo 'No lint configured'"      # Ej: "npm run lint", "go vet ./..."
$TestCommand = "echo 'No tests configured'"     # Ej: "npm test", "go test ./..."
$BuildCommand = "docker build -t ${ImageName}:local ."

# Dependencias adicionales (opcional)
$PreTestCommands = @()   # Comandos a ejecutar antes de tests (ej: npm install)
$PostBuildCommands = @() # Comandos después de build (ej: docker run --rm para tests de integración)

# =============================================================================
# IMPLEMENTACIÓN - NO MODIFICAR DEBAJO DE ESTA LÍNEA
# =============================================================================

$ErrorActionPreference = "Stop"
$StartTime = Get-Date

# Colores
$colors = @{
    Success = "Green"
    Error = "Red"
    Warning = "Yellow"
    Info = "Cyan"
    Emphasis = "Magenta"
}

function Write-Log {
    param(
        [Parameter(Mandatory)]
        [string]$Message,
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

function Invoke-CommandWithLog {
    param(
        [Parameter(Mandatory)]
        [string]$Command,
        [Parameter(Mandatory)]
        [string]$StepName
    )
    
    Write-Log "Ejecutando: $StepName" "EMPHASIS"
    
    if ($Verbose) {
        Write-Log "Comando: $Command" "INFO"
    }
    
    try {
        $output = Invoke-Expression $Command 2>&1 | Out-String
        $exitCode = $LASTEXITCODE
        
        if ($Verbose -and $output) {
            Write-Host $output
        }
        
        if ($exitCode -eq 0) {
            Write-Log "✅ $StepName exitoso" "SUCCESS"
            return @{ Success = $true; Output = $output }
        } else {
            Write-Log "❌ $StepName falló (código $exitCode)" "ERROR"
            Write-Host $output -ForegroundColor $colors.Error
            return @{ Success = $false; ExitCode = $exitCode; Output = $output }
        }
    } catch {
        Write-Log "❌ Error en $StepName`: $($_.Exception.Message)" "ERROR"
        return @{ Success = $false; Error = $_.Exception.Message }
    }
}

function Invoke-Pipeline {
    $results = @{
        Lint = @{ Success = $true; Skipped = $true }
        Test = @{ Success = $true; Skipped = $true }
        Build = @{ Success = $true; Skipped = $true }
    }
    
    # Pre-test commands
    if ($PreTestCommands.Count -gt 0) {
        Write-Log "Ejecutando comandos de preparación..." "INFO"
        foreach ($cmd in $PreTestCommands) {
            $result = Invoke-CommandWithLog -Command $cmd -StepName "Pre-test setup"
            if (-not $result.Success) {
                return @{ 
                    OverallSuccess = $false
                    FailedStep = "Pre-test"
                    Results = $results
                }
            }
        }
    }
    
    # 1. LINT
    if (-not $SkipLint) {
        $results.Lint = Invoke-CommandWithLog -Command $LintCommand -StepName "Lint"
        if (-not $results.Lint.Success) {
            return @{ 
                OverallSuccess = $false
                FailedStep = "Lint"
                Results = $results
            }
        }
    } else {
        Write-Log "⏭️  Lint omitido" "WARN"
    }
    
    # 2. TESTS
    if (-not $SkipTests) {
        $results.Test = Invoke-CommandWithLog -Command $TestCommand -StepName "Tests"
        if (-not $results.Test.Success) {
            return @{ 
                OverallSuccess = $false
                FailedStep = "Test"
                Results = $results
            }
        }
    } else {
        Write-Log "⏭️  Tests omitidos" "WARN"
    }
    
    # 3. BUILD
    if (-not $SkipBuild) {
        $results.Build = Invoke-CommandWithLog -Command $BuildCommand -StepName "Build Docker"
        if (-not $results.Build.Success) {
            return @{ 
                OverallSuccess = $false
                FailedStep = "Build"
                Results = $results
            }
        }
        
        # Post-build commands
        if ($PostBuildCommands.Count -gt 0) {
            Write-Log "Ejecutando comandos post-build..." "INFO"
            foreach ($cmd in $PostBuildCommands) {
                $result = Invoke-CommandWithLog -Command $cmd -StepName "Post-build"
                if (-not $result.Success) {
                    return @{ 
                        OverallSuccess = $false
                        FailedStep = "Post-build"
                        Results = $results
                    }
                }
            }
        }
    } else {
        Write-Log "⏭️  Build omitido" "WARN"
    }
    
    return @{
        OverallSuccess = $true
        FailedStep = $null
        Results = $results
    }
}

function Write-Report {
    param(
        [Parameter(Mandatory)]
        [hashtable]$PipelineResult
    )
    
    $duration = (Get-Date) - $StartTime
    
    Write-Section "REPORTE: $ServiceName"
    
    # Tabla de resultados
    Write-Host "Paso       | Estado | Detalle" -ForegroundColor $colors.Emphasis
    Write-Host "-----------|--------|--------" -ForegroundColor $colors.Emphasis
    
    $lintStatus = if ($PipelineResult.Results.Lint.Skipped) { "⏭️ Omitido" } 
                  elseif ($PipelineResult.Results.Lint.Success) { "✅ OK" } 
                  else { "❌ Falló" }
    Write-Host "Lint       | $lintStatus" -ForegroundColor $(if ($PipelineResult.Results.Lint.Success -or $PipelineResult.Results.Lint.Skipped) { $colors.Success } else { $colors.Error })
    
    $testStatus = if ($PipelineResult.Results.Test.Skipped) { "⏭️ Omitido" } 
                  elseif ($PipelineResult.Results.Test.Success) { "✅ OK" } 
                  else { "❌ Falló" }
    Write-Host "Tests      | $testStatus" -ForegroundColor $(if ($PipelineResult.Results.Test.Success -or $PipelineResult.Results.Test.Skipped) { $colors.Success } else { $colors.Error })
    
    $buildStatus = if ($PipelineResult.Results.Build.Skipped) { "⏭️ Omitido" } 
                    elseif ($PipelineResult.Results.Build.Success) { "✅ OK" } 
                    else { "❌ Falló" }
    Write-Host "Build      | $buildStatus" -ForegroundColor $(if ($PipelineResult.Results.Build.Success -or $PipelineResult.Results.Build.Skipped) { $colors.Success } else { $colors.Error })
    
    Write-Host ""
    Write-Host "Duración: {0:mm\:ss\.fff}" -f $duration -ForegroundColor $colors.Info
    
    if ($PipelineResult.OverallSuccess) {
        Write-Host ""
        Write-Host "✅ PIPELINE EXITOSO" -ForegroundColor $colors.Success
        
        if (-not $SkipBuild) {
            Write-Host ""
            Write-Host "Imagen local creada: ${ImageName}:local" -ForegroundColor $colors.Success
            docker images $ImageName --format "  - {{.Repository}}:{{.Tag}} ({{.Size}})"
        }
        
        Write-Host ""
        Write-Host "Próximos pasos:" -ForegroundColor $colors.Emphasis
        Write-Host "  - Ejecutar CI global: ..\..\ci.ps1" -ForegroundColor White
        Write-Host "  - Levantar servicios: docker-compose -f ..\..\infra\local\docker-compose.yml up -d" -ForegroundColor White
        Write-Host "  - Verificar: ..\..\verify-setup.ps1" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "❌ PIPELINE FALLÓ en paso: $($PipelineResult.FailedStep)" -ForegroundColor $colors.Error
        Write-Host ""
        Write-Host "Para debug:" -ForegroundColor $colors.Emphasis
        Write-Host "  - Usa -Verbose para ver output completo" -ForegroundColor White
        Write-Host "  - Omite pasos con -SkipLint, -SkipTests, o -SkipBuild" -ForegroundColor White
    }
    
    Write-Host ""
}

# =============================================================================
# MAIN
# =============================================================================

# Banner
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $colors.Info
Write-Host "║  CI/CD Local: $ServiceName" -ForegroundColor $colors.Info
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $colors.Info
Write-Host ""

# Verificar Docker
Write-Log "Verificando Docker..." "INFO"
try {
    $dockerVersion = docker version --format '{{.Server.Version}}' 2>&1
    Write-Log "✅ Docker $dockerVersion disponible" "SUCCESS"
} catch {
    Write-Log "❌ Docker no está disponible" "ERROR"
    exit 1
}

if ($Watch) {
    # Modo watch
    Write-Section "MODO WATCH ACTIVADO"
    Write-Log "Presiona Ctrl+C para detener" "WARN"
    Write-Host ""
    
    while ($true) {
        $result = Invoke-Pipeline
        Write-Report -PipelineResult $result
        
        Write-Host ""
        Write-Host "👀 Observando cambios... (Ctrl+C para salir)" -ForegroundColor $colors.Warning
        Start-Sleep -Seconds 3
        Write-Host "🔄 Re-ejecutando pipeline..." -ForegroundColor $colors.Info
        Write-Host ""
    }
} else {
    # Modo normal
    $result = Invoke-Pipeline
    Write-Report -PipelineResult $result
    
    # Exit code
    if ($result.OverallSuccess) {
        exit 0
    } else {
        exit 1
    }
}
