#!/usr/bin/env pwsh
# ============================================
# Cleanup Script - vCenter Provisioner
# Limpia contenedores, redes y recursos de Docker
# ============================================

$ErrorActionPreference = "Stop"

$script:containersRemoved = 0
$script:networksRemoved = 0
$script:volumesRemoved = 0
$script:imagesRemoved = 0

function Write-Banner {
    param([string]$Message)
    Write-Host "`n" -NoNewline
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host "  $Message" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
}

function Write-Section {
    param([string]$Message)
    Write-Host "`n📋 $Message" -ForegroundColor Yellow
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
    Write-Host "  ⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "  ❌ $Message" -ForegroundColor Red
}

function Remove-Container {
    param([string]$Name)
    try {
        $exists = docker inspect -f '{{.Id}}' $Name 2>$null
        if ($exists) {
            $status = docker inspect -f '{{.State.Running}}' $Name 2>$null
            if ($status -eq "true") {
                Write-Info "Deteniendo contenedor: $Name"
                docker stop $Name 2>&1 | Out-Null
            }
            Write-Info "Removiendo contenedor: $Name"
            docker rm -f $Name 2>&1 | Out-Null
            $script:containersRemoved++
            Write-Success "$Name removido"
        } else {
            Write-Info "$Name no existe (skipping)"
        }
    } catch {
        Write-Warning "Error removiendo $Name`: $_"
    }
}

function Remove-Network {
    param([string]$Name)
    try {
        $exists = docker network inspect $Name 2>$null
        if ($exists) {
            Write-Info "Removiendo red: $Name"
            docker network rm $Name 2>&1 | Out-Null
            $script:networksRemoved++
            Write-Success "$Name removida"
        }
    } catch {
        Write-Warning "Error removiendo red $Name`: $_"
    }
}

function Remove-Volume {
    param([string]$Name)
    try {
        $exists = docker volume inspect $Name 2>$null
        if ($exists) {
            Write-Info "Removiendo volumen: $Name"
            docker volume rm $Name 2>&1 | Out-Null
            $script:volumesRemoved++
            Write-Success "$Name removido"
        }
    } catch {
        Write-Warning "Error removiendo volumen $Name`: $_"
    }
}

function Prune-Docker {
    Write-Info "Limpiando recursos no usados..."
    docker system prune -f 2>&1 | Out-Null
}

# ============================================
# MAIN
# ============================================

param(
    [switch]$Full,        # Limpieza completa (incluye volúmenes)
    [switch]$Containers,  # Solo contenedores
    [switch]$Networks,    # Solo redes
    [switch]$Volumes,     # Solo volúmenes
    [switch]$Images,      # Incluir limpieza de imágenes huérfanas
    [switch]$Force        # No pedir confirmación
)

Write-Banner "Cleanup - vCenter Provisioner"

Push-Location (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent)

try {
    # Lista de contenedores del proyecto
    $projectContainers = @(
        "provisioner-typing",
        "provisioner-auth",
        "provisioner-stats",
        "provisioner-gateway",
        "provisioner-vm-orchestrator",
        "provisioner-vcenter-adapter",
        "provisioner-monitoring",
        "provisioner-backup",
        "provisioner-ui",
        "vcenter-provisioner-db"
    )

    # Lista de redes del proyecto
    $projectNetworks = @(
        "vcenter-provisioner_default"
    )

    # Lista de volúmenes del proyecto
    $projectVolumes = @(
        "vcenter-provisioner_postgres_data"
    )

    # Determinar qué limpiar
    $cleanupContainers = $Containers -or (-not ($Networks -or $Volumes))
    $cleanupNetworks = $Networks -or (-not ($Containers -or $Volumes))
    $cleanupVolumes = $Volumes -or $Full
    $cleanupImages = $Images -or $Full

    # Mostrar qué se va a hacer
    Write-Section "Configuración de limpieza"

    Write-Host "  Contenedores: $(if ($cleanupContainers) { 'SÍ' } else { 'NO' })"
    Write-Host "  Redes: $(if ($cleanupNetworks) { 'SÍ' } else { 'NO' })"
    Write-Host "  Volúmenes: $(if ($cleanupVolumes) { 'SÍ' } else { 'NO' })"
    Write-Host "  Imágenes huérfanas: $(if ($cleanupImages) { 'SÍ' } else { 'NO' })"

    if (-not $Force) {
        Write-Host "`n⚠️  Esta acción eliminará recursos de Docker." -ForegroundColor Yellow
        $confirm = Read-Host "¿Continuar? (s/N)"
        if ($confirm -notmatch "^[Ss]$") {
            Write-Info "Limpieza cancelada"
            Pop-Location
            exit 0
        }
    }

    # Contenedores
    if ($cleanupContainers) {
        Write-Section "Removiendo contenedores..."
        foreach ($container in $projectContainers) {
            Remove-Container -Name $container
        }
    }

    # Redes
    if ($cleanupNetworks) {
        Write-Section "Removiendo redes..."
        foreach ($network in $projectNetworks) {
            Remove-Network -Name $network
        }
    }

    # Volúmenes
    if ($cleanupVolumes) {
        Write-Section "Removiendo volúmenes..."
        foreach ($volume in $projectVolumes) {
            Remove-Volume -Name $volume
        }
    }

    # Imágenes huérfanas
    if ($cleanupImages) {
        Write-Section "Limpiando imágenes huérfanas..."
        Prune-Docker
        $script:imagesRemoved = 1
        Write-Success "Imágenes huérfanas limpiadas"
    }

    # Limpieza adicional de docker-compose
    Write-Section "Limpiando recursos de docker-compose..."
    docker compose -f infra/local/docker-compose.yml down --volumes --remove-orphans 2>&1 | Out-Null

    # Resumen
    Write-Section "Resumen de limpieza"

    Write-Host "`n" -NoNewline
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host "  RESULTADO DE LIMPIEZA" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan

    Write-Host "  Contenedores removidos: $script:containersRemoved" -ForegroundColor $(if ($script:containersRemoved -gt 0) { "Green" } else { "Gray" })
    Write-Host "  Redes removidas: $script:networksRemoved" -ForegroundColor $(if ($script:networksRemoved -gt 0) { "Green" } else { "Gray" })
    Write-Host "  Volúmenes removidos: $script:volumesRemoved" -ForegroundColor $(if ($script:volumesRemoved -gt 0) { "Yellow" } else { "Gray" })
    Write-Host "  Imágenes limpiadas: $(if ($cleanupImages) { 'SÍ' } else { 'NO' })" -ForegroundColor Gray

    if (-not $Force -and ($script:volumesRemoved -gt 0 -or $Full)) {
        Write-Warning "`n⚠️  Se eliminaron volúmenes. Los datos de PostgreSQL se perderán."
        Write-Warning "   Para recrear la base de datos, ejecuta 'docker compose up -d'"
    }

    Write-Host "`n" -NoNewline
    Write-Host ("=" * 60) -ForegroundColor Green
    Write-Host "  ✅ LIMPIEZA COMPLETADA" -ForegroundColor Green
    Write-Host ("=" * 60) -ForegroundColor Green

    Pop-Location
    exit 0

} catch {
    Write-Error "Error durante limpieza: $_"
    Pop-Location
    exit 1
}
