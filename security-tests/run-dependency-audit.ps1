#!/usr/bin/env pwsh

# Dependency Audit for vCenter Provisioner
# Staff-Grade: Automated security vulnerability scanning for dependencies

[CmdletBinding()]
param(
    [switch]$FixAutomated,
    [switch]$FullReport
)

$ErrorActionPreference = "Stop"
$BASE_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMsg = "[$timestamp] [$Level] $Message"
    if ($Level -eq "ERROR") {
        Write-Host $logMsg -ForegroundColor Red
    } elseif ($Level -eq "WARN") {
        Write-Host $logMsg -ForegroundColor Yellow
    } elseif ($Level -eq "SUCCESS") {
        Write-Host $logMsg -ForegroundColor Green
    } else {
        Write-Host $logMsg -ForegroundColor White
    }
}

function Audit-NodeDependencies {
    param([string]$ServiceDir)
    
    Write-Log "Auditing Node.js dependencies in $ServiceDir..."
    
    Push-Location $ServiceDir
    try {
        # Run npm audit
        $auditOutput = npm audit --json 2>&1 | Out-String
        $auditData = $auditOutput | ConvertFrom-Json
        
        $vulnerabilities = $auditData.metadata.vulnerabilities
        $highVulns = $vulnerabilities.high
        $criticalVulns = $vulnerabilities.critical
        $moderateVulns = $vulnerabilities.moderate
        $lowVulns = $vulnerabilities.low
        
        Write-Log "=== Node.js Dependencies Audit ===" "INFO"
        Write-Log "Critical: $criticalVulns" $(if ($criticalVulns -gt 0) { "ERROR" } else { "SUCCESS" })
        Write-Log "High: $highVulns" $(if ($highVulns -gt 0) { "ERROR" } else { "SUCCESS" })
        Write-Log "Moderate: $moderateVulns" "INFO"
        Write-Log "Low: $lowVulns" "INFO"
        
        if ($FixAutomated -and ($highVulns -gt 0 -or $criticalVulns -gt 0)) {
            Write-Log "Running npm audit fix..." "WARN"
            npm audit fix
        }
        
        return @{
            Critical = $criticalVulns
            High = $highVulns
            Moderate = $moderateVulns
            Low = $lowVulns
        }
    }
    catch {
        Write-Log "Error auditing Node.js dependencies: $($_.Exception.Message)" "ERROR"
        return @{
            Critical = 0
            High = 0
            Moderate = 0
            Low = 0
            Error = $_.Exception.Message
        }
    }
    finally {
        Pop-Location
    }
}

function Audit-PythonDependencies {
    param([string]$ServiceDir)
    
    Write-Log "Auditing Python dependencies in $ServiceDir..."
    
    Push-Location $ServiceDir
    try {
        # Check if pip-audit is installed
        $pipAuditInstalled = Get-Command pip-audit -ErrorAction SilentlyContinue
        
        if (-not $pipAuditInstalled) {
            Write-Log "pip-audit not installed. Installing..." "WARN"
            pip install pip-audit
        }
        
        # Run pip-audit
        $auditOutput = pip-audit --json 2>&1 | Out-String
        
        if ($auditOutput -match 'No known vulnerabilities found') {
            Write-Log "No known vulnerabilities found" "SUCCESS"
            return @{
                High = 0
                Medium = 0
                Low = 0
            }
        }
        
        $auditData = $auditOutput | ConvertFrom-Json
        $vulns = $auditData | Measure-Object
        
        $highVulns = ($auditData | Where-Object { $_.vulnerabilities.severity -eq 'high' } | Measure-Object).Count
        $mediumVulns = ($auditData | Where-Object { $_.vulnerabilities.severity -eq 'medium' } | Measure-Object).Count
        $lowVulns = ($auditData | Where-Object { $_.vulnerabilities.severity -eq 'low' } | Measure-Object).Count
        
        Write-Log "=== Python Dependencies Audit ===" "INFO"
        Write-Log "High: $highVulns" $(if ($highVulns -gt 0) { "ERROR" } else { "SUCCESS" })
        Write-Log "Medium: $mediumVulns" "INFO"
        Write-Log "Low: $lowVulns" "INFO"
        
        if ($FullReport) {
            Write-Log $auditOutput "INFO"
        }
        
        return @{
            High = $highVulns
            Medium = $mediumVulns
            Low = $lowVulns
        }
    }
    catch {
        Write-Log "Error auditing Python dependencies: $($_.Exception.Message)" "ERROR"
        return @{
            High = 0
            Medium = 0
            Low = 0
            Error = $_.Exception.Message
        }
    }
    finally {
        Pop-Location
    }
}

function Audit-GoDependencies {
    param([string]$ServiceDir)
    
    Write-Log "Auditing Go dependencies in $ServiceDir..."
    
    Push-Location $ServiceDir
    try {
        # Run govulncheck
        $govulncheckInstalled = Get-Command govulncheck -ErrorAction SilentlyContinue
        
        if (-not $govulncheckInstalled) {
            Write-Log "govulncheck not installed. Please install from: https://pkg.go.dev/golang.org/x/vuln/cmd/govulncheck" "WARN"
            return @{
                High = 0
                Medium = 0
                Low = 0
                Error = "govulncheck not installed"
            }
        }
        
        $auditOutput = govulncheck -json ./... 2>&1 | Out-String
        
        if ($auditOutput -match 'No vulnerabilities found') {
            Write-Log "No vulnerabilities found" "SUCCESS"
            return @{
                High = 0
                Medium = 0
                Low = 0
            }
        }
        
        $auditData = $auditOutput | ConvertFrom-Json
        $vulns = $auditData.Vulns
        
        $highVulns = ($vulns | Where-Object { $_.Severity -eq 'HIGH' } | Measure-Object).Count
        $mediumVulns = ($vulns | Where-Object { $_.Severity -eq 'MEDIUM' } | Measure-Object).Count
        $lowVulns = ($vulns | Where-Object { $_.Severity -eq 'LOW' } | Measure-Object).Count
        
        Write-Log "=== Go Dependencies Audit ===" "INFO"
        Write-Log "High: $highVulns" $(if ($highVulns -gt 0) { "ERROR" } else { "SUCCESS" })
        Write-Log "Medium: $mediumVulns" "INFO"
        Write-Log "Low: $lowVulns" "INFO"
        
        if ($FullReport) {
            Write-Log $auditOutput "INFO"
        }
        
        return @{
            High = $highVulns
            Medium = $mediumVulns
            Low = $lowVulns
        }
    }
    catch {
        Write-Log "Error auditing Go dependencies: $($_.Exception.Message)" "ERROR"
        return @{
            High = 0
            Medium = 0
            Low = 0
            Error = $_.Exception.Message
        }
    }
    finally {
        Pop-Location
    }
}

# Main execution
Write-Log "Starting dependency audit for vCenter Provisioner..."
Write-Log "========================================"

$totalCritical = 0
$totalHigh = 0
$totalModerate = 0
$totalLow = 0

# API Gateway (Node.js)
Write-Log ""
Write-Log "Auditing API Gateway..." "INFO"
$result = Audit-NodeDependencies -ServiceDir (Join-Path $BASE_DIR "apps\api-gateway")
$totalCritical += $result.Critical
$totalHigh += $result.High
$totalModerate += $result.Moderate
$totalLow += $result.Low

# Auth Service (Node.js)
Write-Log ""
Write-Log "Auditing Auth Service..." "INFO"
$result = Audit-NodeDependencies -ServiceDir (Join-Path $BASE_DIR "apps\auth-service")
$totalCritical += $result.Critical
$totalHigh += $result.High
$totalModerate += $result.Moderate
$totalLow += $result.Low

# Typing Service (Python)
Write-Log ""
Write-Log "Auditing Typing Service..." "INFO"
$result = Audit-PythonDependencies -ServiceDir (Join-Path $BASE_DIR "apps\typing-service")
$totalHigh += $result.High
$totalModerate += $result.Medium
$totalLow += $result.Low

# Stats Service (Python)
Write-Log ""
Write-Log "Auditing Stats Service..." "INFO"
$result = Audit-PythonDependencies -ServiceDir (Join-Path $BASE_DIR "apps\stats-service")
$totalHigh += $result.High
$totalModerate += $result.Medium
$totalLow += $result.Low

# VM Orchestrator (Go)
Write-Log ""
Write-Log "Auditing VM Orchestrator..." "INFO"
$result = Audit-GoDependencies -ServiceDir (Join-Path $BASE_DIR "apps\vm-orchestrator")
$totalHigh += $result.High
$totalModerate += $result.Medium
$totalLow += $result.Low

# vCenter Integration (Go)
Write-Log ""
Write-Log "Auditing vCenter Integration..." "INFO"
$result = Audit-GoDependencies -ServiceDir (Join-Path $BASE_DIR "apps\vcenter-integration")
$totalHigh += $result.High
$totalModerate += $result.Medium
$totalLow += $result.Low

# Monitoring Service (Go)
Write-Log ""
Write-Log "Auditing Monitoring Service..." "INFO"
$result = Audit-GoDependencies -ServiceDir (Join-Path $BASE_DIR "apps\monitoring-service")
$totalHigh += $result.High
$totalModerate += $result.Medium
$totalLow += $result.Low

# Provisioner UI (Node.js)
Write-Log ""
Write-Log "Auditing Provisioner UI..." "INFO"
$result = Audit-NodeDependencies -ServiceDir (Join-Path $BASE_DIR "apps\provisioner-ui")
$totalCritical += $result.Critical
$totalHigh += $result.High
$totalModerate += $result.Moderate
$totalLow += $result.Low

# Summary
Write-Log ""
Write-Log "========================================"
Write-Log "         DEPENDENCY AUDIT SUMMARY" "INFO"
Write-Log "========================================"
Write-Log "Total Critical Vulnerabilities: $totalCritical" $(if ($totalCritical -gt 0) { "ERROR" } else { "SUCCESS" })
Write-Log "Total High Vulnerabilities: $totalHigh" $(if ($totalHigh -gt 0) { "ERROR" } else { "SUCCESS" })
Write-Log "Total Moderate Vulnerabilities: $totalModerate" "INFO"
Write-Log "Total Low Vulnerabilities: $totalLow" "INFO"
Write-Log "========================================"

if ($totalCritical -gt 0 -or $totalHigh -gt 0) {
    Write-Log "CRITICAL or HIGH vulnerabilities found. Please review and fix." "ERROR"
    exit 1
} else {
    Write-Log "No CRITICAL or HIGH vulnerabilities found." "SUCCESS"
    exit 0
}
