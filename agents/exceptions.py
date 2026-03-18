"""
Excepciones personalizadas para el pipeline.
"""

class PipelineError(Exception):
    """Error base del pipeline."""
    pass


class AgentError(PipelineError):
    """Error genérico de un agente."""
    pass


class AgentValidationError(AgentError):
    """Error de validación de prerrequisitos."""
    pass


class AgentExecutionError(AgentError):
    """Error durante la ejecución del agente."""
    pass


class ConfigurationError(PipelineError):
    """Error de configuración."""
    pass


class ManifestError(ConfigurationError):
    """Error en el manifest de configuración."""
    pass
