#!/usr/bin/env pwsh

# Integration Test Runner for vCenter Provisioner
# Staff-Grade: Robust error handling, service management, automated testing

[CmdletBinding()]
param(
    [switch]$SkipDocker,
    [switch]$StopAfter
)

$ErrorActionPreference = "Stop"
$BASE_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$COMPOSE_DIR = Join-Path $BASE_DIR "infra\local"
$API_GATEWAY_DIR = Join-Path $BASE_DIR "apps\api-gateway"

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
        Write-Log "Waiting 10 seconds for services to initialize..."
        Start-Sleep -Seconds 10
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

function Run-IntegrationTests {
    Write-Log "Running integration tests..."
    Push-Location $API_GATEWAY_DIR
    try {
        $testCommand = "npm test -- integration-real.test.ts"
        if ($Verbose) {
            $testCommand = "$testCommand --reporter=verbose"
        }
        
        Invoke-Expression $testCommand
        $testResult = $LASTEXITCODE
        
        if ($testResult -eq 0) {
            Write-Log "All integration tests passed" "SUCCESS"
        } else {
            Write-Log "Some integration tests failed" "ERROR"
        }
        
        return $testResult
    } catch {
        Write-Log "Error running tests: $($_.Exception.Message)" "ERROR"
        return 1
    } finally {
        Pop-Location
    }
}

$servicesStarted = $false

try {
    if (-not $SkipDocker) {
        Start-Services
        $servicesStarted = $true
        
        # Wait for critical services
        $gatewayReady = Wait-ForService -Name "Gateway" -Url "http://localhost:3000/health"
        $authReady = Wait-ForService -Name "Auth Service" -Url "http://localhost:3001/health"
        
        if (-not $gatewayReady -or -not $authReady) {
            Write-Log "Critical services not ready, aborting" "ERROR"
            exit 1
        }
    }
    
    # Wait for additional services
    Wait-ForService -Name "Typing Service" -Url "http://localhost:8000/health" -MaxAttempts 20
    Wait-ForService -Name "VM Orchestrator" -Url "http://localhost:8080/health" -MaxAttempts 20
    
    $testResult = Run-IntegrationTests
    
    exit $testResult
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
