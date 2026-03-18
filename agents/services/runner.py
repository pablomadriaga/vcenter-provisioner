"""
Agente de servicios (up/down/status).
Gestión de contenedores Docker con Rich UI.
"""

import asyncio
import logging
from pathlib import Path
from typing import Any

from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from agents.base import Agent, AgentResult, print_header, print_step, print_success, print_error, print_warning
from agents.config import get_config_loader
from agents.http import check_services_health
from agents.docker import get_docker


logger = logging.getLogger(__name__)
console = Console()


class ServicesRunner(Agent):
    """Agente para gestionar servicios Docker.
    
    Comandos:
    - up: Levantar servicios
    - down: Bajar servicios
    - status: Ver estado de servicios
    """
    
    # Puerto de los servicios
    DEFAULT_PORTS = {
        "api-gateway": 3000,
        "auth-service": 3001,
        "typing-service": 8000,
        "vm-orchestrator": 8080,
        "vcenter-integration": 8081,
        "vcenter-config-service": 8082,
        "stats-service": 8001,
        "monitoring-service": 8082,
        "backup-service": 8002,
        "provisioner-ui": 5173,
    }
    
    def __init__(self, config: dict[str, Any] | None = None):
        super().__init__(config)
        self.action = self.config.get("action", "status")  # up, down, status
        self.services = self.config.get("services", None)
        self.detach = self.config.get("detach", True)
    
    def validate(self) -> bool:
        """Validar prerrequisitos.
        
        Returns:
            True si Docker está disponible
        """
        try:
            docker = get_docker()
            self.console.print("[success]Docker connected[/success]")
            return True
        except Exception as e:
            self.console.print(f"[error]Docker not available: {e}[/error]")
            return False
    
    def run(self, **kwargs) -> AgentResult:
        """Ejecutar acción sobre servicios.
        
        Args:
            **kwargs: Argumentos adicionales
                - action: up, down, status
                
        Returns:
            AgentResult con el resultado
        """
        action = kwargs.get("action", self.action)
        
        if action == "up":
            return self._up()
        elif action == "down":
            return self._down()
        elif action == "status":
            return self._status()
        else:
            return AgentResult(
                agent=self.name,
                status="failure",
                message=f"Unknown action: {action}"
            )
    
    def _up(self) -> AgentResult:
        """Levantar servicios con docker-compose."""
        print_header("Starting Services")
        
        try:
            config_loader = get_config_loader()
            compose_file = Path("infra/local/docker-compose.yml")
            
            if not compose_file.exists():
                return AgentResult(
                    agent=self.name,
                    status="failure",
                    message="docker-compose.yml not found"
                )
            
            self.console.print("[info]Starting services with docker-compose...[/info]")
            
            # Usar docker-compose
            import subprocess
            result = subprocess.run(
                ["docker-compose", "-f", str(compose_file), "up", "-d"],
                capture_output=True,
                text=True,
                cwd=compose_file.parent
            )
            
            if result.returncode == 0:
                print_success("Services started")
                return AgentResult(
                    agent=self.name,
                    status="success",
                    message="Services started successfully",
                    data={"output": result.stdout}
                )
            else:
                print_error(f"Failed to start services: {result.stderr}")
                return AgentResult(
                    agent=self.name,
                    status="failure",
                    message=f"Failed to start services: {result.stderr}"
                )
                
        except Exception as e:
            return AgentResult(
                agent=self.name,
                status="failure",
                message=str(e)
            )
    
    def _down(self) -> AgentResult:
        """Bajar servicios con docker-compose."""
        print_header("Stopping Services")
        
        try:
            compose_file = Path("infra/local/docker-compose.yml")
            
            if not compose_file.exists():
                return AgentResult(
                    agent=self.name,
                    status="failure",
                    message="docker-compose.yml not found"
                )
            
            self.console.print("[info]Stopping services with docker-compose...[/info]")
            
            import subprocess
            result = subprocess.run(
                ["docker-compose", "-f", str(compose_file), "down"],
                capture_output=True,
                text=True,
                cwd=compose_file.parent
            )
            
            if result.returncode == 0:
                print_success("Services stopped")
                return AgentResult(
                    agent=self.name,
                    status="success",
                    message="Services stopped successfully",
                    data={"output": result.stdout}
                )
            else:
                print_error(f"Failed to stop services: {result.stderr}")
                return AgentResult(
                    agent=self.name,
                    status="failure",
                    message=f"Failed to stop services: {result.stderr}"
                )
                
        except Exception as e:
            return AgentResult(
                agent=self.name,
                status="failure",
                message=str(e)
            )
    
    def _status(self) -> AgentResult:
        """Mostrar estado de servicios."""
        print_header("Services Status")
        
        try:
            docker = get_docker()
            
            # Obtener contenedores
            containers = docker.list_containers()
            
            if not containers:
                print_warning("No containers running")
                return AgentResult(
                    agent=self.name,
                    status="success",
                    message="No services running",
                    data={"containers": []}
                )
            
            # Crear tabla
            table = Table(title="Running Containers")
            table.add_column("Name", style="cyan")
            table.add_column("Image", style="blue")
            table.add_column("Status", style="green")
            table.add_column("Ports", style="yellow")
            
            container_data = []
            
            for container in containers:
                # Obtener nombre sin prefijo
                name = container.name
                image = container.image.tags[0] if container.image.tags else container.image.short_id
                status = container.status
                
                # Puertos
                ports = []
                if container.ports:
                    for port, bindings in container.ports.items():
                        if bindings:
                            for binding in bindings:
                                ports.append(f"{binding['HostPort']}->{port}")
                
                ports_str = ", ".join(ports) if ports else "-"
                
                table.add_row(name, image, status, ports_str)
                
                container_data.append({
                    "name": name,
                    "image": image,
                    "status": status,
                    "ports": ports
                })
            
            console.print(table)
            
            # Health checks
            self.console.print("\n[bold]Health Checks:[/bold]")
            
            running_services = {
                svc: f"http://localhost:{port}/health"
                for svc, port in self.DEFAULT_PORTS.items()
            }
            
            health_results = asyncio.run(
                check_services_health(running_services)
            )
            
            health_table = Table()
            health_table.add_column("Service", style="cyan")
            health_table.add_column("Status", style="green")
            health_table.add_column("Response Time", style="yellow")
            
            for result in health_results:
                status_icon = "✓" if result["status"] == "healthy" else "✗"
                status_style = "green" if result["status"] == "healthy" else "red"
                response_time = f"{result['response_time']:.0f}ms" if result.get("response_time") else "-"
                
                health_table.add_row(
                    result["service"],
                    f"[{status_style}]{status_icon} {result['status']}[/{status_style}]",
                    response_time
                )
            
            console.print(health_table)
            
            return AgentResult(
                agent=self.name,
                status="success",
                message=f"{len(containers)} containers running",
                data={
                    "containers": container_data,
                    "health_checks": health_results
                }
            )
            
        except Exception as e:
            return AgentResult(
                agent=self.name,
                status="failure",
                message=str(e)
            )
