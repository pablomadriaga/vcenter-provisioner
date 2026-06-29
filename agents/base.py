"""
Clase base para agentes del pipeline.
Proporciona estructura común y resultado estándar.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from typing import Any
import time
import json
import logging
from datetime import datetime, timezone
from rich.console import Console
from rich.theme import Theme


# Configurar Rich console
_custom_theme = Theme({
    "info": "cyan",
    "warning": "yellow",
    "error": "bold red",
    "success": "bold green",
})
console = Console(theme=_custom_theme)


logger = logging.getLogger(__name__)


@dataclass
class AgentResult:
    """Resultado estándar de cualquier agente.
    
    Attributes:
        agent: Nombre del agente
        version: Versión del contrato
        status: Estado de ejecución (success|failure|skipped)
        message: Mensaje legible para humanos
        duration_ms: Duración en milisegundos
        timestamp: Timestamp ISO de la ejecución
        data: Datos específicos del agente
        errors: Lista de errores ocurridos
        artifacts: Archivos generados por el agente
    """
    agent: str
    version: str = "1.0.0"
    status: str = "success"
    message: str = ""
    duration_ms: int = 0
    timestamp: str = ""
    data: dict = field(default_factory=dict)
    errors: list = field(default_factory=list)
    artifacts: list = field(default_factory=list)
    
    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    def to_dict(self) -> dict:
        """Convertir a diccionario."""
        return asdict(self)
    
    def to_json(self) -> str:
        """Serializar a JSON."""
        return json.dumps(self.to_dict(), indent=2, default=str)
    
    @classmethod
    def from_dict(cls, data: dict) -> "AgentResult":
        """Crear desde diccionario."""
        return cls(**data)
    
    def print_summary(self) -> None:
        """Imprimir resumen formateado con Rich."""
        if self.status == "success":
            console.print(f"[success]✓[/success] {self.agent}: {self.message}")
            if self.duration_ms > 0:
                console.print(f"  [info]Duration:[/info] {self.duration_ms}ms")
        elif self.status == "skipped":
            console.print(f"[warning]⊘[/warning] {self.agent}: {self.message}")
        else:
            console.print(f"[error]✗[/error] {self.agent}: {self.message}")
            for err in self.errors:
                console.print(f"  [error]•[/error] {err.get('message', err)}")


class Agent(ABC):
    """Clase abstracta base para todos los agentes.
    
    Attributes:
        name: Nombre del agente
        config: Configuración del agente
    """
    
    def __init__(self, config: dict[str, Any] | None = None):
        """Inicializar agente.
        
        Args:
            config: Diccionario de configuración opcional
        """
        self.name = self.__class__.__name__
        self.config = config or {}
        self._start_time: float | None = None
        self.console = console
    
    @abstractmethod
    def run(self, **kwargs) -> AgentResult:
        """Ejecutar el agente.
        
        Args:
            **kwargs: Argumentos específicos del agente
            
        Returns:
            AgentResult con el resultado de la ejecución
        """
        pass
    
    @abstractmethod
    def validate(self) -> bool:
        """Validar prerrequisitos del agente.
        
        Returns:
            True si los prerrequisitos están cumplidos
        """
        pass
    
    def _start_timer(self) -> None:
        """Iniciar el temporizador."""
        self._start_time = time.time()
    
    def _stop_timer(self, result: AgentResult) -> AgentResult:
        """Detener temporizador y calcular duración.
        
        Args:
            result: Resultado a actualizar con la duración
            
        Returns:
            El resultado con duration_ms actualizado
        """
        if self._start_time:
            result.duration_ms = int((time.time() - self._start_time) * 1000)
        return result
    
    def _log_start(self, **kwargs) -> None:
        """Loggear inicio de ejecución."""
        logger.info(f"Agent {self.name} starting with args: {kwargs}")
        self.console.print(f"[info]→[/info] {self.name} starting...")
    
    def _log_result(self, result: AgentResult) -> None:
        """Loggear resultado de ejecución."""
        if result.status == "success":
            logger.info(f"Agent {self.name} completed in {result.duration_ms}ms")
        elif result.status == "skipped":
            logger.warning(f"Agent {self.name} skipped: {result.message}")
        else:
            logger.error(f"Agent {self.name} failed: {result.message}")
    
    def execute(self, **kwargs) -> AgentResult:
        """Ejecutar el agente con manejo de errores común.
        
        Args:
            **kwargs: Argumentos para el agente
            
        Returns:
            AgentResult con el resultado
        """
        self._start_timer()
        self._log_start(**kwargs)
        
        try:
            # Validar prerrequisitos
            if not self.validate():
                result = AgentResult(
                    agent=self.name,
                    status="skipped",
                    message="Prerequisites not met"
                )
                self.console.print(f"[warning]⊘[/warning] {self.name} skipped")
                return self._stop_timer(result)
            
            # Ejecutar lógica específica
            result = self.run(**kwargs)
            self._log_result(result)
            result.print_summary()
            return self._stop_timer(result)
            
        except Exception as e:
            logger.exception(f"Agent {self.name} raised exception")
            result = AgentResult(
                agent=self.name,
                status="failure",
                message=str(e),
                errors=[{"type": type(e).__name__, "message": str(e)}]
            )
            self.console.print(f"[error]✗[/error] {self.name} failed: {e}")
            return self._stop_timer(result)


def print_header(title: str) -> None:
    """Imprimir header con Rich."""
    console.print(f"\n[bold cyan]{'=' * 60}[/bold cyan]")
    console.print(f"[bold cyan]{title:^60}[/bold cyan]")
    console.print(f"[bold cyan]{'=' * 60}[/bold cyan]\n")


def print_step(step: str, description: str) -> None:
    """Imprimir paso del pipeline."""
    console.print(f"[info]▸ {step}:[/info] {description}")


def print_success(message: str) -> None:
    """Imprimir mensaje de éxito."""
    console.print(f"[success]✓ {message}[/success]")


def print_error(message: str) -> None:
    """Imprimir mensaje de error."""
    console.print(f"[error]✗ {message}[/error]")


def print_warning(message: str) -> None:
    """Imprimir mensaje de warning."""
    console.print(f"[warning]⚠ {message}[/warning]")
