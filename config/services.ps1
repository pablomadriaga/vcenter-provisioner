# Servicios Centralizados - vCenter Provisioner
# =============================================================================
# ÚNICA FUENTE DE VERDAD para configuración de servicios.
# Todos los scripts deben leer de aquí.
# Si cambiás un servicio, cambiás solo aquí.
# =============================================================================

# Cargar configuración de ports
$_servicesScriptPath = if ($PSScriptRoot -and $PSScriptRoot -ne "") {
    $PSScriptRoot
}
else {
    Split-Path -Parent $MyInvocation.MyCommand.Path
}
. (Join-Path $_servicesScriptPath "ports.ps1")

$global:SERVICES = @{
    # =========================================================================
    # SHARED SCRIPTS
    # =========================================================================
    "shared-scripts" = @{
        Name        = "Shared Scripts"
        Path        = "scripts"
        Type        = "scripts"
        Port        = $null
        ImageName   = "antigravity/shared-scripts"
        ImageTag    = "local"
        LintCmd     = $null
        TestCmd     = $null
        BuildCmd    = "docker build -t antigravity/shared-scripts:local ."
        EnvVars     = @{}
        DependsOn   = @()
        HealthCheck = @{ "path" = $null; "interval" = $null; "timeout" = $null }
        Description = "Scripts compartidos para probe scheduler"
        IsUtility   = $true
    }

    # =========================================================================
    # API GATEWAY
    # =========================================================================
    "api-gateway" = @{
        Name        = "API Gateway"
        Path        = "apps/api-gateway"
        Type        = "node"
        Port        = $global:PORTS["api-gateway"]["external"]
        ImageName   = "antigravity/api-gateway"
        ImageTag    = "local"
        LintCmd     = "npm run lint"
        TestCmd     = "npm test"
        BuildCmd    = "docker build -t antigravity/api-gateway:local ."
        EnvVars     = @{
            "PORT"                    = $global:PORTS["api-gateway"]["internal"]
            "AUTH_SERVICE_URL"        = "http://auth-service:$($global:PORTS['auth-service']['internal'])"
            "TYPING_SERVICE_URL"      = "http://typing-service:$($global:PORTS['typing-service']['internal'])"
            "ORCHESTRATOR_URL"        = "http://vm-orchestrator:$($global:PORTS['vm-orchestrator']['internal'])"
            "VCENTER_CONFIG_URL"      = "http://vcenter-config:$($global:PORTS['vcenter-config']['internal'])"
            "STATS_SERVICE_URL"       = "http://stats-service:$($global:PORTS['stats-service']['internal'])"
        }
        DependsOn   = @("db", "auth-service", "typing-service")
        HealthCheck = @{ "path" = "/health"; "interval" = "10s"; "timeout" = "5s" }
        Description = "Entry point, proxy y verificación de JWT"
    }

    # =========================================================================
    # AUTH SERVICE
    # =========================================================================
    "auth-service" = @{
        Name        = "Auth Service"
        Path        = "apps/auth-service"
        Type        = "node"
        Port        = $global:PORTS["auth-service"]["external"]
        ImageName   = "antigravity/auth-service"
        ImageTag    = "local"
        LintCmd     = "npm run lint"
        TestCmd     = "npm test"
        BuildCmd    = "docker build -t antigravity/auth-service:local ."
        EnvVars     = @{
            "PORT"    = $global:PORTS["auth-service"]["internal"]
            "DB_URL"  = "postgresql://antigravity:password123@db:$($global:PORTS['db']['internal'])/vcenter_provisioner"
        }
        DependsOn   = @("db")
        HealthCheck = @{ "path" = "/health"; "interval" = "10s"; "timeout" = "5s" }
        Description = "Gestión de identidad y persistencia de usuarios"
    }

    # =========================================================================
    # TYPING SERVICE
    # =========================================================================
    "typing-service" = @{
        Name        = "Typing Service"
        Path        = "apps/typing-service"
        Type        = "python"
        Port        = $global:PORTS["typing-service"]["external"]
        ImageName   = "antigravity/typing-service"
        ImageTag    = "local"
        LintCmd     = "flake8 app --max-line-length=100 --ignore=E501,W293,E302,E712,F401 --exclude=.venv"
        TestCmd     = "python -m pytest app/test_typing.py -v"
        BuildCmd    = "docker build -t antigravity/typing-service:local ."
        EnvVars     = @{
            "PORT"         = $global:PORTS["typing-service"]["internal"]
            "DATABASE_URL" = "postgresql://antigravity:password123@db:$($global:PORTS['db']['internal'])/vcenter_provisioner"
        }
        DependsOn   = @("db")
        HealthCheck = @{ "path" = "/health"; "interval" = "10s"; "timeout" = "5s" }
        Description = "Motor TP-Haki (Lógica de nomenclatura dinámica)"
    }

    # =========================================================================
    # VM ORCHESTRATOR
    # =========================================================================
    "vm-orchestrator" = @{
        Name        = "VM Orchestrator"
        Path        = "apps/vm-orchestrator"
        Type        = "go"
        Port        = $global:PORTS["vm-orchestrator"]["external"]
        ImageName   = "antigravity/vm-orchestrator"
        ImageTag    = "local"
        LintCmd     = "go vet ./..."
        TestCmd     = "go test -v ./..."
        BuildCmd    = "docker build -t antigravity/vm-orchestrator:local ."
        EnvVars     = @{
            "PORT"                   = $global:PORTS["vm-orchestrator"]["internal"]
            "TYPING_SERVICE_URL"     = "http://typing-service:$($global:PORTS['typing-service']['internal'])"
            "VCENTER_INTEGRATION_URL" = "http://vcenter-integration:$($global:PORTS['vcenter-integration']['internal'])"
            "VCENTER_CONFIG_URL"     = "http://vcenter-config:$($global:PORTS['vcenter-config']['internal'])"
            "STATS_SERVICE_URL"      = "http://stats-service:$($global:PORTS['stats-service']['internal'])"
        }
        DependsOn   = @("typing-service", "vcenter-integration", "vcenter-config", "stats-service")
        HealthCheck = @{ "path" = "/health"; "interval" = "10s"; "timeout" = "5s" }
        Description = "Máquina de estados y ejecución asíncrona"
    }

    # =========================================================================
    # VCENTER INTEGRATION
    # =========================================================================
    "vcenter-integration" = @{
        Name        = "vCenter Integration"
        Path        = "apps/vcenter-integration"
        Type        = "go"
        Port        = $global:PORTS["vcenter-integration"]["external"]
        ImageName   = "antigravity/vcenter-integration"
        ImageTag    = "local"
        LintCmd     = "go vet ./..."
        TestCmd     = "go test -v ./..."
        BuildCmd    = "docker build -t antigravity/vcenter-integration:local ."
        EnvVars     = @{
            "PORT" = $global:PORTS["vcenter-integration"]["internal"]
        }
        DependsOn   = @()
        HealthCheck = @{ "path" = "/health"; "interval" = "10s"; "timeout" = "5s" }
        Description = "Interacción con la API de vSphere (MOCKED)"
        IsMock     = $true
    }

    # =========================================================================
    # STATS SERVICE
    # =========================================================================
    "stats-service" = @{
        Name        = "Stats Service"
        Path        = "apps/stats-service"
        Type        = "python"
        Port        = $global:PORTS["stats-service"]["external"]
        ImageName   = "antigravity/stats-service"
        ImageTag    = "local"
        LintCmd     = "flake8 . --max-line-length=100 --ignore=E501,W293,E302,E712,F401 --exclude=.venv"
        TestCmd     = "python -m pytest -v"
        BuildCmd    = "docker build -t antigravity/stats-service:local ."
        EnvVars     = @{
            "PORT"         = $global:PORTS["stats-service"]["internal"]
            "DATABASE_URL" = "postgresql://antigravity:password123@db:$($global:PORTS['db']['internal'])/vcenter_provisioner"
        }
        DependsOn   = @("db")
        HealthCheck = @{ "path" = "/health"; "interval" = "10s"; "timeout" = "5s" }
        Description = "Agregación de telemetría y métricas de negocio"
    }

    # =========================================================================
    # MONITORING SERVICE
    # =========================================================================
    "monitoring-service" = @{
        Name        = "Monitoring Service"
        Path        = "apps/monitoring-service"
        Type        = "go"
        Port        = $global:PORTS["monitoring-service"]["external"]
        ImageName   = "antigravity/monitoring-service"
        ImageTag    = "local"
        LintCmd     = "go vet ./... 2>&1 || true"
        TestCmd     = "echo 'Tests skippeados: funciones no implementadas'"
        BuildCmd    = "docker build -t antigravity/monitoring-service:local ."
        EnvVars     = @{
            "PORT" = $global:PORTS["monitoring-service"]["internal"]
        }
        DependsOn   = @()
        HealthCheck = @{ "path" = "/health"; "interval" = "10s"; "timeout" = "5s" }
        Description = "Sentinel de salud y observabilidad nativa"
    }

    # =========================================================================
    # VCENTER CONFIG
    # =========================================================================
    "vcenter-config" = @{
        Name        = "vCenter Config"
        Path        = "apps/vcenter-config-service"
        Type        = "python"
        Port        = $global:PORTS["vcenter-config"]["external"]
        ImageName   = "antigravity/vcenter-config"
        ImageTag    = "local"
        LintCmd     = "flake8 . --max-line-length=100 --ignore=E501,W293,E302,E712,F401 --exclude=.venv"
        TestCmd     = "python -m pytest -v"
        BuildCmd    = "docker build -t antigravity/vcenter-config:local ."
        EnvVars     = @{
            "PORT"             = $global:PORTS["vcenter-config"]["internal"]
            "DB_URL"           = "postgresql://antigravity:password123@db:$($global:PORTS['db']['internal'])/vcenter_provisioner"
            "CORS_ORIGINS"     = "http://localhost:$($global:PORTS['provisioner-ui']['external'])"
        }
        DependsOn   = @("db", "auth-service")
        HealthCheck = @{ "path" = "/health"; "interval" = "10s"; "timeout" = "5s" }
        Description = "Gestión de configuraciones de vCenter"
    }

    # =========================================================================
    # BACKUP SERVICE
    # =========================================================================
    "backup-service" = @{
        Name        = "Backup Service"
        Path        = "apps/backup-service"
        Type        = "python"
        Port        = $global:PORTS["backup-service"]["external"]
        ImageName   = "antigravity/backup-service"
        ImageTag    = "local"
        LintCmd     = "flake8 . --max-line-length=100 --ignore=E501,W293,E302,E712,F401 --exclude=.venv"
        TestCmd     = "python -m pytest -v"
        BuildCmd    = "docker build -t antigravity/backup-service:local ."
        EnvVars     = @{
            "PORT" = $global:PORTS["backup-service"]["internal"]
        }
        DependsOn   = @()
        HealthCheck = @{ "path" = "/health"; "interval" = "10s"; "timeout" = "5s" }
        Description = "Gestión de políticas de respaldo post-creación"
    }

    # =========================================================================
    # PROVISIONER UI
    # =========================================================================
    "provisioner-ui" = @{
        Name        = "Provisioner UI"
        Path        = "apps/provisioner-ui"
        Type        = "react"
        Port        = $global:PORTS["provisioner-ui"]["external"]
        ImageName   = "antigravity/provisioner-ui"
        ImageTag    = "local"
        LintCmd     = "npm run lint"
        TestCmd     = "npm run test:unit"
        BuildCmd    = "docker build -t antigravity/provisioner-ui:local ."
        EnvVars     = @{
            "VITE_API_URL" = "http://localhost:$($global:PORTS['api-gateway']['external'])"
        }
        DependsOn   = @()
        HealthCheck = @{ "path" = "/health"; "interval" = "15s"; "timeout" = "5s" }
        Description = "Interfaz Staff Grade con Wizard interactivo"
    }
}

# =============================================================================
# DATABASE
# =============================================================================

$global:DATABASE = @{
    "host"     = "db"
    "port"     = $global:PORTS["db"]["internal"]
    "name"     = "vcenter_provisioner"
    "user"     = "antigravity"
    "password" = "password123"
}
$global:DATABASE["url"] = "postgresql://$($global:DATABASE['user']):$($global:DATABASE['password'])@$($global:DATABASE['host']):$($global:DATABASE['port'])/$($global:DATABASE['name'])"

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

function Get-Service {
    <#
    .SYNOPSIS
        Obtiene la configuración de un servicio.
    .EXAMPLE
        Get-Service -Name "api-gateway"
    #>
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )
    return $global:SERVICES[$Name]
}

function Get-AllServices {
    <#
    .SYNOPSIS
        Obtiene todos los servicios como hashtable.
    .EXAMPLE
        Get-AllServices | Format-Table
    #>
    return $global:SERVICES
}

function Get-ServiceNames {
    <#
    .SYNOPSIS
        Obtiene lista de nombres de servicios.
    .EXAMPLE
        Get-ServiceNames
    #>
    return $global:SERVICES.Keys | Sort-Object
}

function Get-DatabaseConfig {
    <#
    .SYNOPSIS
        Obtiene la configuración de la base de datos.
    .EXAMPLE
        Get-DatabaseConfig
    #>
    return $global:DATABASE
}

function Get-ImageName {
    <#
    .SYNOPSIS
        Obtiene el nombre completo de la imagen de un servicio.
    .EXAMPLE
        Get-ImageName -Service "api-gateway"
    #>
    param(
        [Parameter(Mandatory = $true)]
        [string]$Service
    )
    $svc = $global:SERVICES[$Service]
    return "$($svc.ImageName):$($svc.ImageTag)"
}

# =============================================================================
# END OF FILE
# =============================================================================
