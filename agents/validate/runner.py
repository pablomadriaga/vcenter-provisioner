"""
Agente de validación de prerrequisitos.
Verifica que Docker y herramientas estén disponibles.
"""

import shutil
import logging
from typing import Any
from pathlib import Path

from agents.base import Agent, AgentResult, print_header, print_step, print_success, print_error
from agents.docker import get_docker


logger = logging.getLogger(__name__)


class ValidateRunner(Agent):
    """Agente para validar prerrequisitos.
    
    Verifica:
    - Docker instalado y corriendo
    - Herramientas requeridas disponibles
    - Archivos de configuración válidos
    """
    
    REQUIRED_TOOLS = ["docker", "docker-compose", "git", "jq"]
    
    def __init__(self, config: dict[str, Any] | None = None):
        super().__init__(config)
    
    def validate(self) -> bool:
        """Validar que el agente puede ejecutarse.
        
        Returns:
            True
        """
        return True
    
    def run(self, **kwargs) -> AgentResult:
        """Ejecutar validación de prerrequisitos.
        
        Returns:
            AgentResult con el resultado
        """
        print_header("Validating Prerequisites")
        
        errors = []
        warnings = []
        
        # 1. Verificar Docker
        print_step("Docker", "checking...")
        try:
            docker = get_docker()
            print_success("Docker is available")
        except Exception as e:
            errors.append(f"Docker not available: {e}")
            print_error(f"Docker not available: {e}")
        
        # 2. Verificar herramientas requeridas
        print_step("Required tools", "checking...")
        for tool in self.REQUIRED_TOOLS:
            path = shutil.which(tool)
            if path:
                print_success(f"{tool}: {path}")
            else:
                warnings.append(f"Tool not found: {tool}")
                print_error(f"{tool}: not found")
        
        # 3. Verificar archivos de configuración
        print_step("Config files", "checking...")
        config_dir = Path("config")
        required_files = ["test-manifest.json", "ports.json", "services.json"]
        
        for file in required_files:
            path = config_dir / file
            if path.exists():
                print_success(f"{file}: found")
            else:
                errors.append(f"Config file not found: {file}")
                print_error(f"{file}: not found")
        
        # 4. Verificar docker-compose
        print_step("Docker Compose", "checking...")
        compose_file = Path("infra/local/docker-compose.yml")
        if compose_file.exists():
            print_success("docker-compose.yml found")
        else:
            errors.append("docker-compose.yml not found")
            print_error("docker-compose.yml not found")
        
        # Resultado
        if errors:
            return AgentResult(
                agent=self.name,
                status="failure",
                message=f"Validation failed with {len(errors)} errors",
                data={
                    "errors": errors,
                    "warnings": warnings
                }
            )
        elif warnings:
            return AgentResult(
                agent=self.name,
                status="success",
                message=f"Validation passed with {len(warnings)} warnings",
                data={
                    "errors": [],
                    "warnings": warnings
                }
            )
        else:
            return AgentResult(
                agent=self.name,
                status="success",
                message="All prerequisites validated",
                data={
                    "errors": [],
                    "warnings": []
                }
            )
