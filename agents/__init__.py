"""
Agentes del Pipeline vCenter Provisioner v2.0.

Paquete que contiene todos los agentes modulares del pipeline.
"""

from .base import Agent, AgentResult
from .config import ConfigLoader, get_config_loader, load_manifest, get_suites
from .exceptions import (
    PipelineError,
    AgentError,
    AgentValidationError,
    AgentExecutionError,
    ConfigurationError,
    ManifestError,
)

__version__ = "2.0.0"
__all__ = [
    # Clases principales
    "Agent",
    "AgentResult",
    "ConfigLoader",
    # Excepciones
    "PipelineError",
    "AgentError",
    "AgentValidationError",
    "AgentExecutionError",
    "ConfigurationError",
    "ManifestError",
    # Funciones de conveniencia
    "get_config_loader",
    "load_manifest",
    "get_suites",
]
