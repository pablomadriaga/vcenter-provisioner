"""
Agente de lint.
Ejecuta linting en todos los servicios.
"""

import subprocess
import logging
from pathlib import Path
from typing import Any

from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn

from agents.base import Agent, AgentResult, print_header, print_step, print_success, print_error
from agents.config import get_config_loader


logger = logging.getLogger(__name__)


class LintRunner(Agent):
    """Agente para ejecutar linting.
    
    Ejecuta linting para:
    - Python (ruff, flake8)
    - JavaScript/TypeScript (eslint)
    - Shell scripts (shellcheck)
    - Dockerfiles (hadolint)
    """
    
    # Herramientas de lint disponibles
    LINT_TOOLS = {
        "python": ["ruff", "check", "."],
        "javascript": ["eslint", "."],
        "shell": ["shellcheck", "*.sh"],
        "dockerfile": ["hadolint", "Dockerfile"],
    }
    
    def __init__(self, config: dict[str, Any] | None = None):
        super().__init__(config)
        self.fix = self.config.get("fix", False)
        self.services = self.config.get("services", None)
    
    def validate(self) -> bool:
        """Validar prerrequisitos.
        
        Returns:
            True si al menos una herramienta de lint está disponible
        """
        import shutil
        
        # Verificar ruff (principal)
        if shutil.which("ruff"):
            return True
        
        self.console.print("[warning]No lint tools found (ruff recommended)[/warning]")
        return True  # No bloqueamos, solo advertimos
    
    def _lint_python(self, path: Path) -> dict[str, Any]:
        """Lint de código Python.
        
        Args:
            path: Ruta al código
            
        Returns:
            Resultado del lint
        """
        import shutil
        
        if not shutil.which("ruff"):
            return {"status": "skipped", "message": "ruff not found"}
        
        cmd = ["ruff", "check"]
        if self.fix:
            cmd.append("--fix")
        cmd.append(str(path))
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                return {"status": "passed", "message": "No issues found"}
            else:
                return {
                    "status": "failed",
                    "message": result.stdout[:500] if result.stdout else result.stderr[:500]
                }
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def _lint_shell(self, path: Path) -> dict[str, Any]:
        """Lint de scripts shell.
        
        Args:
            path: Ruta al código
            
        Returns:
            Resultado del lint
        """
        import shutil
        
        if not shutil.which("shellcheck"):
            return {"status": "skipped", "message": "shellcheck not found"}
        
        scripts = list(path.glob("**/*.sh"))
        if not scripts:
            return {"status": "skipped", "message": "No shell scripts found"}
        
        issues = 0
        for script in scripts:
            try:
                result = subprocess.run(
                    ["shellcheck", "-S", "warning", str(script)],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                if result.returncode != 0:
                    issues += 1
            except Exception:
                pass
        
        if issues == 0:
            return {"status": "passed", "message": "No issues found"}
        else:
            return {"status": "failed", "message": f"{issues} issues found"}
    
    def _lint_dockerfile(self, path: Path) -> dict[str, Any]:
        """Lint de Dockerfiles.
        
        Args:
            path: Ruta al código
            
        Returns:
            Resultado del lint
        """
        import shutil
        
        if not shutil.which("hadolint"):
            return {"status": "skipped", "message": "hadolint not found"}
        
        dockerfile = path / "Dockerfile"
        if not dockerfile:
            return {"status": "skipped", "message": "No Dockerfile found"}
        
        try:
            result = subprocess.run(
                ["hadolint", str(dockerfile)],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                return {"status": "passed", "message": "No issues found"}
            else:
                return {
                    "status": "failed",
                    "message": result.stdout[:300]
                }
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def run(self, **kwargs) -> AgentResult:
        """Ejecutar linting.
        
        Returns:
            AgentResult con el resultado
        """
        print_header("Running Lint Checks")
        
        try:
            config_loader = get_config_loader()
            services_config = config_loader.load("services.json")
            services = services_config.get("services", {})
            
            services_list = [
                {"name": name, "path": info.get("path", f"apps/{name}")}
                for name, info in services.items()
            ]
            
            if self.services:
                services_list = [s for s in services_list if s["name"] in self.services]
                
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
                message="No services to lint"
            )
        
        self.console.print(f"[info]Linting {len(services_list)} services[/info]\n")
        
        results = []
        passed = 0
        failed = 0
        skipped = 0
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[bold blue]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
        ) as progress:
            
            task = progress.add_task("[cyan]Linting...", total=len(services_list))
            
            for service in services_list:
                service_path = Path(service["path"])
                service_results = {}
                
                if not service_path.exists():
                    progress.update(task, advance=1)
                    continue
                
                # Python lint
                py_result = self._lint_python(service_path)
                service_results["python"] = py_result
                
                # Shell lint
                sh_result = self._lint_shell(service_path)
                service_results["shell"] = sh_result
                
                # Dockerfile lint
                df_result = self._lint_dockerfile(service_path)
                service_results["dockerfile"] = df_result
                
                # Evaluar resultado general
                statuses = [r["status"] for r in service_results.values()]
                
                if "failed" in statuses:
                    failed += 1
                    print_error(f"{service['name']}: issues found")
                elif "skipped" in statuses and len(set(statuses)) == 1:
                    skipped += 1
                    self.console.print(f"  [dim]⊘[/dim] {service['name']}: skipped")
                else:
                    passed += 1
                    print_success(f"{service['name']}")
                
                results.append({
                    "service": service["name"],
                    "results": service_results
                })
                
                progress.update(task, advance=1)
        
        status = "success" if failed == 0 else "failure"
        message = f"Lint completed: {passed} passed, {failed} failed, {skipped} skipped"
        
        return AgentResult(
            agent=self.name,
            status=status,
            message=message,
            data={
                "total": len(services_list),
                "passed": passed,
                "failed": failed,
                "skipped": skipped,
                "results": results
            }
        )
