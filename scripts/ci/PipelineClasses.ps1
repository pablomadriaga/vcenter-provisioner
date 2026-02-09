#!/usr/bin/env pwsh
# =============================================================================
# PipelineClasses.ps1 - Clases Modernas para PowerShell 7.5+
# =============================================================================
# Proporciona estructura OOP y utilidades modernas para el pipeline
# =============================================================================

enum ServiceType {
    Node
    Python
    Go
    React
    Scripts
    Utility
}

enum BuildResult {
    Success
    Failed
    Skipped
    Cached
}

enum LogErrorType {
    Critical
    Network
    Database
    Dependency
    StackTrace
}

# =============================================================================
# LOGGER - Clase estática para logging consistente
# =============================================================================
class PipelineLogger {
    static [void] Banner([string]$Message) {
        Write-Host "`n$('=' * 70)" -ForegroundColor Cyan
        Write-Host "  $Message" -ForegroundColor Cyan
        Write-Host "$('=' * 70)" -ForegroundColor Cyan
    }
    
    static [void] Section([string]$Message) {
        Write-Host "`n$Message" -ForegroundColor Yellow
    }
    
    static [void] Step([int]$Step, [int]$Total, [string]$Message) {
        Write-Host "`n[$Step/$Total] $Message" -ForegroundColor Magenta
    }
    
    static [void] Info([string]$Message) {
        Write-Host "  ℹ️  $Message" -ForegroundColor Gray
    }
    
    static [void] Success([string]$Message) {
        Write-Host "  ✅ $Message" -ForegroundColor Green
    }
    
    static [void] Error([string]$Message) {
        Write-Host "  ❌ $Message" -ForegroundColor Red
    }
    
    static [void] Warning([string]$Message) {
        Write-Host "  ⚠️  $Message" -ForegroundColor Yellow
    }
    
    static [void] Recommendation([string]$Message) {
        Write-Host "  💡 $Message" -ForegroundColor Cyan
    }
}

# =============================================================================
# SERVICE CONFIGURATION - Clase para manejar servicios
# =============================================================================
class ServiceConfiguration {
    [string]$Name
    [string]$Path
    [string]$ImageName
    [ServiceType]$Type
    [string]$LintCmd
    [string]$TestCmd
    [string]$BuildCmd
    [bool]$IsUtility
    [hashtable]$EnvVars
    [string[]]$DependsOn
    
    ServiceConfiguration([string]$name, [hashtable]$config) {
        $this.Name = $name
        $this.Path = $config.Path
        $this.ImageName = $config.ImageName
        $this.Type = [ServiceType]($config.Type ?? 'Node')
        $this.LintCmd = $config.LintCmd
        $this.TestCmd = $config.TestCmd
        $this.BuildCmd = $config.BuildCmd
        $this.IsUtility = $config.IsUtility ?? $false
        $this.EnvVars = $config.EnvVars ?? @{}
        $this.DependsOn = $config.DependsOn ?? @()
    }
    
    [string] GetFullPath([string]$baseDir) {
        return Join-Path $baseDir $this.Path
    }
    
    [string] GetDockerTag([string]$hash) {
        return "$($this.ImageName):$hash"
    }
    
    [bool] ShouldSkip() {
        return $this.IsUtility -or $this.Type -eq [ServiceType]::React
    }
    
    [string] GetHashVarName() {
        return "$($this.Name.ToUpper() -replace '-', '_')_HASH"
    }
}

# =============================================================================
# BUILD STATUS - Clase para trackear resultados
# =============================================================================
class BuildStatus {
    [string]$ServiceName
    [BuildResult]$Result
    [string]$ImageTag
    [string]$ErrorMessage
    [timespan]$Duration
    
    BuildStatus([string]$serviceName) {
        $this.ServiceName = $serviceName
        $this.Result = [BuildResult]::Success
    }
    
    [void] MarkFailed([string]$errorMsg) {
        $this.Result = [BuildResult]::Failed
        $this.ErrorMessage = $errorMsg
    }
    
    [void] MarkSkipped() {
        $this.Result = [BuildResult]::Skipped
    }
    
    [void] MarkCached() {
        $this.Result = [BuildResult]::Cached
    }
}

# =============================================================================
# LOG ERROR PATTERN - Clase para patrones de errores
# =============================================================================
class LogErrorPattern {
    [LogErrorType]$Type
    [string]$Pattern
    [string[]]$Exclude
    
    LogErrorPattern([LogErrorType]$type, [string]$pattern, [string[]]$exclude) {
        $this.Type = $type
        $this.Pattern = $pattern
        $this.Exclude = $exclude ?? @()
    }
    
    static [LogErrorPattern[]] GetDefaultPatterns() {
        return @(
            [LogErrorPattern]::new([LogErrorType]::Critical, 'emerg|fatal|panic|critical', @('checkpoint'))
            [LogErrorPattern]::new([LogErrorType]::Network, 'host not found|connection refused|timeout', @())
            [LogErrorPattern]::new([LogErrorType]::Database, 'duplicate key|IntegrityError|violates unique', @())
            [LogErrorPattern]::new([LogErrorType]::Dependency, 'npm ERR|command not found|ENOENT', @())
            [LogErrorPattern]::new([LogErrorType]::StackTrace, 'Traceback \(most recent call last\)', @())
        )
    }
}

# =============================================================================
# FUNCTIONS - Utilidades modernas
# =============================================================================

function Invoke-InDirectory {
    <#
    .SYNOPSIS
        Ejecuta un script block dentro de un directorio y vuelve al original.
    .DESCRIPTION
        Abstrae el patrón Push-Location / try / finally / Pop-Location.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Path,
        
        [Parameter(Mandatory)]
        [scriptblock]$ScriptBlock,
        
        [string]$ErrorPrefix = ""
    )
    
    $originalLocation = Get-Location
    try {
        Set-Location $Path
        & $ScriptBlock
    }
    catch {
        if ($ErrorPrefix) {
            [PipelineLogger]::Error("${ErrorPrefix}: $($_.Exception.Message)")
        }
        throw
    }
    finally {
        Set-Location $originalLocation
    }
}

function Invoke-LoggedCommand {
    <#
    .SYNOPSIS
        Ejecuta un comando con logging automático.
    .DESCRIPTION
        Ejecuta Invoke-Expression y loggea resultado automáticamente.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Name,
        
        [Parameter(Mandatory)]
        [string]$Command,
        
        [string]$SuccessMessage = "OK",
        [string]$ErrorMessage = "FALLO"
    )
    
    try {
        $output = Invoke-Expression $Command 2>&1
        $exitCode = $LASTEXITCODE ?? 0
        
        if ($exitCode -eq 0) {
            [PipelineLogger]::Success("$Name`: $SuccessMessage")
            return @{ Success = $true; Output = $output; ExitCode = 0 }
        }
        else {
            [PipelineLogger]::Error("$Name`: $ErrorMessage")
            return @{ Success = $false; Output = $output; ExitCode = $exitCode }
        }
    }
    catch {
        [PipelineLogger]::Error("$Name`: Error - $($_.Exception.Message)")
        return @{ Success = $false; Error = $_ }
    }
}

function Get-HashFromEnvFile {
    <#
    .SYNOPSIS
        Obtiene un hash del archivo .env.ci usando Select-String moderno.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$EnvFile,
        
        [Parameter(Mandatory)]
        [string]$HashVar
    )
    
    if (-not (Test-Path $EnvFile)) {
        return $null
    }
    
    $match = Get-Content $EnvFile |
        Select-String -Pattern "${HashVar}=(.+)" |
        Select-Object -First 1
    
    return $match ? $match.Matches.Groups[1].Value : $null
}

function Invoke-DockerBuild {
    <#
    .SYNOPSIS
        Ejecuta docker build con splatting moderno.
    .DESCRIPTION
        Usa splatting para construir imagenes Docker de forma limpia.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Tag,
        
        [hashtable]$BuildArgs = @{},
        
        [switch]$NoCache,
        [switch]$Pull
    )
    
    $dockerParams = @{
        FilePath = 'docker'
        ArgumentList = @(
            'build'
            '--pull=false'
            '-t', $Tag
            '.'
        )
        PassThru = $true
        Wait = $true
        NoNewWindow = $true
    }
    
    if ($NoCache) { $dockerParams.ArgumentList += '--no-cache' }
    if ($Pull) { 
        $dockerParams.ArgumentList = $dockerParams.ArgumentList -replace '--pull=false', '--pull=true'
    }
    
    # Agregar build-args
    foreach ($arg in $BuildArgs.GetEnumerator()) {
        $dockerParams.ArgumentList += '--build-arg'
        $dockerParams.ArgumentList += "$($arg.Key)=$($arg.Value)"
    }
    
    try {
        $process = Start-Process @dockerParams
        return @{ 
            Success = ($process.ExitCode -eq 0)
            ExitCode = $process.ExitCode 
        }
    }
    catch {
        [PipelineLogger]::Error("Docker build fallo: $($_.Exception.Message)")
        return @{ Success = $false; Error = $_ }
    }
}

function Invoke-DockerTag {
    <#
    .SYNOPSIS
        Crea tags Docker con splatting.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Source,
        
        [Parameter(Mandatory)]
        [string]$Target
    )
    
    try {
        $process = Start-Process -FilePath 'docker' -ArgumentList @('tag', $Source, $Target) -Wait -PassThru -NoNewWindow
        return $process.ExitCode -eq 0
    }
    catch {
        return $false
    }
}

function Test-DockerImageExists {
    <#
    .SYNOPSIS
        Verifica si una imagen Docker existe.
    #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Tag)
    
    try {
        $result = docker images -q $Tag 2>$null
        return [bool]$result
    }
    catch {
        return $false
    }
}

# =============================================================================
# DOCKER COMPOSE MANAGER
# =============================================================================

class DockerComposeManager {
    [string]$ComposeFile
    [string]$EnvFile
    
    DockerComposeManager([string]$composeFile, [string]$envFile) {
        $this.ComposeFile = $composeFile
        $this.EnvFile = $envFile
    }
    
    [bool] Up([bool]$waitForHealthy) {
        $args = @('-f', $this.ComposeFile, '--env-file', $this.EnvFile, 'up', '-d')
        if ($waitForHealthy) { $args += '--wait' }
        return $this.Invoke($args)
    }
    
    [bool] Down() {
        return $this.Invoke(@('-f', $this.ComposeFile, 'down'))
    }
    
    [bool] Invoke([array]$arguments) {
        try {
            $process = Start-Process -FilePath 'docker' -ArgumentList (@('compose') + $arguments) -Wait -PassThru -NoNewWindow
            return $process.ExitCode -eq 0
        }
        catch {
            return $false
        }
    }
    
    [string[]] GetServices() {
        try {
            return docker compose -f $this.ComposeFile ps --format '{{.Service}}' 2>$null
        }
        catch {
            return @()
        }
    }
    
    [string] GetLogs([string]$service, [int]$tail = 50) {
        try {
            return docker compose -f $this.ComposeFile logs --tail=$tail $service 2>&1 | Out-String
        }
        catch {
            return ''
        }
    }
}

# =============================================================================
# VALIDATION HELPERS
# =============================================================================

function Test-PrerequisitePort([int]$Port) {
    <#
    .SYNOPSIS
        Verifica si un puerto está disponible.
    #>
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
    try {
        $listener.Start()
        return $true
    }
    catch {
        return $false
    }
    finally {
        $listener.Stop()
    }
}

function Test-HttpEndpoint([string]$Url, [int]$Timeout = 5, [int]$Retries = 3) {
    <#
    .SYNOPSIS
        Testea un endpoint HTTP con reintentos.
    #>
    for ($i = 1; $i -le $Retries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -TimeoutSec $Timeout -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                return @{ Success = $true; Attempts = $i }
            }
        }
        catch {
            if ($i -lt $Retries) {
                Start-Sleep -Seconds 2
            }
        }
    }
    return @{ Success = $false; Attempts = $Retries }
}

# =============================================================================
# PIPELINE RUNNER
# =============================================================================

class PipelineRunner {
    [hashtable]$Config
    [System.Collections.ArrayList]$Errors
    [timespan]$StartTime
    
    PipelineRunner([hashtable]$config) {
        $this.Config = $config
        $this.Errors = [System.Collections.ArrayList]::new()
        $this.StartTime = [System.Diagnostics.Stopwatch]::StartNew()
    }
    
    [bool] RunPhase([string]$PhaseName, [scriptblock]$Action) {
        [PipelineLogger]::Section("Ejecutando: $PhaseName")
        try {
            $result = & $Action
            return $result
        }
        catch {
            [void]$this.Errors.Add("$PhaseName`: $($_.Exception.Message)")
            return $false
        }
    }
    
    [void] Finish() {
        $this.StartTime.Stop()
        $elapsed = '{0:mm}:{0:ss}' -f $this.StartTime.Elapsed
        $color = $this.Errors.Count -eq 0 ? 'Green' : 'Red'
        $status = $this.Errors.Count -eq 0 ? 'EXITOSO' : 'FALLO'
        
        Write-Host ""
        Write-Host ('=' * 70) -ForegroundColor $color
        Write-Host "  Pipeline $status" -ForegroundColor $color
        Write-Host "  Tiempo: $elapsed" -ForegroundColor Gray
        Write-Host ('=' * 70) -ForegroundColor $color
    }
}

# =============================================================================
# FIN
# =============================================================================
# Todas las funciones y clases están disponibles globalmente tras importar
