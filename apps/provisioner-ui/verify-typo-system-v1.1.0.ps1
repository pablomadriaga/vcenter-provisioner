# Verification Script for Typification System Implementation v1.1.0

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Typification System v1.1.0" -ForegroundColor Cyan
Write-Host "Implementation Verification" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/6] Checking container status..." -ForegroundColor Yellow
$containers = docker ps --filter "name=provisioner" --format "table {{.Names}}\t{{.Status}}"
Write-Host ""
Write-Host $containers -ForegroundColor White

Write-Host "`n[2/6] Checking UI accessibility..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ UI is accessible at http://localhost:5173" -ForegroundColor Green
    } else {
        Write-Host "✗ UI returned status code: $($response.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ UI is not accessible!" -ForegroundColor Red
}

Write-Host "`n[3/6] Checking API Gateway..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ API Gateway is healthy" -ForegroundColor Green
    } else {
        Write-Host "✗ API Gateway returned status code: $($response.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ API Gateway is not accessible" -ForegroundColor Red
}

Write-Host "`n[4/6] Checking Typing Service..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Typing Service is healthy" -ForegroundColor Green
    } else {
        Write-Host "✗ Typing Service returned status code: $($response.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Typing Service is not accessible" -ForegroundColor Red
}

Write-Host "`n[5/6] Checking VM Orchestrator..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ VM Orchestrator is healthy" -ForegroundColor Green
    } else {
        Write-Host "✗ VM Orchestrator returned status code: $($response.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ VM Orchestrator is not accessible" -ForegroundColor Red
}

Write-Host "`n[6/6] Testing API Endpoints..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Testing Typification API..." -ForegroundColor Cyan

# Test GET /typing/templates
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/typing/templates" -UseBasicParsing -TimeoutSec 5
    $templates = $response.Content | ConvertFrom-Json
    Write-Host "✓ GET /typing/templates - Found $($templates.Count) typifications" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to get typifications: $_" -ForegroundColor Red
}

# Test POST /typing/templates
try {
    $body = @{
        name = "test-typification"
        prefijo1 = "TST"
        prefijo2 = "WEB"
        seq_digits = 3
    } | ConvertTo-Json
    $response = Invoke-WebRequest -Uri "http://localhost:3000/typing/templates" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 5
    $result = $response.Content | ConvertFrom-Json
    Write-Host "✓ POST /typing/templates - Created typification with ID: $($result.id)" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to create typification: $_" -ForegroundColor Red
}

# Test POST /typing/generate-name/{template_id}
try {
    $templateId = 1
    $manualValue = "proj1"
    $response = Invoke-WebRequest -Uri "http://localhost:3000/typing/generate-name/$templateId" -Method POST -Body "`"$manualValue`"" -ContentType "application/json" -UseBasicParsing -TimeoutSec 5
    $result = $response.Content | ConvertFrom-Json
    Write-Host "✓ POST /typing/generate-name/$templateId" -ForegroundColor Green
    Write-Host "  Generated name: $($result.full_name)" -ForegroundColor White
    Write-Host "  Next sequence: $($result.next_seq)" -ForegroundColor White
} catch {
    Write-Host "✗ Failed to generate name: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "IMPLEMENTATION COMPLETE" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "What was implemented:" -ForegroundColor White
Write-Host ""
Write-Host "Backend Changes:" -ForegroundColor Cyan
Write-Host "• typing-service: New simplified TypificationTemplate model" -ForegroundColor Gray
Write-Host "• typing-service: Alphanumeric validation for all fields" -ForegroundColor Gray
Write-Host "• typing-service: PUT /typing/templates/{id} for editing" -ForegroundColor Gray
Write-Host "• typing-service: Orphaned VM tracking with is_active flag" -ForegroundColor Gray
Write-Host "• vm-orchestrator: Updated to accept single manual_value" -ForegroundColor Gray
Write-Host "• vm-orchestrator: Updated tests for new structure" -ForegroundColor Gray
Write-Host ""
Write-Host "Frontend Changes:" -ForegroundColor Cyan
Write-Host "• NEW: TypificationsPage (/typifications)" -ForegroundColor Gray
Write-Host "• NEW: Typification creation and editing" -ForegroundColor Gray
Write-Host "• NEW: Real-time naming pattern preview" -ForegroundColor Gray
Write-Host "• UPDATED: Dashboard with typification integration" -ForegroundColor Gray
Write-Host "• REMOVED: Manual VM name input (now auto-generated)" -ForegroundColor Gray
Write-Host "• UPDATED: App.tsx with typifications route" -ForegroundColor Gray
Write-Host ""
Write-Host "Documentation:" -ForegroundColor Cyan
Write-Host "• NEW: docs/TYPIFICATIONS.md (comprehensive guide)" -ForegroundColor Gray
Write-Host "• UPDATED: provisioner-ui/README.md (v1.1.0)" -ForegroundColor Gray
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "MANUAL TESTING INSTRUCTIONS" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Please test the following at http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "1. LOGIN:" -ForegroundColor Yellow
Write-Host "   - Username: admin" -ForegroundColor Gray
Write-Host "   - Password: password123" -ForegroundColor Gray
Write-Host ""
Write-Host "2. CREATE TYPO:" -ForegroundColor Yellow
Write-Host "   - Navigate to /typifications" -ForegroundColor Gray
Write-Host "   - Click 'New Typification'" -ForegroundColor Gray
Write-Host "   - Name: 'Test Servers'" -ForegroundColor Gray
Write-Host "   - Prefijo1: 'SRV'" -ForegroundColor Gray
Write-Host "   - Prefijo2: 'TST'" -ForegroundColor Gray
Write-Host "   - Sequence Digits: '3'" -ForegroundColor Gray
Write-Host "   - Check preview: SRV-TST-{MANUAL}-001" -ForegroundColor Gray
Write-Host "   - Click 'Create'" -ForegroundColor Gray
Write-Host ""
Write-Host "3. CREATE VM:" -ForegroundColor Yellow
Write-Host "   - Navigate to /dashboard" -ForegroundColor Gray
Write-Host "   - Select 'Test Servers' typification" -ForegroundColor Gray
Write-Host "   - Manual Value: 'proj1' (type and verify NO focus loss)" -ForegroundColor Gray
Write-Host "   - Check VM Name Preview: SRV-TST-proj1-001" -ForegroundColor Gray
Write-Host "   - Fill in Description, Template, Specs" -ForegroundColor Gray
Write-Host "   - Click 'Create VM'" -ForegroundColor Gray
Write-Host ""
Write-Host "4. VERIFY FOCUS BEHAVIOR:" -ForegroundColor Yellow
Write-Host "   - Typification Name field: Type characters one by one" -ForegroundColor Gray
Write-Host "   - Typification Prefijo1 field: Type characters one by one" -ForegroundColor Gray
Write-Host "   - Typification Prefijo2 field: Type characters one by one" -ForegroundColor Gray
Write-Host "   - Dashboard Manual Value field: Type characters one by one" -ForegroundColor Gray
Write-Host "   - Dashboard Description field: Type characters one by one" -ForegroundColor Gray
Write-Host "   - Dashboard Numeric fields: Type characters one by one" -ForegroundColor Gray
Write-Host ""
Write-Host "Expected Result:" -ForegroundColor Green
Write-Host "✓ All fields should maintain focus while typing" -ForegroundColor White
Write-Host "✓ No clicking or extra taps needed" -ForegroundColor White
Write-Host "✓ Smooth, responsive user experience" -ForegroundColor White
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Verification Complete" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
