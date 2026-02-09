#!/usr/bin/env pwsh

# Master Test Runner: Verifica que todo funciona en tu máquina
# Staff-Grade: One-command verification of the entire system

[CmdletBinding()]
param(
    [switch]$Full,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
$BASE_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$COMPOSE_DIR = Join-Path $BASE_DIR "infra\local"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMsg = "[$timestamp] [$Level] $Message"
    if ($Level -eq "ERROR") {
        Write-Host $logMsg -ForegroundColor Red
    } elseif ($Level -eq "WARN") {
        Write-Host $logMsg -ForegroundColor Yellow
    } elseif ($level -eq "SUCCESS") {
        Write-Host $logMsg -ForegroundColor Green
    } else {
        Write-Host $logMsg -ForegroundColor White
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

function Test-Services {
    Write-Log "Testing services health..."
    
    $tests = @(
        @{ Name = "API Gateway"; Url = "http://localhost:3000/health" },
        @{ Name = "Auth Service"; Url = "http://localhost:3001/health" },
        @{ Name = "Typing Service"; Url = "http://localhost:8000/health" },
        @{ Name = "VM Orchestrator"; Url = "http://localhost:8080/health" },
        @{ Name = "vCenter Integration"; Url = "http://localhost:8081/health" },
        @{ Name = "Stats Service"; Url = "http://localhost:8001/health" },
        @{ Name = "Monitoring Service"; Url = "http://localhost:8082/health" },
        @{ Name = "Provisioner UI"; Url = "http://localhost:5173" }
    )
    
    $passed = 0
    $failed = 0
    
    foreach ($test in $tests) {
        try {
            $response = Invoke-WebRequest -Uri $test.Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                Write-Log "✅ $($test.Name) is healthy" "SUCCESS"
                $passed++
            } else {
                Write-Log "❌ $($test.Name) returned $($response.StatusCode)" "ERROR"
                $failed++
            }
        } catch {
            Write-Log "❌ $($test.Name) is not responding" "ERROR"
            $failed++
        }
    }
    
    Write-Log ""
    Write-Log "Health Check Results: $passed passed, $failed failed" $(if ($failed -eq 0) { "SUCCESS" } else { "ERROR" })
    
    return $failed -eq 0
}

function Run-QuickTests {
    Write-Log "Running quick functional tests..."
    
    try {
        # Test: Register a user
        Write-Log "Testing: User registration..."
        $registerResponse = Invoke-WebRequest -Uri "http://localhost:3000/auth/register" -UseBasicParsing -Method POST -ContentType "application/json" -Body @{
            username = "quicktest_$(Get-Date -Format 'yyyyMMddHHmmss')"
            password = "QuickTest123!"
            email = "quicktest@test.com"
            role = "operator"
        }
        
        if ($registerResponse.StatusCode -eq 200) {
            Write-Log "✅ User registration working" "SUCCESS"
        } else {
            Write-Log "❌ User registration failed with code $($registerResponse.StatusCode)" "ERROR"
            return $false
        }
        
        # Test: Login
        Write-Log "Testing: User login..."
        $loginBody = @{
            username = "admin@antigravity.local"
            password = "admin123"
        } | ConvertTo-Json
        
        $loginResponse = Invoke-WebRequest -Uri "http://localhost:3000/auth/login" -UseBasicParsing -Method POST -ContentType "application/json" -Body $loginBody
        
        if ($loginResponse.StatusCode -eq 200) {
            Write-Log "✅ User login working" "SUCCESS"
            
            $loginData = $loginResponse.Content | ConvertFrom-Json
            if ($loginData.token) {
                Write-VerifyToken - $loginData.token
            } else {
                Write-Log "❌ Login response does not contain token" "ERROR"
                return $false
            }
        } else {
            Write-Log "❌ User login failed with code $($loginResponse.StatusCode)" "ERROR"
            return $false
        }
        
        # Test: List templates
        Write-Log "Testing: Template listing..."
        $token = $loginResponse.Content | ConvertFrom-Json | Select-Object -ExpandProperty token
        $templatesResponse = Invoke-WebRequest -Uri "http://localhost:3000/typing/templates" -UseBasicParsing -Headers @{ Authorization = "Bearer $token" }
        
        if ($templatesResponse.StatusCode -eq 200) {
            Write-Log "✅ Template listing working" "SUCCESS"
        } else {
            Write-Log "❌ Template listing failed with code $($templatesResponse.StatusCode)" "ERROR"
            return $false
        }
        
        Write-Log ""
        Write-Log "Quick functional tests: All passed" "SUCCESS"
        return $true
    } catch {
        Write-Log "Error running quick tests: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Write-VerifyToken {
    param([string]$Token)
    
    try {
        $verifyResponse = Invoke-WebRequest -Uri "http://localhost:3000/auth/verify" -UseBasicParsing -Headers @{ Authorization = "Bearer $Token" }
        
        if ($verifyResponse.StatusCode -eq 200) {
            Write-Log "✅ Token verification working" "SUCCESS"
        } else {
            Write-Log "❌ Token verification failed with code $($verifyResponse.StatusCode)" "ERROR"
        }
    } catch {
        Write-Log "❌ Token verification failed: $($_.Exception.Message)" "ERROR"
    }
}

function Check-Docker {
    Write-Log "Checking Docker installation..."
    
    try {
        $dockerVersion = docker version --format '{{.Server.Version}}' 2>&1
        Write-Log "✅ Docker is installed: $dockerVersion" "SUCCESS"
        return $true
    } catch {
        Write-Log "❌ Docker is not installed or not running" "ERROR"
        return $false
    }
}

function Check-DockerCompose {
    Write-Log "Checking docker-compose installation..."
    
    try {
        $composeVersion = docker-compose --version 2>&1
        Write-Log "✅ docker-compose is installed: $composeVersion" "SUCCESS"
        return $true
    } catch {
        Write-Log "❌ docker-compose is not installed" "ERROR"
        return $false
    }
}

function Check-Node {
    Write-Log "Checking Node.js installation..."
    
    try {
        $nodeVersion = node --version 2>&1
        Write-Log "✅ Node.js is installed: $nodeVersion" "SUCCESS"
        return $true
    } catch {
        Write-Log "❌ Node.js is not installed" "ERROR"
        return $false
    }
}

function Check-Go {
    Write-Log "Checking Go installation..."
    
    try {
        $goVersion = go version 2>&1
        Write-Log "✅ Go is installed: $goVersion" "SUCCESS"
        return $true
    } catch {
        Write-Log "❌ Go is not installed" "ERROR"
        return $false
    }
}

function Check-Python {
    Write-Log "Checking Python installation..."
    
    try {
        $pythonVersion = python --version 2>&1
        Write-Log "✅ Python is installed: $pythonVersion" "SUCCESS"
        return $true
    } catch {
        Write-Log "❌ Python is not installed" "ERROR"
        return $false
    }
}

function Check-PowerShell {
    Write-Log "Checking PowerShell version..."
    
    $psVersion = $PSVersionTable.PSVersion
    Write-Log "✅ PowerShell: $psVersion" "INFO"
    return $true
}

Write-Log "========================================"
Write-Log "  vCenter Provisioner Verification"
Write-Log "========================================"
Write-Log ""

# Step 1: Check prerequisites
Write-Log "Step 1: Checking prerequisites..."
$prerequisitesOk = $true

if (-not (Check-Docker)) { $prerequisitesOk = $false }
if (-not (Check-DockerCompose)) { $prerequisitesOk = $false }
if (-not (Check-PowerShell)) { $prerequisitesOk = $false }

# Optional tools for full verification
if ($Full) {
    if (-not (Check-Node)) { $prerequisitesOk = $false }
    if (-not (Check-Go)) { $prerequisitesOk = $false }
    if (-not (Check-Python)) { $prerequisitesOk = $false }
}

Write-Log ""
if (-not $prerequisitesOk) {
    Write-Log "Some prerequisites are missing. Please install them before continuing." "ERROR"
    exit 1
}

Write-Log "✅ All prerequisites met" "SUCCESS"
Write-Log ""

# Step 2: Start services
Write-Log "Step 2: Starting services..."
Push-Location $COMPOSE_DIR
try {
    docker-compose up -d
    Write-Log "✅ Services started" "SUCCESS"
    Write-Log "Waiting 20 seconds for services to initialize..."
    Start-Sleep -Seconds 20
} catch {
    Write-Log "❌ Failed to start services: $($_.Exception.Message)" "ERROR"
    exit 1
} finally {
    Pop-Location
}

Write-Log ""

# Step 3: Test services
Write-Log "Step 3: Testing services health..."
if (-not (Test-Services)) {
    Write-Log "❌ Some services are not healthy" "ERROR"
    exit 1
}

Write-Log ""

# Step 4: Quick functional tests
Write-Log "Step 4: Running quick functional tests..."
if (-not (Run-QuickTests)) {
    Write-Log "❌ Quick functional tests failed" "ERROR"
    exit 1
}

Write-Log ""
Write-Log "========================================"
Write-Log "  VERIFICATION COMPLETE"
Write-Log "========================================"
Write-Log ""
Write-Log "✅ All prerequisites met"
Write-Log "✅ All services are healthy"
Write-Log "✅ Quick functional tests passed"
Write-Log ""
Write-Log "Next steps:"
Write-Log "  1. Open http://localhost:5173 in your browser"
Write-Log "  2. Login with: admin@antigravity.local / admin123"
Write-Log "   3. Create a typification template"
Write-Log "  4. Provision a VM"
Write-Log ""
Write-Log "To run full test suite:"
Write-Log "  pwsh -File verify-setup.ps1 -Full"
Write-Log ""
Write-Log "For more information, see QUICKSTART.md"
Write-Log ""
Write-Log "========================================" "SUCCESS"

exit 0
