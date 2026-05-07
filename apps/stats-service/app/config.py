"""Stats Service Configuration

12-Factor: Configuration via Environment Variables
"""
from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings from environment variables."""
    
    # Server
    PORT: int = 8001
    CORS_ORIGINS: str = "*"
    
    # Database (required - must be set via environment)
    DATABASE_URL: str = ""
    
    # External Services
    ORCHESTRATOR_URL: str = "http://vm-orchestrator:8080"
    STATS_COLLECTION_INTERVAL: int = 30  # seconds
    
    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=False
    )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
