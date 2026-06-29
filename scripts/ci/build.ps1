#!/usr/bin/env pwsh
# =============================================================================
# build.ps1 - Generación de .env.ci con Hashes
# =============================================================================
# Genera .env.ci con hashes deterministas de cada servicio.
# USA: pipeline.ps1 llama a este script automáticamente.
# =============================================================================

$ErrorActionPreference = "Stop"

$root = Resolve-Path "$PSScriptRoot/../.."
$envCi = "$root/.env.ci"

$services = @{
    "provisioner-ui" = @{ Path = "$root/apps/provisioner-ui"; Tag = "provisioner-ui" }
    "api-gateway" = @{ Path = "$root/apps/api-gateway"; Tag = "api-gateway" }
    "auth-service" = @{ Path = "$root/apps/auth-service"; Tag = "auth-service" }
    "typing-service" = @{ Path = "$root/apps/typing-service"; Tag = "typing-service" }
    "stats-service" = @{ Path = "$root/apps/stats-service"; Tag = "stats-service" }
    "vm-orchestrator" = @{ Path = "$root/apps/vm-orchestrator"; Tag = "vm-orchestrator" }
    "vcenter-integration" = @{ Path = "$root/apps/vcenter-integration"; Tag = "vcenter-integration" }
    "vcenter-config" = @{ Path = "$root/apps/vcenter-config-service"; Tag = "vcenter-config" }
    "backup-service" = @{ Path = "$root/apps/backup-service"; Tag = "backup-service" }
    "monitoring-service" = @{ Path = "$root/apps/monitoring-service"; Tag = "monitoring-service" }
}

. "$PSScriptRoot/hash.ps1"

Write-Host "Calculando hashes..."
$hashes = @{}
foreach ($svc in $services.GetEnumerator()) {
    $hashes[$svc.Key] = Get-DirectoryHash -Path $svc.Value.Path
}

Write-Host "Generando $envCi..."
$lines = @("# NO EDITAR. Generado por run-ci.ps1.")
foreach ($svc in $hashes.GetEnumerator()) {
    $key = "$($svc.Key)_HASH"
    $lines += "$key=$($svc.Value)"
    Write-Host "  $key=$($svc.Value)"
}
$lines | Out-File -FilePath $envCi -Encoding UTF8

Write-Host "Construyendo imágenes..."
foreach ($svc in $services.GetEnumerator()) {
    $hash = $hashes[$svc.Key]
    $tag = "$($svc.Value.Tag):$hash"
    $path = $svc.Value.Path
    
    Write-Host "  $tag"
    docker build -t $tag $path
}
