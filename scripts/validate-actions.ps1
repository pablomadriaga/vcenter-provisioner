#!/usr/bin/env pwsh
# =============================================================================
# validate-actions.ps1 - Validador de Acciones
# =============================================================================
# Detecta violaciones de reglas antes de ejecutarlas
# =============================================================================

param(
    [string]$Command,
    [switch]$All
)

$ErrorActionPreference = "Stop"

function Test-Duplication {
    param([string]$File)
    $fileName = Split-Path $File -Leaf
    try {
        $result = grep -r $fileName shared/ scripts/ config/ 2>$null
        if ($result -and $result -notmatch [regex]::Escape($File)) {
            Write-Warning "DUPLICADO ENCONTRADO: $fileName"
            return $false
        }
    }
    catch {
        return $true
    }
    return $true
}

function Test-PipelineUsage {
    param([string]$commandToCheck)
    $forbidden = @('docker build', 'docker-compose up', 'npm run dev', 'go build')
    $lowerCmd = $commandToCheck.ToLower()
    foreach ($pattern in $forbidden) {
        if ($lowerCmd.Contains($pattern)) {
            Write-Warning "VIOLACIÓN: Comando fuera de pipeline.ps1"
            Write-Host "  Comando: $commandToCheck"
            Write-Host "  Solución: pipeline.ps1 -Build"
            return $false
        }
    }
    return $true
}

function Test-MultipleCopy {
    param([string]$commandToCheck)
    $cleanCmd = $commandToCheck.Trim()
    $parts = $cleanCmd.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)
    if ($parts.Length -ge 4 -and $parts[0].ToLower() -eq "cp") {
        Write-Warning "VIOLACIÓN: Copiando a múltiples carpetas"
        Write-Host "  Comando: $commandToCheck"
        Write-Host "  Solución: shared-scripts/ + COPY en Dockerfile"
        return $false
    }
    return $true
}

# Main
if ($Command) {
    $violations = 0
    
    $result = Test-Duplication -File $Command
    if (-not $result) { $violations++ }
    
    $result = Test-PipelineUsage -commandToCheck $Command
    if (-not $result) { $violations++ }
    
    $result = Test-MultipleCopy -commandToCheck $Command
    if (-not $result) { $violations++ }
    
    if ($violations -gt 0) {
        Write-Error "🚫 $violations violación(es) encontrada(s). Acción bloqueada."
        exit 1
    }
    
    Write-Host "✅ Validación exitosa"
    exit 0
}

if ($All) {
    Write-Host "🔍 Validando proyecto completo..."
    Write-Host ""
    
    $dirs = @('shared/', 'scripts/', 'config/')
    foreach ($dir in $dirs) {
        if (-not (Test-Path $dir)) {
            Write-Warning "Directorio no encontrado: $dir"
        }
    }
    
    Write-Host ""
    Write-Host "✅ Verificación completa"
    exit 0
}

Write-Host "USO:"
Write-Host "  .\scripts\validate-actions.ps1 -Command 'mi-comando'  # Validar acción"
Write-Host "  .\scripts\validate-actions.ps1 -All                   # Validar proyecto"
exit 0
