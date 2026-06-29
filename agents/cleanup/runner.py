"""
Agente de cleanup.
Limpia recursos Docker (contenedores, redes, volúmenes, imágenes).
"""

import logging
from typing import Any
from pathlib import Path
from rich.console import Console
from rich.table import Table

from agents.base import Agent, AgentResult, print_header, print_step, print_success, print_error, print_warning
from agents.docker import get_docker


logger = logging.getLogger(__name__)
console = Console()


class CleanupRunner(Agent):
    """Agente para limpiar recursos Docker.
    
    Opciones:
    - containers: Eliminar contenedores
    - networks: Eliminar redes huérfanas
    - volumes: Eliminar volúmenes (peligroso)
    - images: Eliminar imágenes huérfanas
    """
    
    def __init__(self, config: dict[str, Any] | None = None):
        super().__init__(config)
        self.full = self.config.get("full", False)
        self.containers = self.config.get("containers", True)
        self.networks = self.config.get("networks", True)
        self.volumes = self.config.get("volumes", self.full)
        self.images = self.config.get("images", self.full)
        self.force = self.config.get("force", False)
    
    def validate(self) -> bool:
        """Validar prerrequisitos.
        
        Returns:
            True si Docker está disponible
        """
        try:
            docker = get_docker()
            return True
        except Exception:
            return False
    
    def run(self, **kwargs) -> AgentResult:
        """Ejecutar limpieza de recursos.
        
        Returns:
            AgentResult con el resultado
        """
        print_header("Cleaning Up Docker Resources")
        
        docker = get_docker()
        
        removed = {
            "containers": 0,
            "networks": 0,
            "volumes": 0,
            "images": 0
        }
        
        errors = []
        
        # 1. Contenedores
        if self.containers:
            print_step("Containers", "cleaning...")
            try:
                containers = docker.list_containers(all=True)
                for container in containers:
                    if container.status != "running":
                        docker.remove_container(container.id, force=self.force)
                        removed["containers"] += 1
                print_success(f"Removed {removed['containers']} containers")
            except Exception as e:
                errors.append(f"Failed to remove containers: {e}")
                print_error(f"Failed: {e}")
        
        # 2. Redes
        if self.networks:
            print_step("Networks", "cleaning...")
            try:
                networks = docker.list_networks()
                for network in networks:
                    # No eliminar redes predeterminadas
                    if network.name not in ["bridge", "host", "none"]:
                        try:
                            docker.remove_network(network.id)
                            removed["networks"] += 1
                        except Exception:
                            pass
                print_success(f"Removed {removed['networks']} networks")
            except Exception as e:
                errors.append(f"Failed to remove networks: {e}")
                print_error(f"Failed: {e}")
        
        # 3. Volúmenes
        if self.volumes:
            print_step("Volumes", "cleaning...")
            try:
                volumes = docker.list_volumes()
                for volume in volumes:
                    try:
                        docker.remove_volume(volume.name, force=self.force)
                        removed["volumes"] += 1
                    except Exception:
                        pass
                print_success(f"Removed {removed['volumes']} volumes")
            except Exception as e:
                errors.append(f"Failed to remove volumes: {e}")
                print_error(f"Failed: {e}")
        
        # 4. Imágenes huérfanas
        if self.images:
            print_step("Orphaned images", "cleaning...")
            try:
                images = docker.list_images(filters={"dangling": True})
                for image in images:
                    try:
                        docker.remove_image(image.id, force=self.force)
                        removed["images"] += 1
                    except Exception:
                        pass
                print_success(f"Removed {removed['images']} images")
            except Exception as e:
                errors.append(f"Failed to remove images: {e}")
                print_error(f"Failed: {e}")
        
        # Resumen
        total_removed = sum(removed.values())
        
        if errors:
            return AgentResult(
                agent=self.name,
                status="failure",
                message=f"Cleanup completed with {len(errors)} errors",
                data={"removed": removed, "errors": errors}
            )
        else:
            return AgentResult(
                agent=self.name,
                status="success",
                message=f"Cleaned up {total_removed} resources",
                data={"removed": removed}
            )
