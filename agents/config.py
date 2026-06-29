"""
Cargador de configuración centralizado.
Maneja la carga de archivos JSON de configuración.
"""

import json
from pathlib import Path
from typing import Any
import logging

from .exceptions import ConfigurationError, ManifestError


logger = logging.getLogger(__name__)


class ConfigLoader:
    """Cargador de configuración del pipeline.
    
    Maneja la carga de archivos JSON desde el directorio config/.
    """
    
    DEFAULT_CONFIG_DIR = Path(__file__).parent.parent / "config"
    
    def __init__(self, config_dir: Path | None = None):
        """Inicializar loader.
        
        Args:
            config_dir: Ruta al directorio de configuración.
                       Si es None, usa el directorio por defecto.
        """
        self.config_dir = config_dir or self.DEFAULT_CONFIG_DIR
        self._cache: dict[str, Any] = {}
    
    def load(self, filename: str, use_cache: bool = True) -> dict[str, Any]:
        """Cargar archivo de configuración JSON.
        
        Args:
            filename: Nombre del archivo (ej: "test-manifest.json")
            use_cache: Usar cache si está disponible
            
        Returns:
            Diccionario con la configuración
            
        Raises:
            ConfigurationError: Si el archivo no existe o no es válido JSON
        """
        if use_cache and filename in self._cache:
            logger.debug(f"Using cached config: {filename}")
            return self._cache[filename]
        
        path = self.config_dir / filename
        
        if not path.exists():
            raise ConfigurationError(f"Config file not found: {path}")
        
        try:
            with open(path, "r", encoding="utf-8") as f:
                config = json.load(f)
            
            self._cache[filename] = config
            logger.debug(f"Loaded config: {filename}")
            return config
            
        except json.JSONDecodeError as e:
            raise ConfigurationError(f"Invalid JSON in {filename}: {e}")
    
    def load_manifest(self) -> dict[str, Any]:
        """Cargar test-manifest.json."""
        return self.load("test-manifest.json")
    
    def load_ports(self) -> dict[str, Any]:
        """Cargar ports.json."""
        return self.load("ports.json")
    
    def load_services(self) -> dict[str, Any]:
        """Cargar services.json."""
        return self.load("services.json")
    
    def get_suites(self) -> list[dict[str, Any]]:
        """Obtener lista de suites de test del manifest.
        
        Returns:
            Lista de configuraciones de suites
            
        Raises:
            ManifestError: Si el manifest no tiene el formato esperado
        """
        manifest = self.load_manifest()
        
        if "suites" not in manifest:
            raise ManifestError("Manifest missing 'suites' key")
        
        return manifest["suites"]
    
    def get_suite(self, name: str) -> dict[str, Any] | None:
        """Obtener una suite específica por nombre.
        
        Args:
            name: Nombre de la suite
            
        Returns:
            Configuración de la suite o None si no existe
        """
        suites = self.get_suites()
        
        for suite in suites:
            if suite.get("name") == name:
                return suite
        
        return None
    
    def clear_cache(self) -> None:
        """Limpiar cache de configuración."""
        self._cache.clear()
        logger.debug("Config cache cleared")


# Instancia global de configuración
_config_loader: ConfigLoader | None = None


def get_config_loader() -> ConfigLoader:
    """Obtener instancia global del loader de configuración.
    
    Returns:
        Instancia de ConfigLoader
    """
    global _config_loader
    
    if _config_loader is None:
        _config_loader = ConfigLoader()
    
    return _config_loader


def load_manifest() -> dict[str, Any]:
    """Función de conveniencia para cargar el manifest."""
    return get_config_loader().load_manifest()


def get_suites() -> list[dict[str, Any]]:
    """Función de conveniencia para obtener suites."""
    return get_config_loader().get_suites()
