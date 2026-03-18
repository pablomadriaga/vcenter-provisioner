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
                return self._stop_timer(result)
            
            # Ejecutar lógica específica
            result = self.run(**kwargs)
            self._log_result(result)
            return self._stop_timer(result)
            
        except Exception as e:
            logger.exception(f"Agent {self.name} raised exception")
            result = AgentResult(
                agent=self.name,
                status="failure",
                message=str(e),
                errors=[{"type": type(e).__name__, "message": str(e)}]
            )
            return self._stop_timer(result)
