#!/usr/bin/env pwsh
# =============================================================================
# hash.ps1 - Hash Determinista
# =============================================================================
# Genera hash SHA256 determinista del contenido de un directorio.
# USADO POR: pipeline.ps1, build.ps1, start.ps1
# =============================================================================
# USO:
#   . "scripts/ci/hash.ps1"
#   $hash = Get-DirectoryHash -Path "./apps/api-gateway"
# =============================================================================

function Get-DirectoryHash {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )
    
    $root = (Resolve-Path $Path).Path.Replace('\', '/').TrimEnd('/')
    
    $excludedPatterns = @(
        "node_modules"
        "__pycache__"
        ".git"
        ".env"
        ".env.*"
        ".vscode"
        ".idea"
        ".dockerignore"
        "*.log"
        "dist"
        "build"
        ".cache"
        ".pytest_cache"
        "*.egg-info"
        "*.pyc"
        ".coverage"
        "htmlcov"
        "test-results"
        ".terraform"
        "*.tfstate"
        "*.tfstate.*"
        "secrets.json"
        "*.pem"
        "*.key"
        ".DS_Store"
        "Thumbs.db"
        ".nvmrc"
        ".python-version"
        ".ruby-version"
        "coverage.xml"
        ".nyc_output"
    )
    
    function Test-Excluded {
        param([string]$Path)
        foreach ($pattern in $excludedPatterns) {
            if ($pattern.Contains("*")) {
                if ($Path -like $pattern) { return $true }
            } else {
                if ($Path -eq $pattern -or $Path.Contains("/$pattern/") -or $Path.StartsWith($pattern)) { return $true }
            }
        }
        return $false
    }
    
    $files = @()
    $rawFiles = Get-ChildItem -Path $Path -Recurse -File
    foreach ($f in $rawFiles) {
        $relativePath = $f.FullName.Replace($root, "").Replace('\', '/').TrimStart('/')
        if (Test-Excluded -Path $relativePath) { continue }
        
        $fileHash = (Get-FileHash -Algorithm SHA256 $f.FullName).Hash
        $files += @{ Path = $relativePath; Hash = $fileHash }
    }
    $files = $files | Sort-Object -Property Path
    
    $content = ""
    foreach ($f in $files) {
        $content += "$($f.Path):$($f.Hash)`n"
    }
    
    return (Get-FileHash -Algorithm SHA256 -InputStream ([System.IO.MemoryStream]::new([System.Text.Encoding]::UTF8.GetBytes($content)))).Hash.Substring(0, 10)
}

function Get-ServiceHash {
    <#
    .SYNOPSIS
        Calcula hash del servicio INCLUYENDO sus dependencias.
        Si shared-scripts cambia, el hash del servicio también cambia.
    .EXAMPLE
        $hash = Get-ServiceHash -ServicePath "apps/api-gateway" -SharedScriptsHash "ABC123"
    #>
    param(
        [Parameter(Mandatory = $true)]
        [string]$ServicePath,
        
        [Parameter(Mandatory = $false)]
        [string]$SharedScriptsHash
    )
    
    # 1. Hash del código fuente del servicio
    $codeHash = Get-DirectoryHash -Path $ServicePath
    
    # 2. Si se proporciona hash de shared-scripts, combinar
    if ($SharedScriptsHash) {
        $combined = "$ServicePath`:$codeHash+$SharedScriptsHash"
        $combinedBytes = [System.Text.Encoding]::UTF8.GetBytes($combined)
        return (Get-FileHash -Algorithm SHA256 -InputStream ([System.IO.MemoryStream]::new($combinedBytes))).Hash.Substring(0, 10)
    }
    
    # Solo hash del código (backwards compatible)
    return $codeHash
}
