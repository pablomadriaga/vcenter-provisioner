#!/usr/bin/env pwsh

# OWASP ZAP Security Scan for vCenter Provisioner
# Staff-Grade: Automated security vulnerability scanning

[CmdletBinding()]
param(
    [string]$TargetUrl = "http://localhost:3000",
    [switch]$SkipDocker,
    [switch]$StopAfter,
    [string]$OutputDir = "security-tests\zap-reports"
)

$ErrorActionPreference = "Stop"
$BASE_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$COMPOSE_DIR = Join-Path $BASE_DIR "infra\local"
$SEC_DIR = Join-Path $BASE_DIR "security-tests"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMsg = "[$timestamp] [$Level] $Message"
    if ($Level -eq "ERROR") {
        Write-Host $logMsg -ForegroundColor Red
    } elseif ($Level -eq "WARN") {
        Write-Host $logMsg -ForegroundColor Yellow
    } elseif ($Level -eq "SUCCESS") {
        Write-Host $logMsg -ForegroundColor Green
    } else {
        Write-Host $logMsg -ForegroundColor White
    }
}

function Start-Services {
    Write-Log "Starting services with docker-compose..."
    Push-Location $COMPOSE_DIR
    try {
        docker-compose up -d
        Write-Log "Services started" "SUCCESS"
        Write-Log "Waiting 15 seconds for services to initialize..."
        Start-Sleep -Seconds 15
    } catch {
        Write-Log "Failed to start services: $($_.Exception.Message)" "ERROR"
        exit 1
    } finally {
        Pop-Location
    }
}

function Stop-Services {
    Write-Log "Stopping services..."
    Push-Location $COMPOSE_DIR
    try {
        docker-compose down
        Write-Log "Services stopped" "SUCCESS"
    } catch {
        Write-Log "Failed to stop services: $($_.Exception.Message)" "WARN"
    } finally {
        Pop-Location
    }
}

function Wait-ForService {
    param(
        [string]$Name,
        [string]$Url,
        [int]$MaxAttempts = 30,
        [int]$IntervalSeconds = 2
    )
    
    Write-Log "Waiting for $Name at $Url..."
    $attempt = 0
    
    while ($attempt -lt $MaxAttempts) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                Write-Log "$Name is ready" "SUCCESS"
                return $true
            }
        } catch {
            # Service not ready yet
        }
        
        $attempt++
        if ($attempt -lt $MaxAttempts) {
            Start-Sleep -Seconds $IntervalSeconds
        }
    }
    
    Write-Log "$Name did not become ready in time" "ERROR"
    return $false
}

function Check-ZapInstalled {
    $zapInstalled = Get-Command zap-cli -ErrorAction SilentlyContinue
    
    if (-not $zapInstalled) {
        Write-Log "OWASP ZAP is not installed. Please install from: https://www.zaproxy.org/" "WARN"
        Write-Log "Alternatively, use zap-cli: pip install zap-cli" "WARN"
        return $false
    }
    
    # Check if ZAP is running
    try {
        $zapStatus = zap-cli status 2>&1
        Write-Log "ZAP is installed and running" "INFO"
        return $true
    } catch {
        Write-Log "ZAP is installed but not running. Starting ZAP..." "WARN"
        return $false
    }
}

function Run-ZapScan {
    param(
        [string]$Url,
        [string]$OutputDir
    )
    
    Write-Log "Starting OWASP ZAP scan on $Url..."
    
    # Create output directory
    if (-not (Test-Path $OutputDir)) {
        New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    }
    
    try {
        # Spider the application
        Write-Log "Running spider..."
        zap-cli spider $Url -r
        
        # Active scan
        Write-Log "Running active scan..."
        zap-cli active-scan -r $Url
        
        # Generate reports
        Write-Log "Generating security reports..."
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        
        zap-cli report -o "$OutputDir\zap_report_$timestamp.html" -f html
        zap-cli report -o "$OutputDir\zap_report_$timestamp.json" -f json
        
        # Get alerts summary
        Write-Log "Getting alerts summary..."
        $alerts = zap-cli alerts -l High,Medium
        
        Write-Log "=== ZAP Scan Summary ===" "INFO"
        Write-Log "High Severity Alerts: $($alerts | Where-Object { $_.Risk -eq 'High' } | Measure-Object | Select-Object -ExpandProperty Count)" "INFO"
        Write-Log "Medium Severity Alerts: $($alerts | Where-Object { $_.Risk -eq 'Medium' } | Measure-Object | Select-Object -ExpandProperty Count)" "INFO"
        Write-Log "Low Severity Alerts: $($alerts | Where-Object { $_.Risk -eq 'Low' } | Measure-Object | Select-Object -ExpandProperty Count)" "INFO"
        Write-Log "Informational Alerts: $($alerts | Where-Object { $_.Risk -eq 'Informational' } | Measure-Object | Select-Object -ExpandProperty Count)" "INFO"
        
        return 0
    }
    catch {
        Write-Log "ZAP scan failed: $($_.Exception.Message)" "ERROR"
        return 1
    }
}

$servicesStarted = $false

try {
    if (-not (Check-ZapInstalled)) {
        Write-Log "Please install OWASP ZAP and zap-cli before running this script" "ERROR"
        exit 1
    }
    
    if (-not $SkipDocker) {
        Start-Services
        $servicesStarted = $true
        
        # Wait for critical services
        $gatewayReady = Wait-ForService -Name "Gateway" -Url "http://localhost:3000/health"
        
        if (-not $gatewayReady) {
            Write-Log "Gateway service not ready, aborting" "ERROR"
            exit 1
        }
    }
    
    # Run ZAP scan
    $scanResult = Run-ZapScan -Url $TargetUrl -OutputDir $OutputDir
    
    exit $scanResult
}
catch {
    Write-Log "Unexpected error: $($_.Exception.Message)" "ERROR"
    exit 1
}
finally {
    if ($servicesStarted -and $StopAfter) {
        Stop-Services
    }
}
