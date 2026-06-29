#!/usr/bin/env pwsh
# =============================================================================
# dev-env-install.ps1 - Entorno de Desarrollo Automatizado
# =============================================================================
# Instala Node.js (LTS), Python 3.12+, Go 1.24+ y dependencias pip.
# Designed for: vCenter Provisioner CI/CD Pipeline
# =============================================================================
# USO:
#   .\dev-env-install.ps1              # Instalación completa
#   .\dev-env-install.ps1 --verify   # Solo verificar
#   .\dev-env-install.ps1 --help      # Mostrar ayuda
# =============================================================================

[CmdletBinding()]
param(
    [switch]$Verify,
    [switch]$Help
)

# =============================================================================
# CONFIGURACIÓN
# =============================================================================

$script:LOG_FILE = "dev-env-install.log"
$SCRIPT_VERSION = "2.0.0"

$TARGET_VERSIONS = @{
    Nodejs = @{ Min = "18.0.0"; Recommended = "LTS" }
    Python = @{ Major = 3; Minor = 12 }
    Go = @{ Min = "1.24.0" }
}

# =============================================================================
# UTILIDADES
# =============================================================================

function Write-Msg {
    param([string]$Message, [string]$Color = "White")
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] $Message" -ForegroundColor $Color
    Add-Content -Path $LOG_FILE -Value "[$timestamp] $Message" -ErrorAction SilentlyContinue
}

function Write-Section {
    param([string]$Message)
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host "  $Message" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
}

# =============================================================================
# DETECCIÓN DE VERSIONES
# =============================================================================

function Get-NodeJsVersion {
    try {
        $output = node --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            return $output.Trim()
        }
        return $null
    }
    catch { return $null }
}

function Get-PythonVersion {
    try {
        foreach ($cmd in @("python --version", "py --version")) {
            $output = Invoke-Expression $cmd 2>&1
            if ($LASTEXITCODE -eq 0) {
                $version = ($output | Select-Object -First 1).ToString()
                if ($version -match '(\d+\.\d+\.\d+)') {
                    return $matches[1]
                }
            }
        }
        return $null
    }
    catch { return $null }
}

function Get-GoVersion {
    try {
        $output = go version 2>&1
        if ($LASTEXITCODE -eq 0) {
            if ($output -match 'go(\d+\.\d+\.\d+)') {
                return $matches[1]
            }
        }
        return $null
    }
    catch { return $null }
}

function Get-PipPackageVersion {
    param([string]$Package)
    try {
        $output = pip show $Package 2>&1
        if ($LASTEXITCODE -eq 0) {
            $line = $output | Where-Object { $_ -match '^Version:' }
            if ($line) {
                return ($line -split ':\s*')[1].Trim()
            }
        }
        return $null
    }
    catch { return $null }
}

# =============================================================================
# COMPARACIÓN DE VERSIONES
# =============================================================================

function Test-VersionSatisfies {
    param(
        [string]$Installed,
        [string]$Minimum
    )
    try {
        $i = [System.Version]$Installed
        $m = [System.Version]$Minimum
        return $i.CompareTo($m) -ge 0
    }
    catch { return $false }
}

# =============================================================================
# INSTALACIÓN INDIVIDUAL
# =============================================================================

function Install-IfNeeded {
    param(
        [string]$Name,
        [string]$WingetId,
        [scriptblock]$VersionGetter,
        [string]$MinimumVersion
    )

    Write-Section "$Name"

    $currentVersion = & $VersionGetter

    if ($null -ne $currentVersion) {
        Write-Msg "✅ Ya instalado: $currentVersion" -Color "Green"
        if (Test-VersionSatisfies -Installed $currentVersion -Minimum $MinimumVersion) {
            Write-Msg "✅ Cumple requisitos mínimos ($MinimumVersion)" -Color "Green"
            return $true
        }
        else {
            Write-Msg "⚠️  Versión anterior a $MinimumVersion. Actualizando..." -Color "Yellow"
        }
    }
    else {
        Write-Msg "❌ No detectado. Instalando..." -Color "Yellow"
    }

    # Intentar instalación
    Write-Msg "Ejecutando: winget install $WingetId" -Color "Gray"
    try {
        $process = Start-Process -FilePath "winget" -ArgumentList "install $WingetId --accept-package-agreements --silent" -PassThru -NoNewWindow
        $exited = $process.WaitForExit(180000)  # 3 minutos timeout

        if (-not $exited) {
            $process.Kill()
            Write-Msg "❌ Timeout en instalación" -Color "Red"
            return $false
        }

        if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq -1978335230) {
            # -1978335230 = ya estaba instalado (éxito también)
            $newVersion = & $VersionGetter
            if ($null -ne $newVersion) {
                Write-Msg "✅ Instalado: $newVersion" -Color "Green"
                return $true
            }
        }
        Write-Msg "❌ Error en instalación (exit: $LASTEXITCODE)" -Color "Red"
        return $false
    }
    catch {
        Write-Msg "❌ Excepción: $($_.Exception.Message)" -Color "Red"
        return $false
    }
}

function Install-PipPackages {
    Write-Section "Paquetes pip"

    $packages = @(
        @{ Name = "flake8"; MinVersion = "7.0.0" },
        @{ Name = "pytest"; MinVersion = "8.0.0" }
    )

    $allOk = $true

    foreach ($pkg in $packages) {
        $current = Get-PipPackageVersion -Package $pkg.Name

        if ($null -ne $current) {
            Write-Msg "✅ $($pkg.Name): $current" -Color "Green"
            continue
        }

        Write-Msg "Instalando $($pkg.Name)..." -Color "Yellow"
        try {
            $output = pip install $pkg.Name 2>&1
            if ($LASTEXITCODE -eq 0) {
                $version = Get-PipPackageVersion -Package $pkg.Name
                Write-Msg "✅ $($pkg.Name): $version" -Color "Green"
            }
            else {
                Write-Msg "❌ Error instalando $($pkg.Name)" -Color "Red"
                $allOk = $false
            }
        }
        catch {
            Write-Msg "❌ Excepción: $($_.Exception.Message)" -Color "Red"
            $allOk = $false
        }
    }

    return $allOk
}

# =============================================================================
# MODO VERIFICACIÓN
# =============================================================================

function Invoke-Verification {
    Write-Section "VERIFICACIÓN DE ENTORNO"

    $results = @{}

    # Node.js
    $nodeVersion = Get-NodeJsVersion
    if ($nodeVersion) {
        $ok = Test-VersionSatisfies -Installed $nodeVersion -Minimum $TARGET_VERSIONS.Nodejs.Min
        $status = if ($ok) { "✅" } else { "⚠️" }
        Write-Msg "$status Node.js: $nodeVersion" -Color $(if ($ok) { "Green" } else { "Yellow" })
        $results["Node.js"] = $ok
    }
    else {
        Write-Msg "❌ Node.js: No instalado" -Color "Red"
        $results["Node.js"] = $false
    }

    # Python
    $pyVersion = Get-PythonVersion
    if ($pyVersion) {
        $majorMinor = "$($pyVersion -split '\.')[0].$($pyVersion -split '\.')[1]"
        $ok = $majorMinor -eq "$($TARGET_VERSIONS.Python.Major).$($TARGET_VERSIONS.Python.Minor)"
        $status = if ($ok) { "✅" } else { "⚠️" }
        Write-Msg "$status Python: $pyVersion" -Color $(if ($ok) { "Green" } else { "Yellow" })
        $results["Python"] = $ok
    }
    else {
        Write-Msg "❌ Python: No instalado" -Color "Red"
        $results["Python"] = $false
    }

    # Go
    $goVersion = Get-GoVersion
    if ($goVersion) {
        $ok = Test-VersionSatisfies -Installed $goVersion -Minimum $TARGET_VERSIONS.Go.Min
        $status = if ($ok) { "✅" } else { "⚠️" }
        Write-Msg "$status Go: $goVersion" -Color $(if ($ok) { "Green" } else { "Yellow" })
        $results["Go"] = $ok
    }
    else {
        Write-Msg "❌ Go: No instalado" -Color "Red"
        $results["Go"] = $false
    }

    # pip packages
    Write-Host ""
    $flake8 = Get-PipPackageVersion -Package "flake8"
    $pytest = Get-PipPackageVersion -Package "pytest"

    if ($flake8) { Write-Msg "✅ flake8: $flake8" -Color "Green" } else { Write-Msg "❌ flake8: No instalado" -Color "Red"; $results["flake8"] = $false }
    if ($pytest) { Write-Msg "✅ pytest: $pytest" -Color "Green" } else { Write-Msg "❌ pytest: No instalado" -Color "Red"; $results["pytest"] = $false }

    # Resumen
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor $(if ($results.Values -contains $false) { "Yellow" } else { "Green" })
    $passed = ($results.Values -contains $false) -eq $false
    if ($passed) {
        Write-Host "  ENTORNO COMPLETO" -ForegroundColor "Green"
    }
    else {
        Write-Host "  FALTAN COMPONENTES" -ForegroundColor "Yellow"
    }
    Write-Host ("=" * 60) -ForegroundColor $(if ($passed) { "Green" } else { "Yellow" })

    return $passed
}

# =============================================================================
# INSTALACIÓN COMPLETA
# =============================================================================

function Invoke-Installation {
    # Limpiar log anterior
    if (Test-Path $LOG_FILE) { Remove-Item $LOG_FILE -Force }

    Write-Section "INSTALACIÓN DE ENTORNO DE DESARROLLO"
    Write-Msg "Version: $SCRIPT_VERSION"
    Write-Msg "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    Write-Host ""

    # Verificar winget
    try {
        $wingetVer = winget --version 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Msg "❌ winget no disponible" -Color "Red"
            Write-Msg "Instala Windows Package Manager: https://aka.ms/getwinget" -Color "Yellow"
            exit 1
        }
        Write-Msg "✅ winget disponible" -Color "Green"
    }
    catch {
        Write-Msg "❌ Error verificando winget" -Color "Red"
        exit 1
    }

    # Instalar componentes
    $results = @{}

    $results["Node.js"] = Install-IfNeeded `
        -Name "Node.js" `
        -WingetId "OpenJS.NodeJS.LTS" `
        -VersionGetter ${Function:Get-NodeJsVersion} `
        -MinimumVersion $TARGET_VERSIONS.Nodejs.Min

    $results["Python"] = Install-IfNeeded `
        -Name "Python" `
        -WingetId "Python.Python.3.12" `
        -VersionGetter ${Function:Get-PythonVersion} `
        -MinimumVersion "$($TARGET_VERSIONS.Python.Major).$($TARGET_VERSIONS.Python.Minor).0"

    $results["Go"] = Install-IfNeeded `
        -Name "Go" `
        -WingetId "GoLang.Go" `
        -VersionGetter ${Function:Get-GoVersion} `
        -MinimumVersion $TARGET_VERSIONS.Go.Min

    $results["pip packages"] = Install-PipPackages

    # Resumen
    Write-Host ""
    Write-Section "RESULTADO FINAL"

    $passed = ($results.Values -contains $false) -eq $false

    foreach ($key in $results.Keys) {
        $status = if ($results[$key]) { "✅" } else { "❌" }
        Write-Msg "$status $key" -Color $(if ($results[$key]) { "Green" } else { "Red" })
    }

    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor $(if ($passed) { "Green" } else { "Yellow" })
    if ($passed) {
        Write-Host "  INSTALACIÓN COMPLETA EXITOSA" -ForegroundColor "Green"
    }
    else {
        Write-Host "  INSTALACIÓN COMPLETA CON ERRORES" -ForegroundColor "Yellow"
    }
    Write-Host ("=" * 60) -ForegroundColor $(if ($passed) { "Green" } else { "Yellow" })

    Write-Host ""
    Write-Msg "Reinicia tu terminal para que los cambios de PATH surtan efecto." -Color "Gray"
    Write-Msg "Log guardado en: $LOG_FILE" -Color "Gray"

    return $passed
}

# =============================================================================
# AYUDA
# =============================================================================

function Show-Help {
    Write-Host @"
======================================================================
  dev-env-install.ps1 v$SCRIPT_VERSION
======================================================================

DESCRIPCIÓN:
  Instala automáticamente el entorno de desarrollo para
  vCenter Provisioner CI/CD Pipeline.

HERRAMIENTAS:
  - Node.js 18+  → npm run lint, npm test
  - Python 3.12+ → flake8, pytest
  - Go 1.24+     → go vet, go test

USO:
  .\dev-env-install.ps1         # Instalar todo
  .\dev-env-install.ps1 --verify   # Solo verificar
  .\dev-env-install.ps1 --help     # Esta ayuda

REQUISITOS:
  - Windows 10/11 con winget
  - Conexión a internet
  - Opcional: permisos de administrador

NOTAS:
  - Detecta automáticamente qué está ya instalado
  - Usa winget para instalaciones limpias
  - Verifica versiones mínimas requeridas

EJEMPLOS:
  # Instalar entorno completo
  .\dev-env-install.ps1

  # Verificar qué hay instalado
  .\dev-env-install.ps1 --verify

======================================================================
"@
}

# =============================================================================
# MAIN
# =============================================================================

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host "  dev-env-install.ps1 v$SCRIPT_VERSION" -ForegroundColor Cyan
Write-Host "  Entorno de Desarrollo Automatizado" -ForegroundColor Gray
Write-Host ("=" * 60) -ForegroundColor Cyan

if ($Help) {
    Show-Help
    exit 0
}

if ($Verify) {
    $result = Invoke-Verification
    exit $(if ($result) { 0 } else { 1 })
}

$result = Invoke-Installation
exit $(if ($result) { 0 } else { 1 })
