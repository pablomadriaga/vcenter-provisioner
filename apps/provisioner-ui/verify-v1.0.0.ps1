# Verification Script for New vCenter Provisioner UI v1.0.0

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "vCenter Provisioner UI v1.0.0" -ForegroundColor Cyan
Write-Host "Built from scratch - Simple and Clean" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/4] Checking container status..." -ForegroundColor Yellow
$container = docker ps --filter "name=provisioner-ui" --format "{{.Status}}"
if ($container) {
    Write-Host "✓ Container provisioner-ui is running: $container" -ForegroundColor Green
} else {
    Write-Host "✗ Container provisioner-ui not found!" -ForegroundColor Red
    exit 1
}

Write-Host "[2/4] Checking UI accessibility..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ UI is accessible at http://localhost:5173" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ UI is not accessible!" -ForegroundColor Red
    exit 1
}

Write-Host "[3/4] Checking image version..." -ForegroundColor Yellow
$imageInfo = docker inspect antigravity/provisioner-ui:1.0.0 --format "{{.Config.Labels.version}}"
$description = docker inspect antigravity/provisioner-ui:1.0.0 --format "{{.Config.Labels.description}}"
Write-Host "✓ Image version: $imageInfo" -ForegroundColor Green
Write-Host "  Description: $description" -ForegroundColor Gray

Write-Host ""
Write-Host "[4/4] TESTING FOCUS BEHAVIOR" -ForegroundColor Yellow
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "NEW UI ARCHITECTURE" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This is a COMPLETELY NEW UI built from scratch:" -ForegroundColor White
Write-Host ""
Write-Host "Key features:" -ForegroundColor Cyan
Write-Host "• Simple, clean architecture" -ForegroundColor Gray
Write-Host "• No complex component hierarchy" -ForegroundColor Gray
Write-Host "• No memoization or callbacks that could cause issues" -ForegroundColor Gray
Write-Host "• Direct event handling with inline handlers" -ForegroundColor Gray
Write-Host "• Plain CSS (no Material UI or Framer Motion)" -ForegroundColor Gray
Write-Host "• Standard React patterns" -ForegroundColor Gray
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "MANUAL TESTING INSTRUCTIONS" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Please test at http://localhost:5173:" -ForegroundColor White
Write-Host ""
Write-Host "1. LOGIN PAGE:" -ForegroundColor Yellow
Write-Host "   - Username: admin" -ForegroundColor Gray
Write-Host "   - Password: password123" -ForegroundColor Gray
Write-Host "   - Type username and password character by character" -ForegroundColor Gray
Write-Host "   - EXPECTED: Focus should REMAIN in each field while typing" -ForegroundColor Red
Write-Host ""
Write-Host "2. DASHBOARD - VM NAME FIELD:" -ForegroundColor Yellow
Write-Host "   - After login, click in 'VM Name' field" -ForegroundColor Gray
Write-Host "   - Type: my-test-vm" -ForegroundColor Gray
Write-Host "   - EXPECTED: Focus should REMAIN while typing" -ForegroundColor Red
Write-Host ""
Write-Host "3. DASHBOARD - DESCRIPTION FIELD:" -ForegroundColor Yellow
Write-Host "   - Click in 'Description' textarea" -ForegroundColor Gray
Write-Host "   - Type: This is a test VM description" -ForegroundColor Gray
Write-Host "   - EXPECTED: Focus should REMAIN while typing" -ForegroundColor Red
Write-Host ""
Write-Host "4. DASHBOARD - NUMERIC FIELDS:" -ForegroundColor Yellow
Write-Host "   - Click in 'CPU Cores' field" -ForegroundColor Gray
Write-Host "   - Type: 4" -ForegroundColor Gray
Write-Host "   - Click in 'Memory' field" -ForegroundColor Gray
Write-Host "   - Type: 8192" -ForegroundColor Gray
Write-Host "   - Click in 'Disk' field" -ForegroundColor Gray
Write-Host "   - Type: 200" -ForegroundColor Gray
Write-Host "   - EXPECTED: Focus should REMAIN in each field while typing" -ForegroundColor Red
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "WHAT'S DIFFERENT?" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Old UI (0.1.3 - 0.1.6):" -ForegroundColor White
Write-Host "• Complex component hierarchy" -ForegroundColor Gray
Write-Host "• React.memo, useCallback everywhere" -ForegroundColor Gray
Write-Host "• Multiple nested components" -ForegroundColor Gray
Write-Host "• Material UI + Framer Motion" -ForegroundColor Gray
Write-Host "• Step-based wizard interface" -ForegroundColor Gray
Write-Host ""
Write-Host "New UI (1.0.0):" -ForegroundColor White
Write-Host "• Simple, flat structure" -ForegroundColor Gray
Write-Host "• Standard React patterns" -ForegroundColor Gray
Write-Host "• Minimal dependencies" -ForegroundColor Gray
Write-Host "• Plain CSS" -ForegroundColor Gray
Write-Host "• Direct form handling" -ForegroundColor Gray
Write-Host ""
Write-Host "This new UI follows React best practices" -ForegroundColor White
Write-Host "without over-engineering that could cause issues." -ForegroundColor White
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Verification Complete" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
