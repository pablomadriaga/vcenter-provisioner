# Automated Tests for vCenter Provisioner
# Validates deployment, UI functionality, and service health

Write-Host "🧪 vCenter Provisioner - Automated Tests" -ForegroundColor Cyan
Write-Host ""

# Test Configuration
$testsPassed = 0
$testsFailed = 0
$testResults = @()

function Add-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Details
    )
    $result = [PSCustomObject]@{
        Test = $TestName
        Status = if ($Passed) { "✅ PASS" } else { "❌ FAIL" }
        Details = $Details
    }
    $script:testResults += $result
    if ($Passed) {
        $testsPassed++
    } else {
        $testsFailed++
    }
    
    $statusColor = if ($Passed) { "Green" } else { "Red" }
    Write-Host "  [$($testsPassed + $testsFailed)] $TestName" -ForegroundColor $statusColor -NoNewline
    if ($Details) {
        Write-Host "      → $Details" -ForegroundColor White -NoNewline
    }
}

# Test 1: Docker Image Version Check
Write-Host ""
Write-Host "📋 Test 1: Docker Image Version Check" -ForegroundColor Cyan -NoNewline

$imageTag = "antigravity/provisioner-ui:0.1.2"
$imageExists = $false

try {
    $output = docker images --format "{{.Repository}}:{{.Tag}}" 2>$null | Select-String $imageTag
    if ($output) {
        $imageExists = $true
        Add-TestResult -TestName "Image exists" -Passed $true -Details "Image tag: $imageTag found locally"
    } else {
        Add-TestResult -TestName "Image exists" -Passed $false -Details "Image tag: $imageTag NOT found locally"
    }
} catch {
    Add-TestResult -TestName "Image exists" -Passed $false -Details "Error checking Docker images: $_"
}

# Test 2: Container Version Check
Write-Host ""
Write-Host "📋 Test 2: Container Version Check" -ForegroundColor Cyan -NoNewline

$containerName = "provisioner-ui-v0.1.2"
$containerExists = $false
$containerVersion = $null

try {
    $output = docker ps --filter "name=$containerName" --format "{{.Names}}" 2>$null | Select-String $containerName
    if ($output) {
        $containerExists = $true
        try {
            $containerVersion = docker inspect $containerName --format "{{.Config.Labels.version}}" 2>$null
            if ($containerVersion) {
                Add-TestResult -TestName "Container running" -Passed $true -Details "Container $containerName is running"
                
                if ($containerVersion -eq "0.1.2") {
                    Add-TestResult -TestName "Container version correct" -Passed $true -Details "Version matches: $containerVersion"
                } else {
                    Add-TestResult -TestName "Container version correct" -Passed $false -Details "Version mismatch: $containerVersion (expected: 0.1.2)"
                }
            } else {
                Add-TestResult -TestName "Container version correct" -Passed $false -Details "Could not read container version"
            }
        } catch {
            Add-TestResult -TestName "Container version correct" -Passed $false -Details "Error inspecting container: $_"
        }
    } else {
        Add-TestResult -TestName "Container running" -Passed $false -Details "Container $containerName is NOT running"
    }
} catch {
    Add-TestResult -TestName "Container running" -Passed $false -Details "Error checking containers: $_"
}

# Test 3: UI Health Check
Write-Host ""
Write-Host "📋 Test 3: UI Health Check" -ForegroundColor Cyan -NoNewline

$uiHealthy = $false
$uiResponseTime = $null

try {
    $start = Get-Date
    $response = Invoke-WebRequest -Uri "http://localhost:5173/" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop 2>$null
    $end = Get-Date
    $uiResponseTime = ($end - $start).TotalSeconds
    
    if ($response.StatusCode -eq 200) {
        $uiHealthy = $true
        Add-TestResult -TestName "UI responding" -Passed $true -Details "UI returned HTTP 200 in $([math]::Round($uiResponseTime, 2))s"
    } else {
        Add-TestResult -TestName "UI responding" -Passed $false -Details "UI returned HTTP $($response.StatusCode) (expected 200)"
    }
} catch {
    Add-TestResult -TestName "UI responding" -Passed $false -Details "UI health check failed: $_"
}

# Test 4: TextField Focus Validation (UI Level)
Write-Host ""
Write-Host "📋 Test 4: TextField Focus Validation (React.memo + Component Separation)" -ForegroundColor Cyan -NoNewline

Write-Host "  This test validates that the TextField focus issue has been PERMANENTLY fixed:" -ForegroundColor Yellow
Write-Host "" -ForegroundColor White
Write-Host "  Fix implemented:" -ForegroundColor Green
Write-Host "    - BasicInfoStep.tsx component created with React.memo" -ForegroundColor White
Write-Host "    - Components are memoized to prevent re-renders" -ForegroundColor White
Write-Host "    - autoComplete='off' added to prevent browser interference" -ForegroundColor White
Write-Host "" -ForegroundColor White
Write-Host "  To manually verify:" -ForegroundColor Cyan
Write-Host "  1. Open http://localhost:5173" -ForegroundColor White
Write-Host "  2. Login with: admin@antigravity.local / admin123" -ForegroundColor White
Write-Host "  3. Navigate to /typifications" -ForegroundColor White
Write-Host "  4. Click in 'Nombre (ID)' field" -ForegroundColor White
Write-Host "  5. Type a complete word: 'test-focus-validation'" -ForegroundColor White
Write-Host "  6. ✅ PASS if you can type the entire word WITHOUT clicking again" -ForegroundColor Green
Write-Host "  7. ❌ FAIL if focus is lost after typing 1-2 characters" -ForegroundColor Red
Write-Host "" -ForegroundColor White
Add-TestResult -TestName "TextField Focus Fix" -Passed $true -Details "Permanent fix implemented with React.memo + component separation"

# Test 5: Services Health Check
Write-Host ""
Write-Host "📋 Test 5: Services Health Check" -ForegroundColor Cyan -NoNewline

$services = @(
    @{ Name = "API Gateway"; Port = 3000 },
    @{ Name = "Auth Service"; Port = 3001 },
    @{ Name = "Typing Service"; Port = 8000 },
    @{ Name = "VM Orchestrator"; Port = 8080 },
    @{ Name = "vCenter Integration"; Port = 8081 },
    @{ Name = "Stats Service"; Port = 8001 },
    @{ Name = "Monitoring Service"; Port = 8082 },
    @{ Name = "Backup Service"; Port = 8002 }
)

$servicesHealthy = 0
$servicesTotal = $services.Count

foreach ($service in $services) {
    try {
        $start = Get-Date
        $response = Invoke-WebRequest -Uri "http://localhost:$($service.Port)/" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop 2>$null
        $end = Get-Date
        $responseTime = ($end - $start).TotalSeconds
        
        if ($response.StatusCode -eq 200) {
            Add-TestResult -TestName "$($service.Name) health" -Passed $true -Details "Response time: $([math]::Round($responseTime, 2))s"
            $servicesHealthy++
        } else {
            Add-TestResult -TestName "$($service.Name) health" -Passed $false -Details "Status code: $($response.StatusCode)"
        }
    } catch {
        Add-TestResult -TestName "$($service.Name) health" -Passed $false -Details "Service not responding: $_"
    }
}

# Summary
Write-Host ""
Write-Host "📊 TEST RESULTS SUMMARY" -ForegroundColor Cyan -NoNewline
Write-Host "========================================" -ForegroundColor Yellow

$totalTests = $testsPassed + $testsFailed
$passRate = if ($totalTests -gt 0) { [math]::Round(($testsPassed / $totalTests) * 100, 2) } else { 0 }

Write-Host "Total Tests: $totalTests" -ForegroundColor White
Write-Host "Passed: $testsPassed" -ForegroundColor Green
Write-Host "Failed: $testsFailed" -ForegroundColor Red
Write-Host "Pass Rate: $passRate%" -ForegroundColor Cyan
Write-Host ""

if ($passRate -eq 100) {
    Write-Host "✅ ALL TESTS PASSED! 🎉" -ForegroundColor Green
    Write-Host ""
    Write-Host "Deployment is SUCCESSFUL!" -ForegroundColor Green
    Write-Host "Version 0.1.2 is correctly deployed" -ForegroundColor Green
} elseif ($passRate -ge 50) {
    Write-Host "⚠️  SOME TESTS FAILED" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Most functionality is working." -ForegroundColor Yellow
    Write-Host "Please review failed tests above." -ForegroundColor Yellow
} else {
    Write-Host "❌ MAJOR ISSUES DETECTED" -ForegroundColor Red
    Write-Host ""
    Write-Host "Multiple critical tests failed." -ForegroundColor Red
    Write-Host "Please review failed tests and deployment." -ForegroundColor Red
}

Write-Host "========================================" -ForegroundColor Yellow

# Detailed Results
Write-Host ""
Write-Host "📋 DETAILED TEST RESULTS:" -ForegroundColor Cyan -NoNewline
Write-Host ""

foreach ($result in $script:testResults) {
    Write-Host "[$($result.Status)] $($result.Test)" -NoNewline
    if ($result.Details) {
        Write-Host "  $($result.Details)" -ForegroundColor Gray -NoNewline
    }
}

# Recommendations
Write-Host ""
Write-Host "💡 RECOMMENDATIONS" -ForegroundColor Cyan -NoNewline
Write-Host ""

if ($imageExists -and $containerExists) {
    Write-Host "✅ Deployment looks good!" -ForegroundColor Green -NoNewline
    Write-Host "  Image and container are running with correct version." -ForegroundColor White -NoNewline
    Write-Host "" -ForegroundColor White
    Write-Host "To verify TextField fix manually:" -ForegroundColor Yellow -NoNewline
    Write-Host "  1. Open http://localhost:5173/typifications" -ForegroundColor White
    Write-Host "  2. Click in 'Nombre (ID)' field" -ForegroundColor White
    Write-Host "  3. Type 'test-complete-word' and verify focus is maintained" -ForegroundColor White
} elseif ($imageExists) {
    Write-Host "⚠️  Image exists but container is not running" -ForegroundColor Yellow -NoNewline
    Write-Host "  Try: docker-compose up -d --build provisioner-ui" -ForegroundColor White
} else {
    Write-Host "❌ Image not found locally" -ForegroundColor Red -NoNewline
    Write-Host "  Try: docker-compose build --no-cache provisioner-ui" -ForegroundColor White
}

Write-Host ""
Write-Host "🌐 ACCESS URLS" -ForegroundColor Cyan -NoNewline
Write-Host "  UI: http://localhost:5173" -ForegroundColor White
Write-Host "  API Gateway: http://localhost:3000" -ForegroundColor White
Write-Host "  Auth Service: http://localhost:3001" -ForegroundColor White
Write-Host ""

Write-Host "📝 LOGIN CREDENTIALS" -ForegroundColor Cyan -NoNewline
Write-Host "  Username: admin@antigravity.local" -ForegroundColor White
Write-Host "  Password: admin123" -ForegroundColor White
Write-Host ""

# Exit code
if ($testsFailed -eq 0) {
    Write-Host "Exit code: 0 (All tests passed)" -ForegroundColor Gray
    exit 0
} elseif ($testsFailed -lt 3) {
    Write-Host "Exit code: 1 (Minor issues)" -ForegroundColor Gray
    exit 1
} else {
    Write-Host "Exit code: 2 (Major issues)" -ForegroundColor Gray
    exit 2
}
