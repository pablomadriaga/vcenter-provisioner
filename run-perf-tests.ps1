#!/usr/bin/env pwsh

# Performance Test Runner for vCenter Provisioner
# Staff-Grade: Robust error handling, k6 integration, performance metrics

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("auth", "provision", "full-flow")]
    [string]$TestType,
    
    [switch]$SkipDocker,
    [switch]$StopAfter,
    [string]$ApiUrl = "http://localhost:3000",
    [int]$VirtualUsers = 10,
    [int]$Duration = 60
)

$ErrorActionPreference = "Stop"
$BASE_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$COMPOSE_DIR = Join-Path $BASE_DIR "infra\local"
$PERF_DIR = Join-Path $BASE_DIR "perf-tests"

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

function Check-K6Installed {
    $k6Installed = Get-Command k6 -ErrorAction SilentlyContinue
    
    if (-not $k6Installed) {
        Write-Log "k6 is not installed. Installing..." "WARN"
        Write-Log "Please install k6 from: https://k6.io/docs/getting-started/installation/" "WARN"
        return $false
    }
    
    return $true
}

function Run-PerformanceTest {
    param(
        [string]$TestFile,
        [string]$TestName
    )
    
    Write-Log "Running $TestName performance test..."
    Push-Location $PERF_DIR
    try {
        $env:API_URL = $ApiUrl
        
        $testCommand = "k6 run $TestFile --out json=test-results.json"
        
        Invoke-Expression $testCommand
        $testResult = $LASTEXITCODE
        
        if ($testResult -eq 0) {
            Write-Log "$TestName test completed" "SUCCESS"
        } else {
            Write-Log "$TestName test failed" "ERROR"
        }
        
        return $testResult
    } catch {
        Write-Log "Error running $TestName test: $($_.Exception.Message)" "ERROR"
        return 1
    } finally {
        Pop-Location
    }
}

$servicesStarted = $false

try {
    if (-not (Check-K6Installed)) {
        exit 1
    }
    
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
    
    # Run selected test
    switch ($TestType) {
        "auth" {
            $testFile = "auth-load-test.js"
            $testName = "Authentication Load Test"
        }
        "provision" {
            $testFile = "provision-load-test.js"
            $testName = "Provisioning Load Test"
        }
        "full-flow" {
            $testFile = "full-flow-load-test.js"
            $testName = "Full Flow Load Test"
        }
    }
    
    $testResult = Run-PerformanceTest -TestFile $testFile -TestName $testName
    
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
