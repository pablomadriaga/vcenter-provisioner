#!/usr/bin/env pwsh
# ============================================
# Test Script - vCenter Provisioner
# Ejecuta tests con reportes JUnit y HTML
# ============================================

$ErrorActionPreference = "Stop"

$script:testResults = @()
$script:totalTests = 0
$script:passedTests = 0
$script:failedTests = 0
$script:errorTests = 0

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

function Write-Pass {
    param([string]$Message)
    Write-Host "  ✅ $Message" -ForegroundColor Green
}

function Write-Fail {
    param([string]$Message)
    Write-Host "  ❌ $Message" -ForegroundColor Red
}

function Write-Result {
    param([string]$Service, [int]$Passed, [int]$Failed, [int]$Errors, [int]$Total)
    $color = if ($Failed -gt 0 -or $Errors -gt 0) { "Red" } else { "Green" }
    Write-Host "  $Service`: $Passed/$Total pasan" -ForegroundColor $Color
}

function Test-DatabaseConnection {
    $maxRetries = 30
    $retryCount = 0

    Write-Info "Esperando PostgreSQL..."

    while ($retryCount -lt $maxRetries) {
        $result = docker exec vcenter-provisioner-db pg_isready -U antigravity 2>&1
        if ($result -match "accepting connections") {
            return $true
        }
        Start-Sleep -Seconds 1
        $retryCount++
    }

    return $false
}

function Install-PytestPlugins {
    Write-Info "Verificando plugins de pytest..."

    # Verificar si pytest-html está instalado
    $pytestHtml = docker exec provisioner-typing python -c "import pytest_html" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Info "Instalando pytest-html..."
        docker exec provisioner-typing pip install pytest-html pytest-xdist 2>&1 | Out-Null
    }

    # Verificar si pytest-junit está instalado
    $pytestXml = docker exec provisioner-typing python -c "import pytest" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Info "Instalando pytest..."
        docker exec provisioner-typing pip install pytest 2>&1 | Out-Null
    }
}

function Run-ServiceTests {
    param(
        [string]$ServiceName,
        [string]$ContainerName
    )

    Write-Host "`n🧪 $ServiceName..." -ForegroundColor Yellow

    try {
        $output = docker exec $ContainerName python -m pytest app/ -v `
            --junitxml="/tmp/test-results/$ServiceName-junit.xml" `
            --html="/tmp/test-results/$ServiceName-report.html" `
            --self-contained-html `
            2>&1 | Out-String

        Write-Host $output

        # Parsear resultados
        if ($output -match "passed") {
            $match = $output | Select-String -Pattern "(\d+) passed"
            if ($match) {
                $passed = [int]$match.Matches.Groups[1].Value
                $script:passedTests += $passed
                $script:totalTests += $passed
            }
        }

        if ($output -match "failed") {
            $match = $output | Select-String -Pattern "(\d+) failed"
            if ($match) {
                $failed = [int]$match.Matches.Groups[1].Value
                $script:failedTests += $failed
                $script:totalTests += $failed
            }
        }

        if ($output -match "error") {
            $match = $output | Select-String -Pattern "(\d+) error"
            if ($match) {
                $error = [int]$match.Matches.Groups[1].Value
                $script:errorTests += $error
                $script:totalTests += $error
            }
        }

        # Verificar si hubo errores
        if ($output -match "FAILED|ERROR" -and $output -notmatch "passed.*failed.*error") {
            return $false
        }

        return $true

    } catch {
        Write-Fail "Error ejecutando tests: $_"
        $script:errorTests++
        $script:totalTests++
        return $false
    }
}

function New-HTMLReport {
    param(
        [string]$ReportPath,
        [string]$ServiceName,
        [string]$Status,
        [int]$Passed,
        [int]$Failed,
        [int]$Errors
    )

    $html = @"
<!DOCTYPE html>
<html>
<head>
    <title>Test Report - $ServiceName</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .passed { color: green; }
        .failed { color: red; }
        .error { color: orange; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #4CAF50; color: white; }
        tr:nth-child(even) { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Test Report - $ServiceName</h1>
    <div class="summary">
        <h2>Summary</h2>
        <p>Status: <strong>$Status</strong></p>
        <p>Passed: <span class="passed">$Passed</span></p>
        <p>Failed: <span class="failed">$Failed</span></p>
        <p>Errors: <span class="error">$Errors</span></p>
        <p>Total: <strong>$($Passed + $Failed + $Errors)</strong></p>
    </div>
</body>
</html>
"@

    $html | Out-File -FilePath $ReportPath -Encoding UTF8
}

function New-MasterHTMLReport {
    param(
        [string]$ReportPath,
        [array]$Results
    )

    $totalPassed = ($Results | Measure-Object -Property Passed -Sum).Sum
    $totalFailed = ($Results | Measure-Object -Property Failed -Sum).Sum
    $totalErrors = ($Results | Measure-Object -Property Errors -Sum).Sum
    $totalTests = $totalPassed + $totalFailed + $totalErrors

    $status = if ($totalFailed -eq 0 -and $totalErrors -eq 0) { "PASSED" } else { "FAILED" }
    $statusColor = if ($status -eq "PASSED") { "green" } else { "red" }

    $servicesHtml = $Results | ForEach-Object {
        @"
        <tr>
            <td>$($_.Service)</td>
            <td class="passed">$($_.Passed)</td>
            <td class="failed">$($_.Failed)</td>
            <td class="error">$($_.Errors)</td>
            <td>$($_.Duration)s</td>
            <td style="color: $(if ($_.Status -eq 'PASSED') { 'green' } else { 'red' })">$($_.Status)</td>
        </tr>
"@
    }

    $html = @"
<!DOCTYPE html>
<html>
<head>
    <title>Master Test Report - vCenter Provisioner</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }
        h2 { color: #555; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .summary-box { flex: 1; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-box.passed { background: #e8f5e9; border: 2px solid #4CAF50; }
        .summary-box.failed { background: #ffebee; border: 2px solid #f44336; }
        .summary-box.total { background: #e3f2fd; border: 2px solid #2196F3; }
        .summary-box .number { font-size: 36px; font-weight: bold; }
        .summary-box.passed .number { color: #4CAF50; }
        .summary-box.failed .number { color: #f44336; }
        .summary-box.total .number { color: #2196F3; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #4CAF50; color: white; }
        .passed { color: green; }
        .failed { color: red; }
        .error { color: orange; }
        .status { font-weight: bold; }
        .timestamp { color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧪 Master Test Report - vCenter Provisioner</h1>

        <div class="summary">
            <div class="summary-box total">
                <div class="number">$totalTests</div>
                <div>Total Tests</div>
            </div>
            <div class="summary-box passed">
                <div class="number">$totalPassed</div>
                <div>Passed</div>
            </div>
            <div class="summary-box failed">
                <div class="number">$totalFailed</div>
                <div>Failed</div>
            </div>
        </div>

        <h2>Service Results</h2>
        <table>
            <thead>
                <tr>
                    <th>Service</th>
                    <th>Passed</th>
                    <th>Failed</th>
                    <th>Errors</th>
                    <th>Duration</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                $servicesHtml
            </tbody>
        </table>

        <p class="timestamp">Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")</p>
    </div>
</body>
</html>
"@

    $html | Out-File -FilePath $ReportPath -Encoding UTF8
}

# ============================================
# MAIN
# ============================================

Write-Banner "Test Suite - vCenter Provisioner"

Push-Location (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent)

try {
    # Crear directorio de resultados
    $resultsDir = "test-results"
    if (-not (Test-Path $resultsDir)) {
        New-Item -ItemType Directory -Path $resultsDir | Out-Null
    }
    New-Item -ItemType Directory -Path "$resultsDir/services" -Force | Out-Null

    # Verificar que servicios estén corriendo
    Write-Section "Verificando servicios..."

    $requiredServices = @("provisioner-typing", "provisioner-auth")
    foreach ($service in $requiredServices) {
        $status = docker inspect -f '{{.State.Running}}' $service 2>&1
        if ($status -ne "true") {
            Write-Fail "$service no está corriendo. Ejecuta 'docker compose up -d' primero."
            Pop-Location
            exit 1
        }
        Write-Pass "$service está corriendo"
    }

    # Verificar conexión a PostgreSQL
    Write-Section "Verificando PostgreSQL..."
    if (-not (Test-DatabaseConnection)) {
        Write-Fail "No se pudo conectar a PostgreSQL"
        Pop-Location
        exit 1
    }
    Write-Pass "PostgreSQL está listo"

    # Instalar plugins necesarios
    Write-Section "Preparando pytest..."
    Install-PytestPlugins

    # Servicios a testear
    $services = @(
        @{ Name = "Typing Service"; Container = "provisioner-typing"; Path = "typing-service" },
        @{ Name = "Auth Service"; Container = "provisioner-auth"; Path = "auth-service" },
        @{ Name = "Stats Service"; Container = "provisioner-stats"; Path = "stats-service" }
    )

    $script:serviceResults = @()
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

    # Ejecutar tests de cada servicio
    foreach ($svc in $services) {
        $svcStopwatch = [System.Diagnostics.Stopwatch]::StartNew()

        $passed = 0
        $failed = 0
        $errors = 0

        # Verificar si el contenedor existe y está corriendo
        $containerStatus = docker inspect -f '{{.State.Running}}' $svc.Container 2>&1
        if ($containerStatus -ne "true") {
            Write-Warning "$($svc.Name) no está corriendo, saltando..."
            $serviceResults += @{
                Service = $svc.Name
                Passed = 0
                Failed = 0
                Errors = 0
                Duration = 0
                Status = "SKIPPED"
            }
            continue
        }

        # Crear directorio de resultados para el servicio
        New-Item -ItemType Directory -Path "$resultsDir/services/$($svc.Path)" -Force | Out-Null

        $result = Run-ServiceTests -ServiceName $svc.Name -ContainerName $svc.Container

        $svcStopwatch.Stop()

        # Parsear resultados del output
        $passed = 0
        $failed = 0
        $errors = 0

        if ($output -match "passed") {
            $match = $output | Select-String -Pattern "(\d+) passed" | Select-Object -Last 1
            if ($match) { $passed = [int]$match.Matches.Groups[1].Value }
        }
        if ($output -match "failed") {
            $match = $output | Select-String -Pattern "(\d+) failed" | Select-Object -Last 1
            if ($match) { $failed = [int]$match.Matches.Groups[1].Value }
        }
        if ($output -match "error") {
            $match = $output | Select-String -Pattern "(\d+) error" | Select-Object -Last 1
            if ($match) { $errors = [int]$match.Matches.Groups[1].Value }
        }

        $status = if ($failed -eq 0 -and $errors -eq 0) { "PASSED" } else { "FAILED" }

        $script:serviceResults += @{
            Service = $svc.Name
            Passed = $passed
            Failed = $failed
            Errors = $errors
            Duration = [math]::Round($svcStopwatch.Elapsed.TotalSeconds, 2)
            Status = $status
            Output = $output
        }

        Write-Result -Service $svc.Name -Passed $passed -Failed $failed -Errors $errors -Total ($passed + $failed + $errors)
    }

    $stopwatch.Stop()

    # Generar reportes
    Write-Section "Generando reportes..."

    # Reporte HTML master
    New-MasterHTMLReport -ReportPath "$resultsDir/master-report.html" -Results $script:serviceResults
    Write-Info "Master report: $resultsDir/master-report.html"

    # Copiar reportes individuales si existen
    foreach ($svc in $services) {
        $containerPath = "/tmp/test-results"
        $localPath = "$resultsDir/services/$($svc.Path)"

        # Copiar reportes del contenedor
        $files = docker exec $svc.Container find /tmp/test-results -name "*.html" -o -name "*.xml" 2>&1
        if ($LASTEXITCODE -eq 0 -and $files) {
            foreach ($file in $files.Split("`n")) {
                if ($file) {
                    $filename = [System.IO.Path]::GetFileName($file)
                    docker cp "$($svc.Container):$file" "$localPath/" 2>&1 | Out-Null
                }
            }
        }
    }

    # Copiar reportes JUnit al directorio principal
    foreach ($svc in $services) {
        $localPath = "$resultsDir/services/$($svc.Path)"
        $junitFiles = Get-ChildItem $localPath -Include "*-junit.xml" -Recurse
        foreach ($file in $junitFiles) {
            Copy-Item $file.Path "$resultsDir/" -Force
        }
    }

    # Resumen final
    Write-Section "Resumen Final"

    $totalPassed = ($script:serviceResults | Measure-Object -Property Passed -Sum).Sum
    $totalFailed = ($script:serviceResults | Measure-Object -Property Failed -Sum).Sum
    $totalErrors = ($script:serviceResults | Measure-Object -Property Errors -Sum).Sum
    $totalTests = $totalPassed + $totalFailed + $totalErrors

    Write-Host "`n" -NoNewline
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host "  RESUMEN DE TESTS" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host "  Total:  $totalTests tests" -ForegroundColor White
    Write-Host "  Passed: $totalPassed" -ForegroundColor Green
    Write-Host "  Failed: $totalFailed" -ForegroundColor Red
    Write-Host "  Errors: $totalErrors" -ForegroundColor Yellow
    Write-Host "  Tiempo: $([math]::Round($stopwatch.Elapsed.TotalSeconds, 2))s" -ForegroundColor Gray
    Write-Host ("=" * 60) -ForegroundColor Cyan

    Write-Host "`n📄 Reportes generados:"
    Write-Host "  - $resultsDir/master-report.html"
    Write-Host "  - $resultsDir/*-junit.xml"
    Write-Host "  - $resultsDir/services/*/*.html"

    if ($totalFailed -gt 0 -or $totalErrors -gt 0) {
        Write-Host "`n" -NoNewline
        Write-Host ("=" * 60) -ForegroundColor Red
        Write-Host "  ❌ TESTS FALLARON" -ForegroundColor Red
        Write-Host ("=" * 60) -ForegroundColor Red
        Pop-Location
        exit 1
    }

    Write-Host "`n" -NoNewline
    Write-Host ("=" * 60) -ForegroundColor Green
    Write-Host "  ✅ TODOS LOS TESTS PASARON" -ForegroundColor Green
    Write-Host ("=" * 60) -ForegroundColor Green

    Pop-Location
    exit 0

} catch {
    Write-Fail "Error durante tests: $_"
    Pop-Location
    exit 1
}
