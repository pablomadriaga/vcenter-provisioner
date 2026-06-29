"""
Agente de build con Docker SDK y ThreadPool.
Build paralelo de imágenes Docker.
"""

import hashlib
import logging
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn, TimeRemainingColumn

from agents.base import Agent, AgentResult, print_header, print_step, print_success, print_error
from agents.config import get_config_loader
from agents.docker import get_docker


logger = logging.getLogger(__name__)


class BuildRunner(Agent):
    """Agente para construir imágenes Docker.
    
    Características:
    - Build paralelo con ThreadPoolExecutor
    - Smart cache con hash determinista
    - Progress bars con Rich
    """
    
    def __init__(self, config: dict[str, Any] | None = None):
        super().__init__(config)
        self.force = self.config.get("force", False)
        self.services = self.config.get("services", None)
        self.parallel_workers = self.config.get("parallel_workers", 4)
    
    def validate(self) -> bool:
        """Validar prerrequisitos.
        
        Returns:
            True si puede ejecutar build
        """
        try:
            docker = get_docker()
            self.console.print("[success]Docker connected[/success]")
            return True
        except Exception as e:
            self.console.print(f"[error]Docker not available: {e}[/error]")
            return False
    
    def _calculate_hash(self, path: Path) -> str:
        """Calcular hash de un directorio.
        
        Args:
            path: Ruta al directorio
            
        Returns:
            Hash SHA256
        """
        hasher = hashlib.sha256()
        
        # Hash del Dockerfile
        dockerfile = path / "Dockerfile"
        if dockerfile.exists():
            hasher.update(dockerfile.read_bytes())
        
        # Hash de archivos relevantes
        for pattern in ["*.py", "*.ts", "*.js", "*.go", "requirements.txt", "package.json", "go.mod"]:
            for file in path.glob(pattern):
                hasher.update(file.read_bytes())
        
        return hasher.hexdigest()[:12]
    
    def _build_single(self, service: dict[str, Any]) -> dict[str, Any]:
        """Build de un solo servicio.
        
        Args:
            service: Configuración del servicio
            
        Returns:
            Resultado del build
        """
        name = service.get("name", "unknown")
        path = service.get("path", "")
        
        self.console.print(f"[info]Building {name}...[/info]")
        
        try:
            docker = get_docker()
            service_path = Path(path)
            
            # Calcular hash
            image_hash = self._calculate_hash(service_path)
            image_tag = f"provisioner-{name}:{image_hash}"
            
            # Verificar si ya existe (skip cache)
            if not self.force and docker.image_exists(image_tag):
                return {
                    "service": name,
                    "status": "cached",
                    "image": image_tag,
                    "message": "Image already exists (use --force to rebuild)"
                }
            
            # Build de la imagen
            image, logs = docker.build_image(
                path=str(service_path),
                tag=image_tag,
                rm=True,
            )
            
            return {
                "service": name,
                "status": "success",
                "image": image_tag,
                "message": f"Built {image_tag}"
            }
            
        except Exception as e:
            return {
                "service": name,
                "status": "failed",
                "image": None,
                "error": str(e)
            }
    
    def run(self, **kwargs) -> AgentResult:
        """Ejecutar build de imágenes.
        
        Args:
            **kwargs: Argumentos adicionales
                - force: Forzar rebuild
                - services: Lista de servicios específicos
                
        Returns:
            AgentResult con el resultado
        """
        force = kwargs.get("force", self.force)
        specific_services = kwargs.get("services", self.services)
        
        print_header("Building Docker Images")
        
        # Cargar configuración
        try:
            config_loader = get_config_loader()
            services_config = config_loader.load("services.json")
            services = services_config.get("services", {})
            
            # Convertir a lista
            services_list = [
                {"name": name, "path": info.get("path", f"apps/{name}")}
                for name, info in services.items()
            ]
            
            if specific_services:
                services_list = [s for s in services_list if s["name"] in specific_services]
                
        except Exception as e:
            return AgentResult(
                agent=self.name,
                status="failure",
                message=f"Failed to load services config: {e}"
            )
        
        if not services_list:
            return AgentResult(
                agent=self.name,
                status="failure",
                message="No services to build"
            )
        
        self.console.print(f"[info]Building {len(services_list)} services with {self.parallel_workers} workers[/info]\n")
        
        # Build paralelo
        results = []
        successful = 0
        failed = 0
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[bold blue]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            TimeRemainingColumn(),
        ) as progress:
            
            task = progress.add_task("[cyan]Building images...", total=len(services_list))
            
            with ThreadPoolExecutor(max_workers=self.parallel_workers) as executor:
                futures = {
                    executor.submit(self._build_single, service): service
                    for service in services_list
                }
                
                for future in as_completed(futures):
                    result = future.result()
                    results.append(result)
                    
                    if result["status"] == "success":
                        successful += 1
                        print_success(f"{result['service']}: {result['image']}")
                    elif result["status"] == "cached":
                        successful += 1
                        self.console.print(f"  [dim]⊘[/dim] {result['service']}: {result['message']}")
                    else:
                        failed += 1
                        print_error(f"{result['service']}: {result.get('error', 'failed')}")
                    
                    progress.update(task, advance=1)
        
        status = "success" if failed == 0 else "failure"
        message = f"Build completed: {successful} successful, {failed} failed"
        
        return AgentResult(
            agent=self.name,
            status=status,
            message=message,
            data={
                "total": len(services_list),
                "successful": successful,
                "failed": failed,
                "force": force,
                "results": results
            }
        )
