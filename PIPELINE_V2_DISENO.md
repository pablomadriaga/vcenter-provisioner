# Diseño Técnico: Pipeline vCenter Provisioner v2.0

> **Versión:** 2.0
> **Fecha:** 2026-03-17
> **Estado:** En desarrollo
> **Arquitecto:** Equipo de Ingeniería
> **Lenguaje:** Python 3.12 + Click

---

## 1. Resumen Ejecutivo

Este documento define la arquitectura de la segunda generación del pipeline de CI/CD para vCenter Provisioner. El objetivo es reemplazar el monolito bash (`pipeline.sh` - 822 líneas) por una arquitectura modular basada en Python + Click.

### Objetivos de Diseño

| Objetivo | Métrica |
|----------|---------|
| **Modularidad** | Cada componente < 100 líneas |
| **Testabilidad** | >80% coverage con pytest |
| **Debugging** | Logs estructurados JSON |
| **Mantenibilidad** | Type hints en todo el código |
| **Extensibilidad** | Agregar nuevo agente sin modificar código existente |

---

## 2. Arquitectura General

### 2.1 Patrón de Diseño: CLI Modular

```
┌─────────────────────────────────────────────────────────────┐
│                     pipeline.py (CLI)                       │
│                 Entry point, parsea argumentos              │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Invoca
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    agents/ (Paquete)                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ agents.test │ │ agents.lint │ │ agents.build│          │
│  │             │ │             │ │             │          │
│  │  runner.py  │ │  runner.py  │ │  runner.py  │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Lee
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  config/ (Datos)                           │
│            test-manifest.json, services.json                │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Principios de Arquitectura

| Principio | Aplicación |
|-----------|------------|
| **Single Responsibility** | Cada módulo hace una cosa |
| **Dependency Inversion** | Depender de abstracciones, no de concreciones |
| **Open/Closed** | Extensible sin modificar código existente |
| **Interface Segregation** | Contratos claros entre componentes |
| **Liskov Substitution** | Agentes intercambiables |

---

## 3. Estructura de Directorios

```
vcenter-provisioner/
├── pipeline.py                    # CLI principal (Entry point)
├── requirements.txt              # Dependencias Python
├── pyproject.toml               # Configuración proyecto
│
├── agents/                      # Paquete de agentes
│   ├── __init__.py             # Exporataciones públicas
│   ├── base.py                 # Clase base Agent
│   ├── exceptions.py           # Excepciones personalizadas
│   ├── config.py               # Loader de configuración
│   └── test/
│       ├── __init__.py
│       ├── runner.py           # Orquestador de tests
│       ├── host.py            # Tests en host
│       ├── docker.py          # Tests en Docker
│       └── report.py          # Generación de reportes
│   └── lint/
│       ├── __init__.py
│       └── runner.py
│   └── build/
│       ├── __init__.py
│       └── runner.py
│
├── scripts/                    # Scripts legacy (referencia)
├── config/
│   ├── test-manifest.json
│   ├── ports.json
│   └── services.json
│
└── infra/
    └── local/
        └── docker-compose.yml
```

---

## 4. Contratos

### 4.1 Contrato: CLI Principal

```python
# Usage: pipeline.py [COMMAND] [OPTIONS]

Commands:
  test       Ejecutar suite de tests
  lint      Ejecutar linting
  build     Build de imágenes Docker
  deploy    Deployment de servicios
  validate  Validar prerequisitos

Global Options:
  --verbose, -v    Modo debug
  --quiet, -q      Solo errores
  --help, -h       Ayuda
```

### 4.2 Contrato: Agente

```python
# Interfaz que todo agente debe cumplir

class Agent(ABC):
    """Interfaz base para agentes"""
    
    @abstractmethod
    def run(self, **kwargs) -> AgentResult:
        """
        Ejecutar el agente.
        
        Returns:
            AgentResult: {
                "status": "success" | "failure" | "skipped",
                "message": str,
                "duration_ms": int,
                "data": dict,
                "errors": list
            }
        """
        pass
    
    @abstractmethod
    def validate(self) -> bool:
        """Validar prerrequisitos del agente."""
        pass
```

### 4.3 Contrato: Result JSON

```python
# Formato estándar de respuesta de cualquier agente

{
    "agent": "test-host",           # Nombre del agente
    "version": "1.0.0",             # Versión del contrato
    "status": "success",             # success | failure | skipped
    "message": "All tests passed",  # Mensaje humano
    "duration_ms": 45000,            # Tiempo en milisegundos
    "timestamp": "2026-03-17T10:30:00Z",
    "data": {                       # Datos específicos del agente
        "total": 10,
        "passed": 10,
        "failed": 0,
        "skipped": 0
    },
    "errors": [],                   # Lista de errores (si hay)
    "artifacts": [                 # Archivos generados
        {"type": "report", "path": "reports/test-host.html"}
    ]
}
```

---

## 5. Componentes

### 5.1 agents/base.py - Clase Base

```python
"""Agente base con funcionalidad común."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any
import time
import json

@dataclass
class AgentResult:
    """Resultado estándar de un agente."""
    agent: str
    version: str = "1.0.0"
    status: str = "success"  # success | failure | skipped
    message: str = ""
    duration_ms: int = 0
    data: dict = field(default_factory=dict)
    errors: list = field(default_factory=list)
    artifacts: list = field(default_factory=list)
    
    def to_json(self) -> str:
        return json.dumps(self.__dict__, indent=2)


class Agent(ABC):
    """Clase base para todos los agentes."""
    
    def __init__(self, config: dict | None = None):
        self.config = config or {}
        self.start_time = 0
    
    @abstractmethod
    def run(self, **kwargs) -> AgentResult:
        """Ejecutar el agente."""
        pass
    
    @abstractmethod
    def validate(self) -> bool:
        """Validar prerrequisitos."""
        pass
    
    def _start(self):
        """Iniciar计时."""
        self.start_time = time.time()
    
    def _finish(self, result: AgentResult) -> AgentResult:
        """Finalizar y calcular duración."""
        result.duration_ms = int((time.time() - self.start_time) * 1000)
        return result
```

### 5.2 agents/config.py - Loader

```python
"""Cargador de configuración centralizado."""

import json
from pathlib import Path
from typing import Any

class ConfigLoader:
    """Carga y valida configuración."""
    
    def __init__(self, base_path: Path | None = None):
        self.base_path = base_path or Path(__file__).parent.parent / "config"
    
    def load(self, filename: str) -> dict[str, Any]:
        """Cargar archivo JSON de configuración."""
        path = self.base_path / filename
        if not path.exists():
            raise FileNotFoundError(f"Config not found: {path}")
        
        with open(path) as f:
            return json.load(f)
    
    def load_manifest(self) -> dict[str, Any]:
        """Cargar test-manifest.json."""
        return self.load("test-manifest.json")
    
    def load_ports(self) -> dict[str, Any]:
        """Cargar ports.json."""
        return self.load("ports.json")
    
    def load_services(self) -> dict[str, Any]:
        """Cargar services.json."""
        return self.load("services.json")
```

---

## 6. Patrones de Diseño

### 6.1 Patrón: Pipeline de Agentes

```python
"""Pipeline orchestrator usando composición."""

class Pipeline:
    """Orquesta la ejecución de múltiples agentes."""
    
    def __init__(self):
        self.agents: list[Agent] = []
        self.results: list[AgentResult] = []
    
    def add(self, agent: Agent) -> "Pipeline":
        """Agregar agente al pipeline."""
        self.agents.append(agent)
        return self
    
    def run(self) -> bool:
        """Ejecutar todos los agentes en orden."""
        for agent in self.agents:
            if not agent.validate():
                self.results.append(AgentResult(
                    agent=agent.__class__.__name__,
                    status="skipped",
                    message="Prerequisites not met"
                ))
                continue
            
            result = agent.run()
            self.results.append(result)
            
            if result.status == "failure":
                return False
        
        return True
```

### 6.2 Patrón: Strategy para Modos

```python
"""Strategy pattern para diferentes modos de ejecución."""

from abc import ABC, abstractmethod

class TestStrategy(ABC):
    """Estrategia para ejecutar tests."""
    
    @abstractmethod
    def execute(self, manifest: dict) -> AgentResult:
        pass


class HostTestStrategy(TestStrategy):
    """Ejecutar tests en el host."""
    
    def execute(self, manifest: dict) -> AgentResult:
        # Lógica específica para host
        pass


class DockerTestStrategy(TestStrategy):
    """Ejecutar tests en Docker."""
    
    def execute(self, manifest: dict) -> AgentResult:
        # Lógica específica para Docker
        pass


class TestAgent:
    """Agente que usa estrategia."""
    
    def __init__(self, strategy: TestStrategy):
        self.strategy = strategy
    
    def run(self, **kwargs) -> AgentResult:
        return self.strategy.execute(kwargs.get("manifest", {}))
```

---

## 7. Manejo de Errores

### 7.1 Jerarquía de Excepciones

```python
"""Excepciones del pipeline."""

class PipelineError(Exception):
    """Error base."""
    pass

class AgentError(PipelineError):
    """Error en un agente."""
    pass

class ConfigurationError(PipelineError):
    """Error de configuración."""
    pass

class ValidationError(PipelineError):
    """Error de validación."""
    pass
```

### 7.2 Manejo en CLI

```python
"""Manejo centralizado de errores."""

import sys
import logging
from click import Context

def setup_error_handling():
    """Configurar manejo de errores global."""
    
    def handle_error(ctx: Context, err: Exception):
        logging.error(f"Error: {err}")
        
        if isinstance(err, AgentError):
            sys.exit(10)  # Error de agente
        elif isinstance(err, ConfigurationError):
            sys.exit(20)  # Error de config
        else:
            sys.exit(1)   # Error genérico
    
    return handle_error
```

---

## 8. Testing

### 8.1 Estructura de Tests

```
tests/
├── unit/
│   ├── test_base.py
│   ├── test_config.py
│   └── test_agents/
│       ├── __init__.py
│       ├── test_test_agent.py
│       └── test_lint_agent.py
├── integration/
│   ├── test_pipeline.py
│   └── test_agents_with_docker.py
└── conftest.py
```

### 8.2 Ejemplo de Test

```python
"""Test unitario de agente base."""

import pytest
from agents.base import Agent, AgentResult

class DummyAgent(Agent):
    def run(self, **kwargs) -> AgentResult:
        return AgentResult(
            agent="dummy",
            status="success",
            message="OK"
        )
    
    def validate(self) -> bool:
        return True


def test_agent_result_json_serialization():
    """Verificar serialización JSON de resultado."""
    result = AgentResult(
        agent="test",
        status="success",
        message="All passed",
        data={"tests": 10}
    )
    
    json_str = result.to_json()
    data = json.loads(json_str)
    
    assert data["agent"] == "test"
    assert data["status"] == "success"


def test_agent_validation():
    """Verificar que validate() se llama."""
    agent = DummyAgent()
    assert agent.validate() is True
```

---

## 9. Convenciones de Código

### 9.1 Type Hints

```python
# SIEMPRE usar type hints
def run(self, manifest: dict[str, Any], mode: str = "host") -> AgentResult:
    ...

# Para diccionarios simples
def get_port(service: str) -> str | None:
    ...
```

### 9.2 Nombres

| Tipo | Convención | Ejemplo |
|------|------------|---------|
| Clases | PascalCase | `class TestAgent` |
| Funciones | snake_case | `def run_tests` |
| Constantes | UPPER_SNAKE | `MAX_RETRIES = 3` |
| Archivos | snake_case | `test_runner.py` |
| Módulos | snake_case | `agents/test/runner.py` |

### 9.3 Docstrings

```python
def run(self, **kwargs) -> AgentResult:
    """Ejecutar el agente de tests.
    
    Args:
        **kwargs: Argumentos específicos del agente.
            - manifest: Test manifest (dict)
            - mode: Modo de ejecución (host|docker|hybrid)
            - parallel: Ejecución paralela (bool)
    
    Returns:
        AgentResult con el resultado de la ejecución.
    
    Raises:
        AgentError: Si ocurre un error durante la ejecución.
    
    Example:
        >>> agent = TestAgent()
        >>> result = agent.run(manifest={"suites": [...]}, mode="host")
        >>> print(result.status)
        'success'
    """
```

---

## 10. Logging

### 10.1 Estructura de Logs

```python
import logging
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):
    """Formatter que salida JSON."""
    
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps({
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        })
```

### 10.2 Niveles

| Nivel | Uso |
|-------|-----|
| DEBUG | Información detallada de debugging |
| INFO | Progreso normal del pipeline |
| WARNING | Algo no ideal pero no es error |
| ERROR | Fallo en una operación |
| CRITICAL | Error que impide continuar |

---

## 11. Integración con Legacy

### 11.1 Coexistencia

El nuevo pipeline coexistirá con el legacy:

```
# Ambos funcionan
./pipeline.sh --test           # Legacy
python pipeline.py test         # Nuevo
```

### 11.2 Migración Incremental

1. **Fase 1**: Crear `pipeline.py` que llame a `pipeline.sh`
2. **Fase 2**: Reemplazar agentes uno por uno
3. **Fase 3**: Eliminar `pipeline.sh` cuando todos los agentes estén migrados

---

## 12. Métricas

### 12.1 Métricas de Código

| Métrica | Objetivo |
|---------|----------|
| Líneas por módulo | < 100 |
| Complejidad ciclomática | < 10 |
| Cobertura de tests | > 80% |
| Type hints | 100% |

### 12.2 Métricas de Ejecución

| Métrica | Objetivo |
|---------|----------|
| Tiempo de inicio | < 1 segundo |
| Tiempo de test (host) | < 60 segundos |
| Tiempo de test (docker) | < 180 segundos |

---

## 13. Referencias

- [Click Documentation](https://click.palletsprojects.com/)
- [Python typing module](https://docs.python.org/3/library/typing.html)
- [pytest Documentation](https://docs.pytest.org/)
- [Google Python Style Guide](https://google.github.io/styleguide/pyguide.html)

---

## 14. Historial de Versiones

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0.0 | 2026-03-17 | Documento inicial |

---

**Documento creado con mentalidad de ingeniería de software.**
