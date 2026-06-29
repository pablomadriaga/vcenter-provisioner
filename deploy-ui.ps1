#requires -Version 5.1

<#
.SYNOPSIS
    Deployment Script for vCenter Provisioner - Ensures proper Docker image rebuilds

.DESCRIPTION
    This script automates the deployment process ensuring Docker images are properly rebuilt
    with new versions. It prevents the common issue where docker-compose up -d
    uses cached images instead of rebuilding with the new version.

    USAGE:
        From project directory: .\deploy-ui.ps1 -Service provisioner-ui -ForceRebuild
        From any directory: C:\path\to\project\deploy-ui.ps1 -Service provisioner-ui -ForceRebuild

.PARAMETER Service
    Specific service to deploy (default: all services)

.PARAMETER NoCache
    Rebuild Docker images without using cache (slower but guaranteed fresh build)

.PARAMETER ForceRebuild
    Force rebuild even if version hasn't changed

.PARAMETER VerifyVersion
    Only verify deployed version without deploying

.PARAMETER StopAfter
    Stop containers after deployment

.PARAMETER Verbose
    Show verbose output

.EXAMPLE
    # From project directory
    .\deploy-ui.ps1 -Service provisioner-ui -ForceRebuild

.EXAMPLE
    # From any directory with full path
    C:\Users\Juan Pablo\Documents\antigravity\projects\vcenter-provisioner\deploy-ui.ps1 -Service provisioner-ui -ForceRebuild
#>

[CmdletBinding()]
param(
    [string]$Service = "",
    [switch]$NoCache = $false,
    [switch]$ForceRebuild = $false,
    [switch]$VerifyVersion = $false,
    [switch]$StopAfter = $false,
    [switch]$Verbose = $false
)

# Configuration
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DockerComposePath = Join-Path $ProjectRoot "infra\local\docker-compose.yml"
$ServicesPath = Join-Path $ProjectRoot "apps"

# Service configurations
$ServiceConfigs = @{
    "provisioner-ui" = @{
        PackageJson = "apps\provisioner-ui\package.json"
        ImagePrefix = "antigravity/provisioner-ui"
        ContainerPrefix = "provisioner-ui"
        Port = 5173
    }
}

# Color functions
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Success { param([string]$Message) Write-ColorOutput "✅ $Message" "Green" }
function Write-Error { param([string]$Message) Write-ColorOutput "❌ $Message" "Red" }
function Write-Warning { param([string]$Message) Write-ColorOutput "⚠️  $Message" "Yellow" }
function Write-Info { param([string]$Message) Write-ColorOutput "ℹ️  $Message" "Cyan" }
function Write-Step { param([string]$Message) Write-ColorOutput "📋 $Message" "Magenta" }

function Get-PackageVersion {
    param([string]$PackageJsonPath)

    if (-not (Test-Path $PackageJsonPath)) {
        return $null
    }

    $content = Get-Content $PackageJsonPath -Raw
    if ($content -match '"version"\s*:\s*"([^"]+)"') {
        return $matches[1]
    }
    return $null
}

function Get-DockerComposeVersion {
    param([string]$ServiceName)

    if (-not (Test-Path $DockerComposePath)) {
        return $null
    }

    $composeContent = Get-Content $DockerComposePath -Raw
    $imagePrefix = $ServiceConfigs[$ServiceName].ImagePrefix
    $pattern = "$imagePrefix`:([^`"]+)"
    if ($composeContent -match $pattern) {
        return $matches[1]
    }
    return $null
}

function Get-DeployedImageVersion {
    param([string]$ContainerName)

    try {
        $output = docker inspect $ContainerName --format '{{.Config.Labels.version}}' 2>&1
        if ($LASTEXITCODE -eq 0 -and $output) {
            return $output
        }
    } catch {
        # Container might not exist
    }
    return $null
}

function Get-DockerComposeContainerName {
    param([string]$ServiceName)

    if (-not (Test-Path $DockerComposePath)) {
        return $null
    }

    $composeContent = Get-Content $DockerComposePath -Raw
    $containerPrefix = $ServiceConfigs[$ServiceName].ContainerPrefix
    $pattern = "$containerPrefix-v([0-9\.]+)"
    if ($composeContent -match $pattern) {
        return "$containerPrefix-v$($matches[1])"
    }
    return $null
}

function Stop-And-Remove-Container {
    param([string]$ContainerName)

    Write-Info "Checking container: $ContainerName"

    $exists = docker ps -a --filter "name=$ContainerName" --format "{{.Names}}" 2>$null | Select-String $ContainerName
    if ($exists) {
        Write-Info "Stopping container: $ContainerName"
        docker stop $ContainerName 2>$null | Out-Null
        Write-Info "Removing container: $ContainerName"
        docker rm $ContainerName 2>$null | Out-Null
        Write-Success "Container stopped and removed: $ContainerName"
    } else {
        Write-Info "Container not found: $ContainerName (skipping)"
    }
}

function Remove-OldImage {
    param([string]$ImageName, [string]$OldVersion)

    if ($OldVersion) {
        $oldImage = "$ImageName`:$OldVersion"
        Write-Info "Checking for old image: $oldImage"

        $exists = docker images --format "{{.Repository}}:{{.Tag}}" 2>$null | Select-String $oldImage
        if ($exists) {
            Write-Warning "Removing old image: $oldImage"
            docker rmi $oldImage 2>$null | Out-Null
            Write-Success "Old image removed: $oldImage"
        }
    }
}

function Build-Service {
    param(
        [string]$ServiceName,
        [string]$NewVersion
    )

    Write-Step "Building service: $ServiceName with version $NewVersion"

    $buildCommand = "docker-compose build"

    if ($NoCache) {
        $buildCommand += " --no-cache"
        Write-Warning "Building without cache (slower but guaranteed fresh build)"
    }

    if ($Service) {
        $buildCommand += " $Service"
    }

    Write-Info "Executing: $buildCommand"
    Push-Location $ProjectRoot
    $result = Invoke-Expression $buildCommand 2>&1
    Pop-Location

    if ($LASTEXITCODE -eq 0) {
        Write-Success "Build successful: $ServiceName"
        return $true
    } else {
        Write-Error "Build failed: $ServiceName"
        Write-Error $result
        return $false
    }
}

function Deploy-Service {
    param(
        [string]$ServiceName
    )

    $config = $ServiceConfigs[$ServiceName]
    if (-not $config) {
        Write-Error "Unknown service: $ServiceName"
        return $false
    }

    Write-Step "=== Processing Service: $ServiceName ==="

    Write-Host ""

    # Get versions
    $packageVersion = Get-PackageVersion (Join-Path $ProjectRoot $config.PackageJson)
    $composeVersion = Get-DockerComposeVersion $ServiceName
    $containerName = Get-DockerComposeContainerName $ServiceName
    $deployedVersion = Get-DeployedImageVersion $containerName

    Write-Info "Package version: $packageVersion"
    Write-Info "Docker Compose version: $composeVersion"
    Write-Info "Deployed version: $deployedVersion"

    # Validate version consistency
    if ($packageVersion -ne $composeVersion) {
        Write-Error "Version mismatch detected!"
        Write-Error "package.json version ($packageVersion) != docker-compose.yml version ($composeVersion)"
        return $false
    }

    # Check if rebuild is needed
    $needsRebuild = $ForceRebuild -or ($deployedVersion -ne $packageVersion)
    if (-not $needsRebuild) {
        Write-Success "Version already deployed: $packageVersion (no changes needed)"
        Write-Host ""
        return $true
    }

    Write-Info "Version update detected: $deployedVersion -> $packageVersion"
    Write-Host ""

    # Stop and remove old container
    if ($containerName) {
        Stop-And-Remove-Container $containerName
    }

    # Remove old image
    Remove-OldImage $config.ImagePrefix $deployedVersion

    # Build new image
    $buildSuccess = Build-Service $ServiceName $packageVersion
    if (-not $buildSuccess) {
        return $false
    }

    # Deploy new container
    Write-Step "Deploying service: $ServiceName"

    $deployCommand = "docker-compose up -d --build"
    if ($Service) {
        $deployCommand = "docker-compose up -d --build $ServiceName"
    }

    Write-Info "Executing: $deployCommand"
    Push-Location $ProjectRoot
    $result = Invoke-Expression $deployCommand 2>&1
    Pop-Location

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Deployment failed: $ServiceName"
        Write-Error $result
        return $false
    }

    # Wait for health check
    if ($config.Port) {
        Write-Info "Waiting for service to be healthy..."
        Start-Sleep -Seconds 5

        $maxAttempts = 30
        $attempt = 0
        $healthy = $false

        while ($attempt -lt $maxAttempts -and -not $healthy) {
            $attempt++
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:$($config.Port)/" -UseBasicParsing -TimeoutSec 2 2>$null
                if ($response.StatusCode -eq 200) {
                    $healthy = $true
                    Write-Success "Service is healthy and responding"
                }
            } catch {
                $msg = "Attempt {0}/{1}: Service not ready yet..." -f $attempt, $maxAttempts
                if ($Verbose) {
                    Write-Host $msg -ForegroundColor Yellow
                }
            }
            Start-Sleep -Seconds 2
        }

        if (-not $healthy) {
            Write-Warning "Health check failed after $maxAttempts attempts (but deployment may have succeeded)"
        }
    }

    # Stop if requested
    if ($StopAfter) {
        $newContainerName = Get-DockerComposeContainerName $ServiceName
        if ($newContainerName) {
            Stop-And-Remove-Container $newContainerName
        }
    }

    Write-Success "Deployment successful: $ServiceName version $packageVersion"
    Write-Host ""
    return $true
}

function Verify-DeployedVersion {
    param([string]$ServiceName = "")

    Write-Step "=== Verifying Deployed Versions ==="
    Write-Host ""

    if ($Service) {
        # Verify specific service
        $config = $ServiceConfigs[$ServiceName]
        if (-not $config) {
            Write-Error "Unknown service: $ServiceName"
            return
        }

        $containerName = Get-DockerComposeContainerName $ServiceName
        $deployedVersion = Get-DeployedImageVersion $containerName
        $packageVersion = Get-PackageVersion (Join-Path $ProjectRoot $config.PackageJson)

        Write-ColorOutput "📦 Service: $ServiceName" "Cyan"
        Write-ColorOutput "🏷️  Container: $containerName" "Yellow"
        Write-ColorOutput "📦 Package Version: $packageVersion" "Green"
        Write-ColorOutput "🐳 Deployed Version: $deployedVersion" "Magenta"

        if ($deployedVersion -eq $packageVersion) {
            Write-Success "Version verified: MATCHES"
        } else {
            Write-Warning "Version mismatch: DEPLOYED($deployedVersion) != PACKAGE($packageVersion)"
        }
    } else {
        # Verify all configured services
        foreach ($serviceName in $ServiceConfigs.Keys) {
            $config = $ServiceConfigs[$serviceName]
            $containerName = Get-DockerComposeContainerName $serviceName
            $deployedVersion = Get-DeployedImageVersion $containerName
            $packageVersion = Get-PackageVersion (Join-Path $ProjectRoot $config.PackageJson)

            Write-Host ""
            Write-ColorOutput "📦 Service: $serviceName" "Cyan"
            Write-ColorOutput "🏷️  Container: $containerName" "Yellow"
            Write-ColorOutput "📦 Package Version: $packageVersion" "Green"
            Write-ColorOutput "🐳 Deployed Version: $deployedVersion" "Magenta"

            if ($deployedVersion -eq $packageVersion) {
                Write-Success "Version verified: MATCHES"
            } else {
                Write-Warning "Version mismatch: DEPLOYED($deployedVersion) != PACKAGE($packageVersion)"
            }
        }
    }
    Write-Host ""
}

        $containerName = Get-DockerComposeContainerName $ServiceName
        $deployedVersion = Get-DeployedImageVersion $containerName
        $packageVersion = Get-PackageVersion (Join-Path $ProjectRoot $config.PackageJson)

        Write-ColorOutput "📦 Service: $ServiceName" "Cyan"
        Write-ColorOutput "🏷️  Container: $containerName" "Yellow"
        Write-ColorOutput "📦 Package Version: $packageVersion" "Green"
        Write-ColorOutput "🐳 Deployed Version: $deployedVersion" "Magenta"

        if ($deployedVersion -eq $packageVersion) {
            Write-Success "Version verified: MATCHES"
        } else {
            Write-Warning "Version mismatch: DEPLOYED($deployedVersion) != PACKAGE($packageVersion)"
        }
    } else {
        # Verify all configured services
        foreach ($serviceName in $ServiceConfigs.Keys) {
            $config = $ServiceConfigs[$serviceName]
            $containerName = Get-DockerComposeContainerName $serviceName
            $deployedVersion = Get-DeployedImageVersion $containerName
            $packageVersion = Get-PackageVersion (Join-Path $ProjectRoot $config.PackageJson)

            Write-ColorOutput "`n📦 Service: $serviceName" "Cyan"
            Write-ColorOutput "🏷️  Container: $containerName" "Yellow"
            Write-ColorOutput "📦 Package Version: $packageVersion" "Green"
            Write-ColorOutput "🐳 Deployed Version: $deployedVersion" "Magenta"

            if ($deployedVersion -eq $packageVersion) {
                Write-Success "Version verified: MATCHES"
            } else {
                Write-Warning "Version mismatch: DEPLOYED($deployedVersion) != PACKAGE($packageVersion)"
            }
        }
    }
}

# Main execution
try {
    Write-Step "=== vCenter Provisioner Deployment Script ==="
    Write-Host ""
    Write-Info "Project Root: $ProjectRoot"
    Write-Info "Docker Compose: $DockerComposePath"
    Write-Host ""

    if ($VerifyVersion) {
        Verify-DeployedVersion -Service $Service
        exit 0
    }

    # Determine which services to deploy
    $servicesToDeploy = if ($Service) { @($Service) } else { $ServiceConfigs.Keys }

    Write-Info "Services to deploy: $($servicesToDeploy -join ', ')"
    Write-Host ""

    # Deploy each service
    $allSuccess = $true
    foreach ($serviceName in $servicesToDeploy) {
        $success = Deploy-Service $serviceName
        if (-not $success) {
            $allSuccess = $false
        }
        Write-Host ""
    }

    if ($allSuccess) {
        Write-Step "=== All deployments successful ==="
        Write-Success "Deployment completed successfully!"
        Write-Host ""

        # Show summary
        Write-Info "Deployed Services:"
        foreach ($serviceName in $servicesToDeploy) {
            $config = $ServiceConfigs[$serviceName]
            $containerName = Get-DockerComposeContainerName $serviceName
            $packageVersion = Get-PackageVersion (Join-Path $ProjectRoot $config.PackageJson)

            Write-ColorOutput "  - $serviceName`: $packageVersion" "Green"
            Write-ColorOutput "    Container: $containerName" "White"
            Write-ColorOutput "    Port: $($config.Port)" "White"
        }

        Write-Host ""
        Write-Host "🌐 Access URLs:"
        Write-ColorOutput "  - UI: http://localhost:5173" "Cyan"
        Write-ColorOutput "  - API Gateway: http://localhost:3000" "Cyan"
        Write-ColorOutput "  - Auth Service: http://localhost:3001" "Cyan"
        Write-Host ""

        exit 0
    } else {
        Write-Error "=== Deployment failed ==="
        exit 1
    }

} catch {
    Write-Error "Error during deployment: $_"
    Write-Error $_.ScriptStackTrace
    exit 1
}
