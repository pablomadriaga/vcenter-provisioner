"""
Agente de tests con health checks paralelos.
Ejecuta tests en diferentes modos: host, docker, hybrid.
"""

import asyncio
import subprocess
import logging
from typing import Any

from agents.base import Agent, AgentResult, print_header, print_step
from agents.config import get_suites, get_config_loader
from agents.http import check_services_health


logger = logging.getLogger(__name__)


class TestRunner(Agent):
    """Agente para ejecutar suites de tests.
    
    Soporta tres modos de ejecución:
    - host: Ejecuta tests directamente en el host
    - docker: Ejecuta tests dentro de contenedores Docker
    - hybrid: Ejecuta ambos modos
    """
    
    VALID_MODES = ("host", "docker", "hybrid")
    
    # Puerto de los servicios para health checks
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
        self.mode = self.config.get("mode", "hybrid")
        self.parallel = self.config.get("parallel", False)
        self.services = self.config.get("services", None)
    
    def validate(self) -> bool:
        """Validar prerrequisitos.
        
        Returns:
            True si puede ejecutar tests
        """
        # Verificar modo válido
        if self.mode not in self.VALID_MODES:
            self.console.print(f"[warning]Invalid mode: {self.mode}[/warning]")
            return False
        
        # Verificar que hay suites configuradas
        try:
            suites = get_suites()
            if not suites:
                self.console.print("[warning]No test suites configured[/warning]")
                return False
        except Exception as e:
            self.console.print(f"[error]Failed to load suites: {e}[/error]")
            return False
        
        return True
    
    def run(self, **kwargs) -> AgentResult:
        """Ejecutar tests según el modo configurado.
        
        Args:
            **kwargs: Argumentos adicionales
                - mode: Override del modo de ejecución
                - services: Lista de servicios específicos a ejecutar
                
        Returns:
            AgentResult con el resultado de los tests
        """
        mode = kwargs.get("mode", self.mode)
        specific_services = kwargs.get("services", self.services)
        
        self.console.print(f"[info]Running tests in mode:[/info] {mode}")
        
        if mode == "host":
            return self._run_host(specific_services)
        elif mode == "docker":
            return self._run_docker(specific_services)
        elif mode == "hybrid":
            return self._run_hybrid(specific_services)
        else:
            return AgentResult(
                agent=self.name,
                status="failure",
                message=f"Unknown mode: {mode}"
            )
    
    async def _health_check_async(self, services: list[str] | None = None) -> list[dict]:
        """Realizar health checks en paralelo (async).
        
        Args:
            services: Lista de servicios a verificar (None = todos)
            
        Returns:
            Lista de resultados de health check
        """
        if services is None:
            services = list(self.DEFAULT_PORTS.keys())
        
        # Construir diccionario de servicios
        service_urls = {
            svc: f"http://localhost:{self.DEFAULT_PORTS.get(svc, 8080)}/health"
            for svc in services
            if svc in self.DEFAULT_PORTS
        }
        
        if not service_urls:
            return []
        
        self.console.print(f"[info]Running health checks for {len(service_urls)} services...[/info]")
        
        results = await check_services_health(service_urls)
        
        # Imprimir resultados
        for result in results:
            if result["status"] == "healthy":
                self.console.print(
                    f"  [success]✓[/success] {result['service']}: "
                    f"{result['response_time']:.0f}ms"
                )
            else:
                self.console.print(
                    f"  [error]✗[/error] {result['service']}: "
                    f"{result.get('error', 'unhealthy')}"
                )
        
        return results
    
    def _run_host(self, specific_services: list[str] | None = None) -> AgentResult:
        """Ejecutar tests en el host.
        
        Args:
            specific_services: Nombres de servicios específicos a ejecutar
            
        Returns:
            Resultado de los tests
        """
        print_header("Running Tests on Host")
        
        suites = get_suites()
        
        if specific_services:
            suites = [s for s in suites if s.get("name") in specific_services]
        
        if not suites:
            return AgentResult(
                agent=self.name,
                status="failure",
                message="No suites to run"
            )
        
        results: list[dict[str, Any]] = []
        total_passed = 0
        total_failed = 0
        errors: list[dict[str, Any]] = []
        
        for suite in suites:
            suite_name = suite.get("name", "unknown")
            suite_path = suite.get("path", "")
            command = suite.get("command", "")
            
            print_step(f"Suite", f"{suite_name}")
            
            try:
                result = subprocess.run(
                    command,
                    shell=True,
                    cwd=suite_path,
                    capture_output=True,
                    text=True,
                    timeout=120
                )
                
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
                "total": total_passed + total_failed,
                "passed": total_passed,
                "failed": total_failed,
                "suites": results
            },
            errors=errors
        )
    
    def _run_docker(self, specific_services: list[str] | None = None) -> AgentResult:
        """Ejecutar tests en contenedores Docker.
        
        Args:
            specific_services: Nombres de servicios específicos
            
        Returns:
            Resultado de los tests
        """
        print_header("Running Tests in Docker")
        
        # Por implementar: ejecutar tests dentro de Docker
        return AgentResult(
            agent=self.name,
            status="skipped",
            message="Docker mode not yet implemented",
            data={
                "mode": "docker",
                "note": "Use --mode=host for now"
            }
        )
    
    def _run_hybrid(self, specific_services: list[str] | None = None) -> AgentResult:
        """Ejecutar tests en modo híbrido.
        
        Args:
            specific_services: Nombres de servicios específicos
            
        Returns:
            Resultado combinado
        """
        print_header("Running Tests (Hybrid Mode)")
        
        # 1. Health checks paralelos primero
        health_results = asyncio.run(self._health_check_async(specific_services))
        
        # 2. Ejecutar tests en host
        test_result = self._run_host(specific_services)
        
        # Combinar resultados
        return AgentResult(
            agent=self.name,
            status=test_result.status,
            message=test_result.message,
            data={
                "mode": "hybrid",
                "health_checks": health_results,
                "tests": test_result.data
            },
            errors=test_result.errors + [
                {"service": r["service"], "error": r.get("error")}
                for r in health_results if r["status"] != "healthy"
            ]
        )
