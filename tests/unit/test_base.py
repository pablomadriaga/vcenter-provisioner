"""
Tests unitarios para agents/base.py
"""

import pytest
from agents.base import Agent, AgentResult


class DummyAgent(Agent):
    """Agente de prueba."""
    
    def validate(self) -> bool:
        return True
    
    def run(self, **kwargs) -> AgentResult:
        return AgentResult(
            agent=self.name,
            status="success",
            message="Dummy test passed"
        )


class FailingAgent(Agent):
    """Agente que siempre falla."""
    
    def validate(self) -> bool:
        return True
    
    def run(self, **kwargs) -> AgentResult:
        raise ValueError("Test error")


class SkippedAgent(Agent):
    """Agente que se salta."""
    
    def validate(self) -> bool:
        return False
    
    def run(self, **kwargs) -> AgentResult:
        return AgentResult(
            agent=self.name,
            status="success"
        )


class TestAgentResult:
    """Tests para AgentResult."""
    
    def test_default_values(self):
        """Verificar valores por defecto."""
        result = AgentResult(agent="test")
        
        assert result.agent == "test"
        assert result.version == "1.0.0"
        assert result.status == "success"
        assert result.duration_ms == 0
        assert result.data == {}
        assert result.errors == []
        assert result.artifacts == []
    
    def test_to_dict(self):
        """Verificar conversión a diccionario."""
        result = AgentResult(
            agent="test",
            status="success",
            message="OK",
            data={"key": "value"}
        )
        
        d = result.to_dict()
        
        assert d["agent"] == "test"
        assert d["status"] == "success"
        assert d["data"]["key"] == "value"
    
    def test_to_json(self):
        """Verificar serialización JSON."""
        result = AgentResult(
            agent="test",
            status="failure",
            message="Error occurred"
        )
        
        json_str = result.to_json()
        
        assert '"agent": "test"' in json_str
        assert '"status": "failure"' in json_str
    
    def test_from_dict(self):
        """Verificar creación desde diccionario."""
        data = {
            "agent": "test",
            "status": "success",
            "message": "OK",
            "data": {"count": 5}
        }
        
        result = AgentResult.from_dict(data)
        
        assert result.agent == "test"
        assert result.data["count"] == 5


class TestAgent:
    """Tests para clase Agent."""
    
    def test_agent_creation(self):
        """Verificar creación de agente."""
        agent = DummyAgent()
        
        assert agent.name == "DummyAgent"
        assert agent.config == {}
    
    def test_agent_with_config(self):
        """Verificar agente con configuración."""
        config = {"mode": "host", "parallel": True}
        agent = DummyAgent(config)
        
        assert agent.config == config
    
    def test_validate(self):
        """Verificar validación."""
        agent = DummyAgent()
        
        assert agent.validate() is True
    
    def test_execute_success(self):
        """Verificar ejecución exitosa."""
        agent = DummyAgent()
        
        result = agent.execute()
        
        assert result.status == "success"
        assert result.message == "Dummy test passed"
        assert result.duration_ms >= 0
    
    def test_execute_skip(self):
        """Verificar ejecución cuando se salta."""
        agent = SkippedAgent()
        
        result = agent.execute()
        
        assert result.status == "skipped"
    
    def test_execute_error(self):
        """Verificar manejo de errores."""
        agent = FailingAgent()
        
        result = agent.execute()
        
        assert result.status == "failure"
        assert len(result.errors) > 0
        assert result.errors[0]["type"] == "ValueError"
