# Puertos Centralizados - vCenter Provisioner
# =============================================================================
# ÚNICA FUENTE DE VERDAD para ports del sistema.
# Todos los scripts deben leer de aquí.
# Si cambiás un port, cambiás solo aquí.
# =============================================================================

$global:PORTS = @{
    # =========================================================================
    # INFRASTRUCTURE
    # =========================================================================
    "db" = @{
        "internal" = 5432
        "external" = 5432
        "protocol" = "tcp"
        "description" = "PostgreSQL database"
    }

    # =========================================================================
    # CORE SERVICES
    # =========================================================================
    "api-gateway" = @{
        "internal" = 3000
        "external" = 3000
        "protocol" = "tcp"
        "description" = "API Gateway - Entry point"
    }

    "auth-service" = @{
        "internal" = 3001
        "external" = 3001
        "protocol" = "tcp"
        "description" = "Authentication service"
    }

    "typing-service" = @{
        "internal" = 8000
        "external" = 8000
        "protocol" = "tcp"
        "description" = "VM naming/typification service"
    }

    "vm-orchestrator" = @{
        "internal" = 8080
        "external" = 8080
        "protocol" = "tcp"
        "description" = "VM orchestration state machine"
    }

    "vcenter-integration" = @{
        "internal" = 8081
        "external" = 8081
        "protocol" = "tcp"
        "description" = "vCenter API adapter (MOCKED)"
    }

    "vcenter-config" = @{
        "internal" = 8082
        "external" = 8084
        "protocol" = "tcp"
        "description" = "vCenter configuration service"
    }

    "stats-service" = @{
        "internal" = 8001
        "external" = 8001
        "protocol" = "tcp"
        "description" = "Telemetry and metrics aggregation"
    }

    "monitoring-service" = @{
        "internal" = 8082
        "external" = 8083
        "protocol" = "tcp"
        "description" = "Health checks and observability"
    }

    "backup-service" = @{
        "internal" = 8002
        "external" = 8002
        "protocol" = "tcp"
        "description" = "Backup policies management"
    }

    "provisioner-ui" = @{
        "internal" = 80
        "external" = 5173
        "protocol" = "tcp"
        "description" = "React frontend UI"
    }
}

# =============================================================================
# PUERTOS SPECIALES
# =============================================================================

$global:SPECIAL_PORTS = @{
    "health" = @{
        "path" = "/health"
        "description" = "Health check endpoint"
    }
}

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

function Get-Port {
    <#
    .SYNOPSIS
        Obtiene el puerto interno de un servicio.
    .EXAMPLE
        Get-Port -Service "api-gateway"
    #>
    param(
        [Parameter(Mandatory = $true)]
        [string]$Service
    )
    return $global:PORTS[$Service]["internal"]
}

function Get-PortExternal {
    <#
    .SYNOPSIS
        Obtiene el puerto externo (host) de un servicio.
    .EXAMPLE
        Get-PortExternal -Service "api-gateway"
    #>
    param(
        [Parameter(Mandatory = $true)]
        [string]$Service
    )
    return $global:PORTS[$Service]["external"]
}

function Get-AllPorts {
    <#
    .SYNOPSIS
        Obtiene todos los puertos como hashtable.
    .EXAMPLE
        Get-AllPorts | Format-Table
    #>
    return $global:PORTS
}

function Get-ServiceByPort {
    <#
    .SYNOPSIS
        Obtiene el servicio que usa un puerto específico.
    .EXAMPLE
        Get-ServiceByPort -Port 3000
    #>
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port
    )
    foreach ($service in $global:PORTS.Keys) {
        if ($global:PORTS[$Service]["internal"] -eq $Port -or
            $global:PORTS[$Service]["external"] -eq $Port) {
            return $service
        }
    }
    return $null
}

function Test-PortAvailable {
    <#
    .SYNOPSIS
        Verifica si un puerto está disponible en el host.
    .EXAMPLE
        Test-PortAvailable -Port 3000
    #>
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port
    )
    $listener = New-Object System.Net.Sockets.TcpListener
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

# =============================================================================
# END OF FILE
# =============================================================================
