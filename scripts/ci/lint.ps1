#!/usr/bin/env pwsh
# ============================================
# Lint Script - vCenter Provisioner
# Verifica arquitectura: Solo PostgreSQL, NUNCA SQLite
# ============================================

$ErrorActionPreference = "Stop"
$script:sqliteFound = $false
$script:issuesFound = $false

function Write-Banner {
    param([string]$Message)
    Write-Host "`n" -NoNewline
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host "  $Message" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
}

function Write-Section {
    param([string]$Message)
    Write-Host "`n=== $Message ===" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "  [FAIL] $Message" -ForegroundColor Red
    $script:issuesFound = $true
}

function Write-Success {
    param([string]$Message)
    Write-Host "  [PASS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "  [WARN] $Message" -ForegroundColor Yellow
}

function Test-SqliteInFile {
    param([string]$FilePath, [string]$FileName)
    $content = Get-Content $FilePath -Raw -ErrorAction SilentlyContinue
    if (-not $content) { return }

    # Ignorar archivos en node_modules, .venv, dist, build
    if ($FilePath -match "\\node_modules\\" -or $FilePath -match "\\.venv\\" -or $FilePath -match "\\dist\\" -or $FilePath -match "\\build\\") {
        return
    }

    if ($content -match "sqlite://") {
        Write-Error "SQLite URL encontrado en: $FileName"
        Write-Host "     Ruta: $FilePath" -ForegroundColor Gray
        $script:sqliteFound = $true
    }
}

function Test-DatabaseConfig {
    param([string]$FilePath, [string]$FileName)
    $content = Get-Content $FilePath -Raw -ErrorAction SilentlyContinue
    if (-not $content) { return }

    # Verificar que database.py use PostgreSQL
    if ($content -match "postgresql://|postgres://") {
        Write-Success "${FileName}: Usa PostgreSQL"
    }
    elseif ($content -match "sqlite") {
        Write-Error "${FileName}: Usa SQLite (PROHIBIDO)"
        $script:sqliteFound = $true
    }
}

function Test-DockerCompose {
    param([string]$FilePath)
    $content = Get-Content $FilePath -Raw -ErrorAction SilentlyContinue
    if (-not $content) { return }

    if ($content -match "postgres") {
        Write-Success "docker-compose.yml: PostgreSQL configurado"
    } else {
        Write-Error "docker-compose.yml: No hay PostgreSQL"
    }
}

function Test-Dockerfile {
    param([string]$FilePath, [string]$ServiceName)
    if (-not (Test-Path $FilePath)) {
        Write-Error "Dockerfile falta para: $ServiceName"
        return
    }
    Write-Success "Dockerfile existe para: $ServiceName"
}

# ============================================
# MAIN
# ============================================

Write-Banner "Lint - Arquitectura vCenter Provisioner"

# Ir al directorio del proyecto
Push-Location (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent)

try {
    Write-Section "Verificando archivos de base de datos..."

    # Buscar archivos database.py
    $dbFiles = Get-ChildItem -Path "apps/" -Recurse -Include "database.py" -ErrorAction SilentlyContinue
    if ($dbFiles) {
        foreach ($file in $dbFiles) {
            Test-DatabaseConfig -FilePath $file.FullName -FileName $file.Name
        }
    } else {
        Write-Warning "No se encontraron archivos database.py"
    }

    Write-Section "Buscando SQLite en el código..."

    # Buscar SQLite en Python
    $pyFiles = Get-ChildItem -Path "apps/" -Recurse -Include "*.py" -ErrorAction SilentlyContinue
    foreach ($file in $pyFiles) {
        Test-SqliteInFile -FilePath $file.FullName -FileName $file.Name
    }

    # Buscar SQLite en JS/TS
    $tsFiles = Get-ChildItem -Path "apps/" -Recurse -Include "*.ts", "*.tsx", "*.js" -ErrorAction SilentlyContinue
    foreach ($file in $tsFiles) {
        Test-SqliteInFile -FilePath $file.FullName -FileName $file.Name
    }

    Write-Section "Verificando docker-compose.yml..."

    $composeFile = "infra/local/docker-compose.yml"
    if (Test-Path $composeFile) {
        Test-DockerCompose -FilePath $composeFile
    } else {
        Write-Error "No existe: $composeFile"
    }

    Write-Section "Verificando Dockerfiles..."

    $services = @("typing-service", "auth-service", "stats-service", "vm-orchestrator", "provisioner-ui", "api-gateway")
    foreach ($service in $services) {
        $dockerfile = "apps/$service/Dockerfile"
        Test-Dockerfile -FilePath $dockerfile -ServiceName $service
    }

    # Resultado final
    Write-Section "Resultado"

    if ($script:sqliteFound) {
        Write-Host "`n" -NoNewline
        Write-Host ("=" * 60) -ForegroundColor Red
        Write-Host "  [FAIL] SQLite detectado" -ForegroundColor Red
        Write-Host ("=" * 60) -ForegroundColor Red
        Write-Host "`nSQLite esta PROHIBIDO en este proyecto." -ForegroundColor Red
        Write-Host "Usa PostgreSQL en Docker para todo." -ForegroundColor Yellow
        Pop-Location
        exit 1
    }

    if ($script:issuesFound) {
        Write-Host "`n" -NoNewline
        Write-Host ("=" * 60) -ForegroundColor Yellow
        Write-Host "  [WARN] ADVERTENCIAS ENCONTRADAS" -ForegroundColor Yellow
        Write-Host ("=" * 60) -ForegroundColor Yellow
        Pop-Location
        exit 1
    }

    Write-Host "`n" -NoNewline
    Write-Host ("=" * 60) -ForegroundColor Green
    Write-Host "  [PASS] Arquitectura valida" -ForegroundColor Green
    Write-Host "     Solo PostgreSQL, sin SQLite" -ForegroundColor Gray
    Write-Host ("=" * 60) -ForegroundColor Green

    Pop-Location
    exit 0

} catch {
    Write-Error "Error durante lint: $_"
    Pop-Location
    exit 1
}
