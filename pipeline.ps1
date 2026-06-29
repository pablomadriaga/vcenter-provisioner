#!/usr/bin/env pwsh
# =============================================================================
# pipeline.ps1 - Entry Point Unificado
# =============================================================================
# UNICO entry point para CI/CD del proyecto.
# Reemplaza: ci.ps1, run-ci.ps1
# =============================================================================
# USO:
#   .\pipeline.ps1              # Lint + Test + Build (Docker) - MODO RECOMENDADO
#   .\pipeline.ps1 --lint       # Solo lint
#   .\pipeline.ps1 --test       # Solo test
#   .\pipeline.ps1 --build      # Solo build (smart cache)
#   .\pipeline.ps1 --build --force    # Forzar rebuild total
#   .\pipeline.ps1 --build --no-cache # Sin cache Docker
#   .\pipeline.ps1 --all        # Todo (incluye cleanup)
#   .\pipeline.ps1 --docker     # Test en Docker (determinismo)
#   .\pipeline.ps1 --validate   # Validacion temprana
#   .\pipeline.ps1 --up         # Levantar servicios
#   .\pipeline.ps1 --down       # Bajar servicios
#   .\pipeline.ps1 --status     # Ver estado de servicios
# =============================================================================

[CmdletBinding()]
param(
    [switch]$Lint,
    [switch]$Test,
    [switch]$Build,
    [switch]$All,
    [switch]$Docker,
    [switch]$Validate,
    [switch]$Cleanup,
    [switch]$Help,
    [switch]$Force,
    [switch]$NoCache,
    [switch]$Up,
    [switch]$Down,
    [switch]$Status
)

# Error handling estricto
$ErrorActionPreference = "Stop"
$ProgressPreference = "Continue"

# Cargar configuracion centralizada
$script:SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:BASE_DIR = $SCRIPT_DIR
$script:CONFIG_DIR = Join-Path $BASE_DIR "config"
$script:COMPOSE_FILE = Join-Path $BASE_DIR "infra/local/docker-compose.yml"
$script:ENV_FILE = Join-Path $BASE_DIR ".env.ci"

# Importar configuracion
. "$CONFIG_DIR/ports.ps1" -ErrorAction SilentlyContinue
. "$CONFIG_DIR/services.ps1" -ErrorAction SilentlyContinue

# Importar clases modernas (PS 7.5+)
$classesPath = Join-Path $SCRIPT_DIR "scripts/ci/PipelineClasses.ps1"
if (Test-Path $classesPath) {
    . $classesPath
}

# =============================================================================
# UTILIDADES - Wrappers para mantener compatibilidad
# =============================================================================
# Las funciones originales ahora usan la clase PipelineLogger

function Write-Banner([string]$Message) { [PipelineLogger]::Banner($Message) }
function Write-Section([string]$Message) { [PipelineLogger]::Section($Message) }
function Write-Step([int]$Step, [int]$Total, [string]$Message) { [PipelineLogger]::Step($Step, $Total, $Message) }
function Write-Info([string]$Message) { [PipelineLogger]::Info($Message) }
function Write-Success([string]$Message) { [PipelineLogger]::Success($Message) }
function Write-Error([string]$Message) { [PipelineLogger]::Error($Message) }
function Write-Warning([string]$Message) { [PipelineLogger]::Warning($Message) }

function Show-Help {
    Write-Host ""
    Write-Host "USO:"
    Write-Host "    .\pipeline.ps1 [OPCIONES]"
    Write-Host ""
    Write-Host "OPCIONES DE PIPELINE:"
    Write-Host "    --lint       Solo ejecutar lint (Host)"
    Write-Host "    --test       Solo ejecutar tests"
    Write-Host "    --build      Solo construir imagenes (smart cache)"
    Write-Host "    --all        Ejecutar todo (lint + test + build)"
    Write-Host "    --docker     Tests en Docker (determinismo)"
    Write-Host "    --validate   Validacion temprana (Docker, ports, Dockerfiles)"
    Write-Host "    --force      Forzar rebuild (skip cache)"
    Write-Host "    --no-cache   docker build sin cache"
    Write-Host ""
    Write-Host "OPCIONES DE SERVICIOS:"
    Write-Host "    --up         Levantar servicios (genera .env.ci si falta)"
    Write-Host "    --down       Bajar servicios"
    Write-Host "    --status     Ver estado de contenedores"
    Write-Host "    --cleanup    [DEPRECADO] Usa --down --cleanup"
    Write-Host ""
    Write-Host "OTROS:"
    Write-Host "    --help       Mostrar esta ayuda"
    Write-Host ""
    Write-Host ""
    Write-Host "NOTA:"
    Write-Host "    La ejecución por defecto (sin flags) ejecuta todo en Docker."
    Write-Host "    Esto garantiza detección completa de errores, incluyendo problemas"
    Write-Host "    específicos del entorno containerizado."
    Write-Host ""
    Write-Host "EJEMPLOS:"
    Write-Host "    .\pipeline.ps1                  # Lint + Test + Build (Docker) - MODO RECOMENDADO"
    Write-Host "    .\pipeline.ps1 --all --docker  # Tests en Docker (maximo determinismo)"
    Write-Host "    .\pipeline.ps1 --build --force  # Forzar rebuild"
    Write-Host "    .\pipeline.ps1 --up             # Levantar servicios"
    Write-Host "    .\pipeline.ps1 --down           # Bajar servicios"
    Write-Host "    .\pipeline.ps1 --status         # Ver estado"
    Write-Host "    .\pipeline.ps1 --validate       # Verificar prerrequisitos"
    Write-Host ""
}

# =============================================================================
# VALIDACIONES
# =============================================================================

function Test-Docker {
    Write-Section "Validando Docker..."
    try {
        $output = docker version 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Docker no esta instalado o no funciona"
            Write-Info "Descarga Docker Desktop: https://www.docker.com/products/docker-desktop"
            return $false
        }
        Write-Success "Docker esta disponible"
        return $true
    }
    catch {
        Write-Error "Docker no esta ejecutandose: $($_.Exception.Message)"
        Write-Info "Inicia Docker Desktop y espera a que el icono este verde"
        return $false
    }
}

function Test-Ports {
    Write-Section "Verificando ports..."
    $conflicts = @()
    foreach ($service in $global:SERVICES.Keys) {
        if (-not $global:PORTS.ContainsKey($service)) {
            continue
        }
        $port = $global:PORTS[$service]["external"]
        # Verificar si hay algo escuchando
        try {
            $listener = New-Object System.Net.Sockets.TcpListener
            $listener.Start()
            $listener.Stop()
        }
        catch {
            Write-Warning "Puerto $port ($service) puede estar en uso"
            $conflicts += $service
        }
    }
    if ($conflicts.Count -gt 0) {
        Write-Warning "Ports en uso: $($conflicts -join ', ')"
        Write-Info "Usa 'netstat -ano | findstr :<puerto>' para ver que proceso"
    }
    else {
        Write-Success "Todos los ports disponibles"
    }
    return $true
}

function Test-Prerequisites {
    $results = @{
        Docker = (Test-Docker)
        Ports = (Test-Ports)
        Dockerfiles = (Test-Dockerfiles)
    }
    return ($results.Docker -and $results.Ports -and $results.Dockerfiles)
}

function Test-Dockerfiles {
    Write-Section "Validando Dockerfiles..."

    $composeContent = Get-Content $script:COMPOSE_FILE -Raw

    $servicesUsingCurl = @{}
    $lines = $composeContent -split "`n"
    $currentService = $null

    foreach ($line in $lines) {
        if ($line -match '^\s{2}(\w[\w-]+):\s*$') {
            $currentService = $matches[1]
        }
        elseif ($currentService -and $line -match 'healthcheck:') {
            $servicesUsingCurl[$currentService] = $true
        }
        elseif ($currentService -and $line -match 'test:\s*\[.*curl') {
            $servicesUsingCurl[$currentService] = $true
        }
        elseif ($currentService -and $line -match '^\s{3}\w') {
            $currentService = $null
        }
    }

    $dockerfileErrors = @()
    foreach ($svcName in $servicesUsingCurl.Keys) {
        if (-not $global:SERVICES.ContainsKey($svcName)) {
            continue
        }
        $service = $global:SERVICES[$svcName]

        $dockerfilePath = Join-Path $BASE_DIR $service.Path "Dockerfile"
        if (-not (Test-Path $dockerfilePath)) {
            continue
        }

        $dockerfileContent = Get-Content $dockerfilePath -Raw

        if ($dockerfileContent -match 'FROM\s+\S+nginx-unprivileged' -or
            $dockerfileContent -match 'FROM\s+\S+curl\s+') {
            continue
        }

        if ($dockerfileContent -match 'FROM\s+\S+alpine' -and $dockerfileContent -notmatch 'apk add.*curl') {
            Write-Error "${svcName}: Imagen Alpine necesita 'curl' para healthcheck"
            $dockerfileErrors += $svcName
        }
        if ($dockerfileContent -match 'FROM\s+\S+slim' -and $dockerfileContent -notmatch 'apt-get.*curl') {
            Write-Error "${svcName}: Imagen slim necesita 'curl' para healthcheck"
            $dockerfileErrors += $svcName
        }
    }

    if ($dockerfileErrors.Count -gt 0) {
        Write-Error "Dockerfiles con problemas: $($dockerfileErrors -join ', ')"
        return $false
    }

    Write-Success "Dockerfiles validados"
    return $true
}

# =============================================================================
# LINT
# =============================================================================

function Invoke-LintAll {
    <#
    .SYNOPSIS
        Ejecuta lint en todos los servicios usando utilidades modernas.
    #>
    [PipelineLogger]::Section("Ejecutando Lint en todos los servicios...")

    $lintErrors = [System.Collections.ArrayList]::new()

    foreach ($serviceName in $global:SERVICES.Keys) {
        $service = $global:SERVICES[$serviceName]

        # Saltar servicios utility (shared-scripts)
        if ($service.IsUtility) { continue }

        $servicePath = Join-Path $BASE_DIR $service.Path

        if (-not (Test-Path $servicePath)) {
            [PipelineLogger]::Warning("No encontrado: $servicePath")
            continue
        }

        [PipelineLogger]::Info("Lint en $serviceName...")

        # Usar Invoke-InDirectory para abstraer Push/Pop-Location
        $result = Invoke-InDirectory -Path $servicePath -ErrorPrefix $serviceName -ScriptBlock {
            Invoke-LoggedCommand -Name $serviceName -Command $service.LintCmd
        }

        if (-not $result.Success) {
            [void]$lintErrors.Add($serviceName)
        }
    }

    if ($lintErrors.Count -gt 0) {
        [PipelineLogger]::Error("Lint fallo en: $($lintErrors -join ', ')")
        return $false
    }

    [PipelineLogger]::Success("Todos los lints pasaron")
    return $true
}

# =============================================================================
# TESTS
# =============================================================================

function Invoke-TestAll([bool]$InDocker = $false) {
    $envName = $InDocker ? 'Docker' : 'Host'
    [PipelineLogger]::Section("Ejecutando Tests en $envName...")

    $envFile = Join-Path $BASE_DIR ".env.ci"
    if (-not (Test-Path $envFile)) {
        [PipelineLogger]::Error(".env.ci no existe. Ejecuta .\pipeline.ps1 --build primero")
        return $false
    }

    $testErrors = [System.Collections.ArrayList]::new()

    # Función helper para ejecutar test
    function Run-Test($Name, $Service, $Path, $ImageTag, $InDockerMode) {
        [PipelineLogger]::Info("Test en $Name...")
        $testCmd = $Service.TestCmd
        
        if ($InDockerMode) {
            $mountPath = $Path.Replace('\', '/')
            $dockerCmd = switch ($Service.Type) {
                "node" { "docker run --rm -v ${mountPath}:/app -w /app $ImageTag npm test" }
                "python" { "docker run --rm -v ${mountPath}:/app -w /app $ImageTag python -m pytest" }
                "go" { "docker run --rm -e GO111MODULE=off -v ${mountPath}:/app -w /app $ImageTag go test ./..." }
                default { "docker run --rm -v ${mountPath}:/app -w /app $ImageTag $testCmd" }
            }
            
            $result = Invoke-InDirectory -Path $Path -ScriptBlock {
                Invoke-Expression $dockerCmd 2>&1 | Out-Null
                $LASTEXITCODE
            }
            
            if ($result -eq 0) {
                [PipelineLogger]::Success("$Name`: OK (Docker)")
                return $true
            }
            
            # Fallback a host
            [PipelineLogger]::Warning("$Name`: Falló en Docker, intentando en host...")
        }
        
        # Test en host (o fallback)
        $result = Invoke-InDirectory -Path $Path -ScriptBlock {
            Invoke-Expression $testCmd 2>&1 | Out-Null
            $LASTEXITCODE
        }
        
        if ($result -eq 0) {
            $msg = $InDockerMode ? 'OK (Host fallback)' : 'OK'
            [PipelineLogger]::Success("$Name`: $msg")
            return $true
        }
        else {
            [PipelineLogger]::Error("$Name`: FALLO")
            [void]$testErrors.Add($Name)
            return $false
        }
    }

    # Procesar servicios usando pipeline
    $global:SERVICES.GetEnumerator() |
        Where-Object { -not $_.Value.IsUtility -and $_.Value.Type -ne "react" -and (Test-Path (Join-Path $BASE_DIR $_.Value.Path)) } |
        ForEach-Object {
            $hashVar = "$($_.Key.ToUpper() -replace '-', '_')_HASH"
            $hash = Get-HashFromEnvFile -EnvFile $envFile -HashVar $hashVar
            if ($hash) {
                $svcPath = Join-Path $BASE_DIR $_.Value.Path
                $imageTag = "$($_.Value.ImageName):$hash"
                Run-Test -Name $_.Key -Service $_.Value -Path $svcPath -ImageTag $imageTag -InDockerMode $InDocker
            }
            else {
                [PipelineLogger]::Warning("$($_.Key): Hash no encontrado")
            }
        }

    if ($testErrors.Count -eq 0) {
        [PipelineLogger]::Success("Todos los tests pasaron")
        return $true
    }
    else {
        [PipelineLogger]::Error("Tests fallaron en: $($testErrors -join ', ')")
        return $false
    }
}

# =============================================================================
# BUILD
# =============================================================================

function New-EnvCi {
    param(
        [hashtable]$Services,
        [switch]$Force
    )

    Write-Section "Generando .env.ci..."

    # Cargar hash.ps1
    $hashScript = Join-Path $SCRIPT_DIR "scripts/ci/hash.ps1"
    if (-not (Test-Path $hashScript)) {
        Write-Error "No encontrado: $hashScript"
        return $false
    }

    . $hashScript

    $envFile = Join-Path $BASE_DIR ".env.ci"
    $lines = @("# NO EDITAR. Generado por pipeline.ps1")
    $lines += "# Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $lines += "# Force: $($Force.IsPresent)"
    $lines += ""

    # Calcular hash de shared-scripts y servicios
    $sharedHash = Get-DirectoryHash -Path "scripts"
    $lines += "SHARED_SCRIPTS_HASH=$sharedHash"
    [PipelineLogger]::Info("SHARED_SCRIPTS_HASH=$sharedHash")

    $Services.GetEnumerator() | Where-Object { -not $_.Value.IsUtility } | ForEach-Object {
        $svcPath = Join-Path $BASE_DIR $_.Value.Path
        $hash = Get-ServiceHash -ServicePath $svcPath -SharedScriptsHash $sharedHash
        $envVar = "$($_.Key.ToUpper() -replace '-', '_')_HASH=$hash"
        $lines += $envVar
        [PipelineLogger]::Info($envVar)
    }

    $lines | Out-File -FilePath $envFile -Encoding UTF8
    [PipelineLogger]::Success(".env.ci generado: $envFile")
    return $true
}

function Invoke-BuildAll {
    param(
        [hashtable]$Services,
        [switch]$Force,
        [switch]$NoCache
    )

    [PipelineLogger]::Section("Construyendo imagenes Docker...")
    $modeText = $Force ? 'FORCE (skip cache)' : ($NoCache ? 'NO CACHE' : 'SMART CACHE')
    [PipelineLogger]::Info("Modo: $modeText")

    # Generar .env.ci si no existe o si es force
    $envFile = Join-Path $BASE_DIR ".env.ci"
    $shouldGenerate = (-not (Test-Path $envFile)) -or $Force
    [PipelineLogger]::Info($shouldGenerate ? "Generando .env.ci (Force: $($Force.IsPresent))" : ".env.ci ya existe (usando hashes existentes)")
    
    if ($shouldGenerate) {
        (New-EnvCi -Services $Services -Force:$Force) ? $null : (return $false)
    }

    # Cargar hash.ps1 para usar Get-ServiceHash
    $hashScript = Join-Path $SCRIPT_DIR "scripts/ci/hash.ps1"
    . $hashScript

    $buildErrors = @()
    $builtImages = @()
    $skippedImages = @()

    # =================================================================
    # Build Helper Function
    # =================================================================
    function Build-Image($Name, $Path, $Tag, $LocalTag, $BuildArgs = @{}) {
        # Check cache usando ternary operator
        $isCached = (Test-DockerImageExists -Tag $Tag) -and -not $Force -and -not $NoCache
        if ($isCached) {
            [PipelineLogger]::Success("$Name`: CACHÉ HIT (skip build)")
            return 'Skipped'
        }
        
        [PipelineLogger]::Info("Build: $Tag")
        if ($Force) { [PipelineLogger]::Warning("  [FORCE] Rebuilding...") }
        if ($NoCache) { [PipelineLogger]::Warning("  [--no-cache] No cache...") }
        
        $result = Invoke-InDirectory -Path $Path -ErrorPrefix $Name -ScriptBlock {
            Invoke-DockerBuild -Tag $Tag -BuildArgs $BuildArgs -NoCache:$NoCache
        }
        
        # Resultado usando if tradicional (ternary no soporta múltiples statements)
        if ($result.Success) {
            [PipelineLogger]::Success("$Name`: OK")
            Invoke-DockerTag -Source $Tag -Target $LocalTag | Out-Null
            return 'Built'
        }
        else {
            [PipelineLogger]::Error("$Name`: FALLO")
            return 'Failed'
        }
    }

    # =================================================================
    # Paso 1: Build shared-scripts PRIMERO (secuencial - es dependencia)
    # =================================================================
    if ($Services["shared-scripts"] -and ($ss = $Services["shared-scripts"]) -and ($ssHash = Get-HashFromEnvFile -EnvFile $envFile -HashVar "SHARED_SCRIPTS_HASH")) {
        $ssPath = Join-Path $BASE_DIR $ss.Path
        if (Test-Path $ssPath) {
            $ssTag = "$($ss.ImageName):$ssHash"
            $ssLocal = "$($ss.ImageName):local"
            $ssShort = ($ssTag -split '/')[-1]
            
            switch (Build-Image -Name 'shared-scripts' -Path $ssPath -Tag $ssTag -LocalTag $ssLocal -BuildArgs @{ 'VERSION' = $ssHash.Substring(0, 7) }) {
                'Built' { 
                    $builtImages += 'shared-scripts'
                    Invoke-DockerTag -Source $ssTag -Target $ssShort | Out-Null
                }
                'Skipped' { $skippedImages += 'shared-scripts' }
                'Failed' { $buildErrors += 'shared-scripts' }
            }
        }
    }

    # =================================================================
    # Paso 2: Build servicios (pipeline optimizado)
    # 
    # NOTA ARQUITECTÓNICA: Los builds se ejecutan secuencialmente por diseño.
    # 
    # TODO: Implementar ForEach-Object -Parallel cuando servicios > 15
    #       - ThrottleLimit recomendado: 2 (balance velocidad/estabilidad)
    #       - Shared-scripts debe construirse primero siempre (dependencia)
    #       - Código paralelo requiere refactorización de funciones a inline
    #       - BuildKit ya optimiza internamente; paralelismo externo = complejidad
    #       - Considerar solo si full rebuilds > 5 minutos regularmente
    # =================================================================
    $sharedScriptsHash = Get-HashFromEnvFile -EnvFile $envFile -HashVar "SHARED_SCRIPTS_HASH"
    
    # Procesar servicios usando pipeline moderno
    $Services.GetEnumerator() | 
        Where-Object { -not $_.Value.IsUtility } |
        ForEach-Object {
            $svc = $_.Value
            $svcPath = Join-Path $BASE_DIR $svc.Path
            
            # Skip si no existe path
            if (-not (Test-Path $svcPath)) {
                [PipelineLogger]::Warning("No encontrado: $svcPath")
                return
            }
            
            $hashVar = "$($_.Key.ToUpper() -replace '-', '_')_HASH"
            $hash = (Get-HashFromEnvFile -EnvFile $envFile -HashVar $hashVar) ?? (Get-ServiceHash -ServicePath $svcPath -SharedScriptsHash $sharedScriptsHash)
            
            switch (Build-Image -Name $_.Key -Path $svcPath -Tag "$($svc.ImageName):$hash" -LocalTag "$($svc.ImageName):local" -BuildArgs @{ 'SHARED_SCRIPTS_TAG' = $sharedScriptsHash }) {
                'Built' { $builtImages += $_.Key }
                'Skipped' { $skippedImages += $_.Key }
                'Failed' { $buildErrors += $_.Key }
            }
        }

    # =================================================================
    # Resumen
    # =================================================================
    Write-Host ""
    [PipelineLogger]::Section("Build Completado")
    [PipelineLogger]::Success("Construidos: $($builtImages.Count)")
    [PipelineLogger]::Info("Skipped (cache): $($skippedImages.Count)")
    
    if ($skippedImages.Count -gt 0) { Write-Host "  Skipped: $($skippedImages -join ', ')" -ForegroundColor Gray }
    if ($buildErrors.Count -gt 0) { [PipelineLogger]::Error("Fallaron: $($buildErrors -join ', ')"); return $false }
    
    return $true
}

# =============================================================================
# CLEANUP
# =============================================================================

function Invoke-Cleanup {
    Write-Section "Limpiando contenedores..."

    try {
        Write-Info "Ejecutando: docker compose down"
        $output = docker compose -f $script:COMPOSE_FILE down 2>&1 | Out-String
        
        $containersStopped = ($output -split "`n" | Where-Object { $_ -match "Container" } | Measure-Object).Count
        Write-Success "Contenedores parados: $containersStopped"
        
        Write-Info "Ejecutando: docker rmi antigravity/*"
        $imagesOutput = docker rmi antigravity/* 2>&1 | Out-String
        $imagesDeleted = ($imagesOutput -split "`n" | Where-Object { $_ -match "Deleted" } | Measure-Object).Count
        Write-Success "Imágenes eliminadas: $imagesDeleted"
        
        Write-Success "Cleanup completado"
        return $true
    }
    catch {
        Write-Error "Cleanup fallo: $($_.Exception.Message)"
        return $false
    }
}

# =============================================================================
# SERVICES (UP/DOWN/STATUS)
# =============================================================================

function Invoke-Down([switch]$RemoveImages) {
    [PipelineLogger]::Section("Deteniendo servicios...")

    try {
        $composeManager = [DockerComposeManager]::new($script:COMPOSE_FILE, $script:ENV_FILE)
        if ($composeManager.Down()) {
            [PipelineLogger]::Success("Servicios detenidos")
        }

        if ($RemoveImages) {
            [PipelineLogger]::Info("Eliminando imágenes...")
            docker rmi antigravity/* 2>&1 | Out-Null
            [PipelineLogger]::Success("Imágenes eliminadas")
        }

        return $true
    }
    catch {
        [PipelineLogger]::Error("Error bajando servicios: $($_.Exception.Message)")
        return $false
    }
}

function Invoke-Status {
    [PipelineLogger]::Section("Estado de Servicios")
    docker compose -f $script:COMPOSE_FILE ps
}

function Invoke-Up([switch]$WaitForHealthy = $true) {
    [PipelineLogger]::Section("Levantando servicios...")

    # Verificar Docker
    try {
        docker version 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Docker no disponible" }
        [PipelineLogger]::Success("Docker disponible")
    }
    catch {
        [PipelineLogger]::Error("Docker no está ejecutándose")
        return $false
    }

    # Generar .env.ci si falta
    $envFile = Join-Path $script:BASE_DIR ".env.ci"
    if (-not (Test-Path $envFile)) {
        [PipelineLogger]::Warning(".env.ci no encontrado. Ejecutando build...")
        if (-not (Invoke-BuildAll -Services $global:SERVICES -Force)) {
            [PipelineLogger]::Error("Build falló")
            return $false
        }
    }

    # Verificar imágenes usando pipeline
    [PipelineLogger]::Info("Verificando imágenes...")
    $missingImages = @($global:SERVICES.Keys | Where-Object { 
        -not $global:SERVICES[$_].IsUtility -and 
        -not (Test-DockerImageExists -Tag "antigravity/$_")
    })
    
    if ($missingImages.Count -gt 0) {
        [PipelineLogger]::Error("Faltan imágenes: $($missingImages -join ', ')")
        return $false
    }
    [PipelineLogger]::Success("Todas las imágenes existen")

    # Levantar servicios usando DockerComposeManager
    [PipelineLogger]::Info("Levantando contenedores...")
    $composeManager = [DockerComposeManager]::new($script:COMPOSE_FILE, $script:ENV_FILE)
    
    if (-not $composeManager.Up($WaitForHealthy)) {
        [PipelineLogger]::Error("Error al levantar servicios")
        return $false
    }

    [PipelineLogger]::Success("Servicios levantados")
    Write-Host ""
    Write-Host "URLs de acceso:" -ForegroundColor Cyan
    Write-Host "  UI:      http://localhost:5173" -ForegroundColor Gray
    Write-Host "  API:     http://localhost:3000" -ForegroundColor Gray
    Write-Host "  Health:  http://localhost:3000/health" -ForegroundColor Gray
    Write-Host ""

    return $true
}

# =============================================================================
# SMOKE TEST
# =============================================================================

function Invoke-SmokeTest([switch]$WaitForServices) {
    [PipelineLogger]::Section("Smoke Test: Verificando servicios...")

    if ($WaitForServices) {
        [PipelineLogger]::Info("Esperando que servicios esten healthy...")
        $composeManager = [DockerComposeManager]::new($script:COMPOSE_FILE, $script:ENV_FILE)
        if (-not $composeManager.Up($true)) {
            [PipelineLogger]::Error("Error al levantar servicios")
            return $false
        }
    }

    $servicesToTest = @(
        @{ Name = "api-gateway"; Port = 3000; Path = "/health" }
        @{ Name = "auth-service"; Port = 3001; Path = "/health" }
        @{ Name = "typing-service"; Port = 8000; Path = "/health" }
        @{ Name = "provisioner-ui"; Port = 5173; Path = "/" }
    )

    $failed = @()
    foreach ($svc in $servicesToTest) {
        $url = "http://localhost:$($svc.Port)$($svc.Path)"
        [PipelineLogger]::Info("Testeando: $($svc.Name) ($url)")
        $result = Test-HttpEndpoint -Url $url -Timeout 5 -Retries 3
        if ($result.Success) {
            [PipelineLogger]::Success("$($svc.Name): OK")
        } else {
            [PipelineLogger]::Error("$($svc.Name): FALLO")
            $failed += $svc.Name
        }
    }

    if ($failed.Count -gt 0) {
        [PipelineLogger]::Error("Smoke test fallo en: $($failed -join ', ')")
        $composeManager = [DockerComposeManager]::new($script:COMPOSE_FILE, $script:ENV_FILE)
        foreach ($f in $failed) {
            Write-Host "`n=== $f ===" -ForegroundColor Yellow
            $composeManager.GetLogs($f, 10) | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
        }
        return $false
    }

    [PipelineLogger]::Success("Smoke test: Todos los servicios responden")
    return $true
}

function Test-ContainerLogs {
    param(
        [switch]$IncludeAll
    )

    Write-Section "Verificando logs de contenedores..."

    $errorPatterns = @(
        @{ Pattern = 'emerg|fatal|panic|critical'; Name = 'Errores criticos'; Exclude = @('checkpoint') }
        @{ Pattern = 'host not found|connection refused|timeout'; Name = 'Errores de red' }
        @{ Pattern = 'duplicate key|IntegrityError|violates unique'; Name = 'Errores de base de datos' }
        @{ Pattern = 'npm ERR|command not found|ENOENT'; Name = 'Errores de dependencia' }
        @{ Pattern = 'Traceback \(most recent call last\)'; Name = 'Stack traces' }
    )

    $allContainers = docker compose -f $script:COMPOSE_FILE ps --format '{{.Service}}' 2>$null
    if (-not $allContainers) {
        Write-Warning "No se pudieron obtener los contenedores"
        return $true
    }

    $containers = if ($IncludeAll) { $allContainers } else { $allContainers }

    $foundErrors = @{}

    foreach ($container in $containers) {
        $logs = docker compose -f $script:COMPOSE_FILE logs --since 2m --tail=50 $container 2>&1 | Out-String

        foreach ($patternInfo in $errorPatterns) {
            $matches = $logs | Select-String $patternInfo.Pattern

            if ($matches) {
                $filteredMatches = $matches | Where-Object {
                    $line = $_.Line
                    $excludeFound = $false
                    if ($patternInfo.Exclude) {
                        foreach ($excl in $patternInfo.Exclude) {
                            if ($line -match $excl) {
                                $excludeFound = $true
                                break
                            }
                        }
                    }
                    -not $excludeFound
                }

                if ($filteredMatches) {
                    if (-not $foundErrors.ContainsKey($container)) {
                        $foundErrors[$container] = @()
                    }
                    $foundErrors[$container] += @{ Pattern = $patternInfo.Name; Count = $filteredMatches.Count }
                }
            }
        }
    }

    if ($foundErrors.Count -gt 0) {
        Write-Host ""
        Write-Error "ERRORES ENCONTRADOS EN LOGS:"
        Write-Host ""

        foreach ($container in $foundErrors.Keys) {
            Write-Host "=== $container ===" -ForegroundColor Red
            $errors = $foundErrors[$container]
            foreach ($err in $errors) {
                Write-Host "  [$($err.Count)] $($err.Pattern)" -ForegroundColor Yellow
            }

            Write-Host ""
            Write-Host "  Logs relevantes (ultimos 2m):" -ForegroundColor Gray
            $logs = docker compose -f $script:COMPOSE_FILE logs --since 2m --tail=10 $container 2>&1 | Out-String
            $relevantLines = $logs -split "`n" | Where-Object {
                $_ -match 'emerg|fatal|panic|critical|host not found|connection refused|duplicate key|Error:|Traceback'
            } | Select-Object -First 10

            foreach ($line in $relevantLines) {
                Write-Host "    $line" -ForegroundColor DarkGray
            }
            Write-Host ""
        }

        Write-Error "Contenedores con errores: $($foundErrors.Keys -join ', ')"
        Write-Host ""
        Write-Host "SOLUCION:" -ForegroundColor Yellow
        Write-Host "  1. Revisa los logs arriba" -ForegroundColor Gray
        Write-Host "  2. Corrige los errores en el codigo" -ForegroundColor Gray
        Write-Host "  3. Ejecuta .\pipeline.ps1 --build para rebuild" -ForegroundColor Gray
        return $false
    }

    Write-Success "Logs verificados: Sin errores criticos"
    return $true
}

# =============================================================================
# MAIN
# =============================================================================

function Main {
    # Mostrar ayuda si es necesario
    if ($Help) {
        Show-Help
        exit 0
    }

    Write-Banner "vCenter Provisioner - Pipeline Unificado"

    # Deprecation warning for --cleanup
    if ($Cleanup) {
        Write-Warning "--cleanup está deprecado. Usa --down en su lugar."
    }

    # =================================================================
    # SERVICIOS (Up/Down/Status)
    # =================================================================
    
    # Status mode
    if ($Status) {
        Invoke-Status
        exit 0
    }

    # Down mode (reemplaza --cleanup)
    if ($Down) {
        Write-Info "Modo: Bajar servicios"
        $downResult = Invoke-Down -RemoveImages:$Cleanup  # --cleanup ahora es flag adicional
        if (-not $downResult) {
            Write-Error "Error bajando servicios"
            exit 1
        }
        exit 0
    }

    # Up mode
    if ($Up) {
        $upResult = Invoke-Up
        if (-not $upResult) {
            Write-Error "Error levantando servicios"
            exit 1
        }
        exit 0
    }

    # =================================================================
    # PIPELINE (Lint/Test/Build)
    # =================================================================

    # Determinar que fases ejecutar
    # Por defecto: --all --docker (modo determinismo maximo recomendado)
    $isDefaultRun = -not ($Lint -or $Test -or $Build -or $All -or $Docker -or $Validate -or $Up -or $Down -or $Help)
    $doLint = $Lint -or $All -or $isDefaultRun
    $doTest = $Test -or $All -or $isDefaultRun
    $doBuild = $Build -or $All -or $isDefaultRun
    $doDockerTest = $Docker -or $isDefaultRun
    $doValidate = $Validate

    # Mostrar modo recomendado si es ejecución por defecto
    if ($isDefaultRun) {
        Write-Host ""
        Write-Host "  💡 Modo determinismo máximo activado (recomendado)" -ForegroundColor Cyan
        Write-Host "     Ejecutando: Lint + Tests + Build completo en Docker" -ForegroundColor Gray
        Write-Host "     Detecta todos los errores, incluyendo problemas específicos de contenedores." -ForegroundColor Gray
        Write-Host ""
    }

    Write-Info "Fases: $(if ($doLint) { 'Lint (Host)' }) $(if ($doTest) { "Test $(if ($doDockerTest) { '(Docker)' } else { '(Host)' })" }) $(if ($doBuild) { 'Build' })"

    # Validacion temprana
    if ($doValidate -or (-not $doLint -and -not $doTest -and -not $doBuild)) {
        $prereqs = Test-Prerequisites
        if (-not $prereqs) {
            Write-Error "Prerequisitos no cumplidos"
            exit 1
        }
        if ($doValidate) {
            Write-Success "Validacion completada"
            exit 0
        }
    }

    # Ejecutar fases
    $success = $true
    $startTime = [System.Diagnostics.Stopwatch]::StartNew()

    # Lint (SIEMPRE en host, más rápido y no requiere Docker)
    if ($doLint) {
        Write-Section "Ejecutando Lint en Host..."
        $lintResult = Invoke-LintAll
        if (-not $lintResult) { $success = $false }
    }

    # Tests (en Docker o Host según flag)
    if ($doTest -and $success) {
        $testResult = Invoke-TestAll -InDocker:$doDockerTest
        if (-not $testResult) { $success = $false }
    }

    # Build
    if ($doBuild -and $success) {
        $buildResult = Invoke-BuildAll -Services $global:SERVICES -Force:$Force -NoCache:$NoCache
        if (-not $buildResult) { $success = $false }

        # Verificar logs despues del build (solo en modo Docker)
        if ($success -and $doDockerTest) {
            Write-Host ""
            Write-Section "Verificando contenedores..."

            Write-Info "Levantando contenedores..."
            $upOutput = docker compose -f $script:COMPOSE_FILE --env-file $script:ENV_FILE up -d --wait 2>&1
            $upExitCode = $LASTEXITCODE

            if ($upExitCode -ne 0) {
                Write-Error "Error al levantar contenedores"
                Write-Host $upOutput
                $success = $false
            }
            else {
                Write-Info "Contenedores levantados, verificando logs..."

                $logsResult = Test-ContainerLogs
                if (-not $logsResult) { $success = $false }
            }

            if ($success) {
                Write-Host ""
                $smokeResult = Invoke-SmokeTest
                if (-not $smokeResult) { $success = $false }
            }
        }
    }

    $startTime.Stop()
    Write-Host ""
    Write-Host ("=" * 70) -ForegroundColor $(if ($success) { "Green" } else { "Red" })
    Write-Host "  Pipeline $(if ($success) { 'EXITOSO' } else { 'FALLO' })" -ForegroundColor $(if ($success) { "Green" } else { "Red" })
    $elapsed = $startTime.Elapsed
    $elapsedStr = "{0:mm}:{0:ss}" -f $elapsed
    Write-Host "  Tiempo: $elapsedStr" -ForegroundColor Gray
    Write-Host ("=" * 70) -ForegroundColor $(if ($success) { "Green" } else { "Red" })

    if (-not $success) {
        Write-Host ""
        Write-Info "Comandos utiles:"
        Write-Host "  .\pipeline.ps1 --lint          # Solo lint" -ForegroundColor Gray
        Write-Host "  .\pipeline.ps1 --validate      # Verificar prerrequisitos" -ForegroundColor Gray
        Write-Host "  .\pipeline.ps1 --all --verbose  # Todo con detalles" -ForegroundColor Gray
        Write-Host "  .\pipeline.ps1 --up            # Levantar servicios" -ForegroundColor Gray
        Write-Host "  .\pipeline.ps1 --down          # Bajar servicios" -ForegroundColor Gray
        Write-Host "  .\pipeline.ps1 --status        # Ver estado" -ForegroundColor Gray
    }
    else {
        Write-Host ""
        Write-Info "Sistema listo:"
        Write-Host "  .\pipeline.ps1 --up      # Levantar servicios" -ForegroundColor Gray
        Write-Host "  .\pipeline.ps1 --down    # Bajar servicios" -ForegroundColor Gray
        Write-Host "  .\pipeline.ps1 --status  # Ver estado" -ForegroundColor Gray
    }
}

# Ejecutar
Main
