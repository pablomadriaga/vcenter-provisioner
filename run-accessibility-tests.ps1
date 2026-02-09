#!/usr/bin/env pwsh

# Accessibility Test Runner for vCenter Provisioner
# Staff-Grade: Automated WCAG 2.1 AA compliance testing

[CmdletBinding()]
param(
    [switch]$SkipDocker,
    [switch]$StopAfter,
    [switch]$FullReport,
    [string]$Browser = "chromium"
)

$ErrorActionPreference = "Stop"
$BASE_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$COMPOSE_DIR = Join-Path $BASE_DIR "infra\local"
$UI_DIR = Join-Path $BASE_DIR "apps\provisioner-ui"

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

function Install-AxeDependencies {
    Write-Log "Checking axe-core dependencies..."
    Push-Location $UI_DIR
    try {
        if (-not (Test-Path "node_modules\@axe-core\playwright")) {
            Write-Log "Installing @axe-core/playwright..."
            npm install @axe-core/playwright --save-dev
            Write-Log "@axe-core/playwright installed" "SUCCESS"
        } else {
            Write-Log "@axe-core/playwright already installed" "INFO"
        }
    } catch {
        Write-Log "Failed to install @axe-core/playwright: $($_.Exception.Message)" "ERROR"
        exit 1
    } finally {
        Pop-Location
    }
}

function Run-AccessibilityTests {
    Write-Log "Running accessibility tests..."
    Push-Location $UI_DIR
    try {
        $testCommand = "npm test -- e2e/accessibility/accessibility.spec.ts"
        
        if ($FullReport) {
            $testCommand = "$testCommand --reporter=list"
        }
        
        Invoke-Expression $testCommand
        $testResult = $LASTEXITCODE
        
        if ($testResult -eq 0) {
            Write-Log "All accessibility tests passed" "SUCCESS"
        } else {
            Write-Log "Some accessibility tests failed" "ERROR"
        }
        
        return $testResult
    } catch {
        Write-Log "Error running accessibility tests: $($_.Exception.Message)" "ERROR"
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
    
    # Install axe-core dependencies
    Install-AxeDependencies
    
    # Run accessibility tests
    $testResult = Run-AccessibilityTests
    
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
