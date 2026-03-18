"""
Orquestador de tests.
Ejecuta tests en diferentes modos: host, docker, hybrid.
"""

import subprocess
import logging
from typing import Any

from agents.base import Agent, AgentResult
from agents.config import get_suites


logger = logging.getLogger(__name__)


class TestRunner(Agent):
    """Agente para ejecutar suites de tests.
    
    Soporta tres modos de ejecución:
    - host: Ejecuta tests directamente en el host
    - docker: Ejecuta tests dentro de contenedores Docker
    - hybrid: Ejecuta ambos modos
    """
    
    VALID_MODES = ("host", "docker", "hybrid")
    
    def __init__(self, config: dict[str, Any] | None = None):
        super().__init__(config)
        self.mode = self.config.get("mode", "hybrid")
        self.parallel = self.config.get("parallel", False)
    
    def validate(self) -> bool:
        """Validar prerrequisitos.
        
        Returns:
            True si puede ejecutar tests
        """
        # Verificar modo válido
        if self.mode not in self.VALID_MODES:
            logger.warning(f"Invalid mode: {self.mode}")
            return False
        
        # Verificar que hay suites configuradas
        try:
            suites = get_suites()
            if not suites:
                logger.warning("No test suites configured")
                return False
        except Exception as e:
            logger.error(f"Failed to load suites: {e}")
            return False
        
        return True
    
    def run(self, **kwargs) -> AgentResult:
        """Ejecutar tests según el modo configurado.
        
        Args:
            **kwargs: Argumentos adicionales
                - mode: Override del modo de ejecución
                - suites: Lista de suites específicas a ejecutar
                
        Returns:
            AgentResult con el resultado de los tests
        """
        mode = kwargs.get("mode", self.mode)
        specific_suites = kwargs.get("suites", None)
        
        logger.info(f"Running tests in mode: {mode}")
        
        if mode == "host":
            return self._run_host(specific_suites)
        elif mode == "docker":
            return self._run_docker(specific_suites)
        elif mode == "hybrid":
            return self._run_hybrid(specific_suites)
        else:
            return AgentResult(
                agent=self.name,
                status="failure",
                message=f"Unknown mode: {mode}"
            )
    
    def _run_host(self, specific_suites: list[str] | None = None) -> AgentResult:
        """Ejecutar tests en el host.
        
        Args:
            specific_suites: Nombres de suites específicas a ejecutar
            
        Returns:
            Resultado de los tests
        """
        logger.info("Running tests on host")
        
        suites = get_suites()
        
        if specific_suites:
            suites = [s for s in suites if s.get("name") in specific_suites]
        
        results: list[dict[str, Any]] = []
        total_passed = 0
        total_failed = 0
        total_tests = 0
        errors: list[dict[str, Any]] = []
        
        for suite in suites:
            suite_name = suite.get("name", "unknown")
            suite_path = suite.get("path", "")
            command = suite.get("command", "")
            
            logger.info(f"Running suite: {suite_name}")
            
            try:
                # Cambiar al directorio del proyecto y ejecutar
                result = subprocess.run(
                    command,
                    shell=True,
                    cwd=suite_path,
                    capture_output=True,
                    text=True,
                    timeout=120
                )
                
                # Parsear resultado básico
                if result.returncode == 0:
                    total_passed += 1
                    status = "passed"
                else:
                    total_failed += 1
                    status = "failed"
                    errors.append({
                        "suite": suite_name,
                        "message": result.stderr[:500] if result.stderr else "Unknown error"
                    })
                
                total_tests += 1
                results.append({
                    "suite": suite_name,
                    "status": status,
                    "output": result.stdout[:500] if result.stdout else ""
                })
                
            except subprocess.TimeoutExpired:
                total_failed += 1
                errors.append({
                    "suite": suite_name,
                    "message": "Test timeout (>120s)"
                })
                results.append({
                    "suite": suite_name,
                    "status": "timeout"
                })
                
            except Exception as e:
                total_failed += 1
                errors.append({
                    "suite": suite_name,
                    "message": str(e)
                })
                results.append({
                    "suite": suite_name,
                    "status": "error",
                    "error": str(e)
                })
        
        status = "success" if total_failed == 0 else "failure"
        message = f"Tests completed: {total_passed} passed, {total_failed} failed"
        
        return AgentResult(
            agent=self.name,
            status=status,
            message=message,
            data={
                "mode": "host",
                "total": total_tests,
                "passed": total_passed,
                "failed": total_failed,
                "suites": results
            },
            errors=errors
        )
    
    def _run_docker(self, specific_suites: list[str] | None = None) -> AgentResult:
        """Ejecutar tests en contenedores Docker.
        
        Args:
            specific_suites: Nombres de suites específicas a ejecutar
            
        Returns:
            Resultado de los tests
        """
        logger.info("Running tests in Docker")
        
        # Por implementar: ejecutar tests dentro de Docker
        # Por ahora, retornamos un resultado de "no implementado"
        
        return AgentResult(
            agent=self.name,
            status="skipped",
            message="Docker mode not yet implemented",
            data={
                "mode": "docker",
                "note": "Use --mode=host for now"
            }
        )
    
    def _run_hybrid(self, specific_suites: list[str] | None = None) -> AgentResult:
        """Ejecutar tests en modo híbrido (host + docker).
        
        Args:
            specific_suites: Nombres de suites específicas a ejecutar
            
        Returns:
            Resultado combinado de ambos modos
        """
        logger.info("Running tests in hybrid mode")
        
        # Ejecutar en host
        host_result = self._run_host(specific_suites)
        
        # Por ahora solo host está implementado
        # En el futuro, también ejecutaríamos docker
        
        return host_result
