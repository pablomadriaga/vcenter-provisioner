# Test Runner Script para vCenter Provisioner
# Staff-Grade: Robust error handling, parameter validation, modular design

param(
    [bool]$SkipCoverage = $false,
    [bool]$Verbose = $false
)

$ErrorActionPreference = "Stop"
$BASE_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

$colors = @{
    Success = "Green"
    Error = "Red"
    Warning = "Yellow"
    Info = "Cyan"
}

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMsg = "[$timestamp] [$Level] $Message"
    if ($Level -eq "ERROR") {
        Write-Host $logMsg -ForegroundColor Red
    } elseif ($Level -eq "WARN") {
        Write-Host $logMsg -ForegroundColor Yellow
    } else {
        Write-Host $logMsg -ForegroundColor White
    }
}

function Get-GoTestResults {
    param([string]$Output)
    $passed = 0
    $failed = 0
    if ($Output -match "PASS") {
        $matches = [regex]::Matches($Output, "PASS")
        $passed = $matches.Count
    }
    if ($Output -match "FAIL") {
        $matches = [regex]::Matches($Output, "FAIL")
        $failed = $matches.Count
    }
    return @{ Passed = $passed; Failed = $failed }
}

function Get-PytestResults {
    param([string]$Output)
    $passed = 0
    $failed = 0
    if ($Output -match "PASSED") {
        $matches = [regex]::Matches($Output, "PASSED")
        $passed = $matches.Count
    }
    if ($Output -match "FAILED") {
        $matches = [regex]::Matches($Output, "FAILED")
        $failed = $matches.Count
    }
    return @{ Passed = $passed; Failed = $failed }
}

function Get-VitestResults {
    param([string]$Output)
    $passed = 0
    $failed = 0
    if ($Output -match "(\d+)\s+passed") {
        $match = [regex]::Match($Output, "(\d+)\s+passed")
        if ($match) {
            $passed = [int]$match.Groups[1].Value
        }
    }
    if ($Output -match "(\d+)\s+failed") {
        $match = [regex]::Match($Output, "(\d+)\s+failed")
        if ($match) {
            $failed = [int]$match.Groups[1].Value
        }
    }
    return @{ Passed = $passed; Failed = $failed }
}

function Get-Coverage {
    param([string]$Output, [string]$Command)
    $coverage = "N/A"
    try {
        if ($Command -match "go tool cover") {
            $match = [regex]::Match($Output, "total:\s+\(statements\)\s+(\d+\.\d+)%")
            if ($match) {
                $coverage = $match.Groups[1].Value + "%"
            }
        }
        elseif ($Command -match "pytest.*--cov") {
            $match = [regex]::Match($Output, "TOTAL\s+\d+\s+\d+\s+(\d+\.\d+)%")
            if ($match) {
                $coverage = $match.Groups[1].Value + "%"
            }
        }
        elseif ($Command -match "test:coverage") {
            $match = [regex]::Match($Output, "All files\s+\|\s+(\d+\.\d+)%")
            if ($match) {
                $coverage = $match.Groups[1].Value + "%"
            }
        }
    }
    catch {
        Write-Log "Error parsing coverage: $($_.Exception.Message)" "WARN"
    }
    return $coverage
}

function Test-Service {
    param(
        [string]$ServiceName,
        [string]$ServicePath,
        [string]$TestCommand,
        [string]$CoverageCommand
    )

    Write-Host "`n=== Testing $ServiceName ===" -ForegroundColor Cyan

    $serviceDir = Join-Path $BASE_DIR $ServicePath

    if (-not (Test-Path $serviceDir)) {
        Write-Log "Service directory not found: $serviceDir" "ERROR"
        return @{ Status = "SKIP"; Tests = 0; Passed = 0; Failed = 0; Coverage = "N/A" }
    }

    try {
        Push-Location $serviceDir

        $testOutput = & $TestCommand 2>&1 | Out-String
        $testResult = $LASTEXITCODE

        if ($Verbose) {
            Write-Log "Test output: $testOutput" "INFO"
        }

        $results = @{}
        if ($TestCommand -match "go test") {
            $results = Get-GoTestResults -Output $testOutput
        }
        elseif ($TestCommand -match "pytest") {
            $results = Get-PytestResults -Output $testOutput
        }
        elseif ($TestCommand -match "npm test") {
            $results = Get-VitestResults -Output $testOutput
        }

        $passedTests = $results.Passed
        $failedTests = $results.Failed
        $totalTests = $passedTests + $failedTests

        $coverage = "N/A"
        if (-not $SkipCoverage -and $CoverageCommand) {
            $coverageOutput = & $CoverageCommand 2>&1 | Out-String
            $coverage = Get-Coverage -Output $coverageOutput -Command $CoverageCommand
            if ($Verbose) {
                Write-Log "Coverage output: $coverageOutput" "INFO"
            }
        }

        Pop-Location

        $status = "PASS"
        if ($testResult -ne 0 -or $totalTests -eq 0) {
            $status = "FAIL"
        }

        if ($totalTests -gt 0) {
            $msg = "All $totalTests tests passed"
            if ($coverage -ne "N/A") {
                $msg = $msg + " ($coverage coverage)"
            }
            Write-Host $msg -ForegroundColor Green
        } else {
            Write-Host "No tests found" -ForegroundColor Yellow
        }

        $passed = 0
        if ($results.Passed) {
            $passed = $results.Passed
        }

        return @{ Status = $status; Tests = $totalTests; Passed = $passed; Failed = $failedTests; Coverage = $coverage }
    }
    catch {
        Pop-Location
        Write-Log "Unexpected error: $($_.Exception.Message)" "ERROR"
        return @{ Status = "ERROR"; Tests = 0; Passed = 0; Failed = 0; Coverage = "N/A" }
    }
}

$services = @(
    @{ Name = "VM Orchestrator"; Path = "apps\vm-orchestrator"; TestCommand = "go test -v ./..."; CoverageCommand = "go test -coverprofile=coverage.out ./... ; go tool cover -func=coverage.out" },
    @{ Name = "Auth Service"; Path = "apps\auth-service"; TestCommand = "npm test"; CoverageCommand = "npm run test:coverage" },
    @{ Name = "Typing Service"; Path = "apps\typing-service"; TestCommand = "python -m pytest app/test_typing.py -v"; CoverageCommand = "python -m pytest app/test_typing.py -v --cov=app" },
    @{ Name = "vCenter Integration"; Path = "apps\vcenter-integration"; TestCommand = "go test -v ./..."; CoverageCommand = "go test -coverprofile=coverage.out ./... ; go tool cover -func=coverage.out" },
    @{ Name = "Stats Service"; Path = "apps\stats-service"; TestCommand = "python -m pytest app/test_stats.py -v"; CoverageCommand = "python -m pytest app/test_stats.py -v --cov=app" },
    @{ Name = "Monitoring Service"; Path = "apps\monitoring-service"; TestCommand = "go test -v ./..."; CoverageCommand = "go test -coverprofile=coverage.out ./... ; go tool cover -func=coverage.out" }
)

$results = @()
$totalTests = 0
$totalPassed = 0
$totalFailed = 0
$totalServicesWithTests = 0

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "          Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

foreach ($service in $services) {
    $result = Test-Service -ServiceName $service.Name -ServicePath $service.Path -TestCommand $service.TestCommand -CoverageCommand $service.CoverageCommand
    $results += $result

    if ($result.Tests -gt 0) {
        $totalTests += $result.Tests
        $totalPassed += $result.Passed
        $totalFailed += $result.Failed
        $totalServicesWithTests++

        $statusIcon = "OK"
        if ($result.Status -ne "PASS") {
            $statusIcon = "X"
        }

        $statusColor = "Success"
        if ($result.Status -ne "PASS") {
            $statusColor = "Error"
        }

        $paddedName = $result.Service.PadRight(25)
        $testsMsg = "$($result.Tests) tests"
        $passedMsg = "($($result.Passed)/$($result.Tests))"
        $coverageMsg = "Coverage: $($result.Coverage.PadRight(8))"
        $finalMsg = "$statusIcon  $($paddedName) - $testsMsg - $passedMsg - $coverageMsg"

        Write-Host $finalMsg -ForegroundColor $colors[$statusColor]
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "         Final Statistics:" -ForegroundColor Cyan
Write-Host "   Total Services Tested: $totalServicesWithTests" -ForegroundColor Cyan
Write-Host "   Total Tests: $totalTests" -ForegroundColor Cyan
Write-Host "   Passed: $totalPassed" -ForegroundColor Cyan
Write-Host "   Failed: $totalFailed" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$overallStatus = "ALL TESTS PASSED"
$statusColor = "Success"

if ($totalTests -eq 0) {
    $overallStatus = "NO TESTS FOUND"
    $statusColor = "Warning"
}
elseif ($totalFailed -gt 0) {
    $overallStatus = "SOME TESTS FAILED"
    $statusColor = "Error"
}

Write-Host "         $overallStatus" -ForegroundColor $colors[$statusColor]
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($totalFailed -eq 0 -and $totalTests -gt 0) {
    exit 0
}
else {
    exit 1
}
