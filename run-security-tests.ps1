#!/usr/bin/env pwsh

# Security Test Runner for vCenter Provisioner
# Staff-Grade: Automated security testing (OWASP ZAP, Dependency Audit, Security Tests)

[CmdletBinding()]
param(
    [switch]$SkipZap,
    [switch]$SkipDependencyAudit,
    [switch]$SkipSecurityTests,
    [switch]$SkipDocker,
    [switch]$StopAfter
)

$ErrorActionPreference = "Stop"
$BASE_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$COMPOSE_DIR = Join-Path $BASE_DIR "infra\local"
$SEC_DIR = Join-Path $BASE_DIR "security-tests"
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

function Run-SecurityTests {
    Write-Log "Running security tests..."
    Push-Location $API_GATEWAY_DIR
    try {
        $testCommand = "npm test -- security.test.ts"
        
        Invoke-Expression $testCommand
        $testResult = $LASTEXITCODE
        
        if ($testResult -eq 0) {
            Write-Log "All security tests passed" "SUCCESS"
        } else {
            Write-Log "Some security tests failed" "ERROR"
        }
        
        return $testResult
    } catch {
        Write-Log "Error running security tests: $($_.Exception.Message)" "ERROR"
        return 1
    } finally {
        Pop-Location
    }
}

function Run-ZapScan {
    Write-Log "Running OWASP ZAP scan..."
    Push-Location $SEC_DIR
    try {
        $zapScript = "run-zap-scan.ps1"
        $zapArgs = @()
        
        if ($SkipDocker) {
            $zapArgs += "-SkipDocker"
        }
        if ($StopAfter) {
            $zapArgs += "-StopAfter"
        }
        
        $zapCommand = "pwsh -File $zapScript $($zapArgs -join ' ')"
        
        Invoke-Expression $zapCommand
        $zapResult = $LASTEXITCODE
        
        return $zapResult
    } catch {
        Write-Log "Error running ZAP scan: $($_.Exception.Message)" "ERROR"
        return 1
    } finally {
        Pop-Location
    }
}

function Run-DependencyAudit {
    Write-Log "Running dependency audit..."
    Push-Location $BASE_DIR
    try {
        $auditScript = "security-tests\run-dependency-audit.ps1"
        
        $auditCommand = "pwsh -File $auditScript"
        
        Invoke-Expression $auditCommand
        $auditResult = $LASTEXITCODE
        
        return $auditResult
    } catch {
        Write-Log "Error running dependency audit: $($_.Exception.Message)" "ERROR"
        return 1
    } finally {
        Pop-Location
    }
}

$servicesStarted = $false
$securityTestResult = 0
$zapResult = 0
$auditResult = 0

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
    
    # Run security tests
    if (-not $SkipSecurityTests) {
        $securityTestResult = Run-SecurityTests
    }
    
    # Run ZAP scan
    if (-not $SkipZap) {
        $zapResult = Run-ZapScan
    }
    
    # Run dependency audit
    if (-not $SkipDependencyAudit) {
        $auditResult = Run-DependencyAudit
    }
    
    # Summary
    Write-Log ""
    Write-Log "========================================"
    Write-Log "         SECURITY TEST SUMMARY" "INFO"
    Write-Log "========================================"
    
    if (-not $SkipSecurityTests) {
        Write-Log "Security Tests: " $(if ($securityTestResult -eq 0) { "PASSED" } else { "FAILED" }) $(if ($securityTestResult -eq 0) { "SUCCESS" } else { "ERROR" })
    }
    
    if (-not $SkipZap) {
        Write-Log "OWASP ZAP Scan: " $(if ($zapResult -eq 0) { "PASSED" } else { "COMPLETED WITH ISSUES" }) $(if ($zapResult -eq 0) { "SUCCESS" } else { "WARN" })
    }
    
    if (-not $SkipDependencyAudit) {
        Write-Log "Dependency Audit: " $(if ($auditResult -eq 0) { "PASSED" } else { "FAILED" }) $(if ($auditResult -eq 0) { "SUCCESS" } else { "ERROR" })
    }
    
    Write-Log "========================================"
    
    # Exit with error if any critical test failed
    if ($securityTestResult -ne 0 -or $auditResult -ne 0) {
        exit 1
    }
    
    exit 0
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
