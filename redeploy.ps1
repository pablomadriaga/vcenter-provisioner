# Simple Deployment Script - vCenter Provisioner
# Works from ANY directory - just specify project path

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectPath,
    [string]$Service = "",
    [switch]$NoCache = $false
)

Write-Host "🚀 vCenter Provisioner - Simple Deployment (Works from ANY directory)" -ForegroundColor Cyan
Write-Host ""

# Validate project path
if (-not (Test-Path $ProjectPath)) {
    Write-Host "❌ Error: Project path does not exist: $ProjectPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\redeploy.ps1 -ProjectPath `"C:\path\to\project"`" -ForegroundColor White
    Write-Host "  .\redeploy.ps1 -ProjectPath `"C:\path\to\project"` -Service provisioner-ui" -ForegroundColor White
    Write-Host "  .\redeploy.ps1 -ProjectPath `"C:\path\to\project"` -NoCache" -ForegroundColor White
    exit 1
}

Write-Host "📁 Project Path: $ProjectPath" -ForegroundColor Green
Write-Host ""

# Navigate to docker-compose directory
$DockerComposeDir = Join-Path $ProjectPath "infra\local"
if (-not (Test-Path $DockerComposeDir)) {
    Write-Host "❌ Error: Docker Compose directory not found: $DockerComposeDir" -ForegroundColor Red
    exit 1
}

Write-Host "📂 Docker Compose Directory: $DockerComposeDir" -ForegroundColor Green

# Navigate to docker-compose directory
Push-Location $DockerComposeDir

Write-Host ""
Write-Host "🛑 Step 1: Stop all containers" -ForegroundColor Cyan
docker-compose down
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ All containers stopped" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some containers may not have been running" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🔨 Step 2: Rebuild images" -ForegroundColor Cyan

$buildCommand = "docker-compose build"
if ($NoCache) {
    $buildCommand += " --no-cache"
    Write-Host "Building WITHOUT cache (slower but guaranteed fresh)" -ForegroundColor Yellow
}

Write-Host "Executing: $buildCommand" -ForegroundColor White
$result = Invoke-Expression $buildCommand 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build successful" -ForegroundColor Green
} else {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host ""
Write-Host "🚀 Step 3: Start containers" -ForegroundColor Cyan

$upCommand = "docker-compose up -d"
if ($Service) {
    $upCommand += " $Service"
}

Write-Host "Executing: $upCommand" -ForegroundColor White
Invoke-Expression $upCommand 2>&1 | Out-Null

Write-Host ""
Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Cyan

# Wait for UI to be ready
$maxAttempts = 30
$attempt = 0
$healthy = $false

while ($attempt -lt $maxAttempts -and -not $healthy) {
    $attempt++
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5173/" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop 2>$null
        if ($response.StatusCode -eq 200) {
            $healthy = $true
            Write-Host "✅ Provisioner UI is ready!" -ForegroundColor Green
        }
    } catch {
        Write-Host "Attempt ${attempt}/${maxAttempts}: Waiting..." -ForegroundColor Gray
    }
    Start-Sleep -Seconds 2
}

# Return to original directory
Pop-Location

if (-not $healthy) {
    Write-Host ""
    Write-Host "⚠️  Health check timed out, but deployment may have succeeded" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Deployment completed!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Access URLs:" -ForegroundColor Cyan
Write-Host "   - UI: http://localhost:5173" -ForegroundColor White
Write-Host "   - API Gateway: http://localhost:3000" -ForegroundColor White
Write-Host "   - Auth Service: http://localhost:3001" -ForegroundColor White
Write-Host ""
Write-Host "📝 Login Credentials:" -ForegroundColor Cyan
Write-Host "   - Username: admin@antigravity.local" -ForegroundColor White
Write-Host "   - Password: admin123" -ForegroundColor White
Write-Host ""

# Display current versions
Write-Host "📦 Current Versions:" -ForegroundColor Cyan
try {
    $uiVersion = docker inspect provisioner-ui-v0.1.2 --format '{{.Config.Labels.version}}' 2>$null
    if ($uiVersion) {
        Write-Host "   - Provisioner UI: $uiVersion" -ForegroundColor Green
    } else {
        Write-Host "   - Provisioner UI: Unknown (container may not be running)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   - Provisioner UI: Unknown" -ForegroundColor Yellow
}

exit 0
