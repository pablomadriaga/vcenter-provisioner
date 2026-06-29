# Ultra Simple Deployment Script - ONLY rebuilds provisioner-ui
# Works from ANY directory - just specify project path

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectPath
)

Write-Host "🚀 vCenter Provisioner - Ultra Simple Deployment (ONLY provisioner-ui)" -ForegroundColor Cyan
Write-Host ""

# Validate project path
if (-not (Test-Path $ProjectPath)) {
    Write-Host "❌ Error: Project path does not exist: $ProjectPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\redeploy-ui-only.ps1 -ProjectPath `"C:\path\to\project"`" -ForegroundColor White
    exit 1
}

Write-Host "📁 Project Path: $ProjectPath" -ForegroundColor Green
Write-Host ""

# Navigate to docker-compose directory
$DockerComposeDir = Join-Path $ProjectPath "infra\local"
Push-Location $DockerComposeDir

Write-Host ""
Write-Host "🛑 Step 1: Stop provisioner-ui container" -ForegroundColor Cyan
$containerName = "provisioner-ui-v0.1.2"

Write-Host "Stopping: $containerName"
docker stop $containerName 2>$null | Out-Null
Write-Host "Removing: $containerName"
docker rm $containerName 2>$null | Out-Null
Write-Host "✅ Container stopped and removed" -ForegroundColor Green

Write-Host ""
Write-Host "🔨 Step 2: Remove old image" -ForegroundColor Cyan

$imageName = "antigravity/provisioner-ui:0.1.1"

Write-Host "Removing: $imageName"
docker rmi $imageName 2>$null | Out-Null
Write-Host "✅ Old image removed" -ForegroundColor Green

Write-Host ""
Write-Host "🏗 Step 3: Rebuild provisioner-ui" -ForegroundColor Cyan

Write-Host "Building: antigravity/provisioner-ui:0.1.2"
Write-Host "This may take 20-30 seconds..." -ForegroundColor Yellow

docker-compose build --no-cache provisioner-ui

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build successful" -ForegroundColor Green
} else {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host ""
Write-Host "🚀 Step 4: Start container" -ForegroundColor Cyan

Write-Host "Starting: $containerName"
docker-compose up -d provisioner-ui

Write-Host ""
Write-Host "⏳ Waiting for service to be ready..." -ForegroundColor Cyan

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
Write-Host ""
Write-Host "📝 Login Credentials:" -ForegroundColor Cyan
Write-Host "   - Username: admin@antigravity.local" -ForegroundColor White
Write-Host "   - Password: admin123" -ForegroundColor White
Write-Host ""

# Display current version
Write-Host "📦 Current Version:" -ForegroundColor Cyan
Write-Host "   - Provisioner UI: 0.1.2 (TextField Focus FIX)" -ForegroundColor Green

exit 0
