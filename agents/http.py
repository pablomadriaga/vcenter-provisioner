"""
Cliente HTTP async usando httpx.
Proporciona health checks paralelos高效的.
"""

import asyncio
import httpx
from typing import Callable
import logging


logger = logging.getLogger(__name__)


class HealthChecker:
    """Cliente para health checks paralelos."""
    
    def __init__(
        self,
        timeout: float = 5.0,
        max_retries: int = 3,
    ):
        """Inicializar health checker.
        
        Args:
            timeout: Timeout por request en segundos
            max_retries: Número de reintentos
        """
        self.timeout = timeout
        self.max_retries = max_retries
    
    async def check_single(
        self,
        url: str,
        name: str | None = None,
    ) -> dict:
        """Verificar health de un solo endpoint.
        
        Args:
            url: URL del endpoint
            name: Nombre del servicio (opcional)
            
        Returns:
            Diccionario con el resultado
        """
        service_name = name or url
        
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.get(url)
                    
                    if response.status_code < 400:
                        return {
                            "service": service_name,
                            "url": url,
                            "status": "healthy",
                            "status_code": response.status_code,
                            "response_time": response.elapsed.total_seconds() * 1000,
                            "error": None,
                        }
                    else:
                        return {
                            "service": service_name,
                            "url": url,
                            "status": "unhealthy",
                            "status_code": response.status_code,
                            "response_time": response.elapsed.total_seconds() * 1000,
                            "error": f"HTTP {response.status_code}",
                        }
                        
            except httpx.TimeoutException:
                if attempt == self.max_retries - 1:
                    return {
                        "service": service_name,
                        "url": url,
                        "status": "timeout",
                        "status_code": None,
                        "response_time": self.timeout * 1000,
                        "error": f"Timeout after {self.max_retries} attempts",
                    }
                    
            except httpx.RequestError as e:
                return {
                    "service": service_name,
                    "url": url,
                    "status": "error",
                    "status_code": None,
                    "response_time": 0,
                    "error": str(e),
                }
        
        return {
            "service": service_name,
            "url": url,
            "status": "error",
            "status_code": None,
            "response_time": 0,
            "error": "Max retries exceeded",
        }
    
    async def check_multiple(
        self,
        endpoints: list[tuple[str, str]],
    ) -> list[dict]:
        """Verificar health de múltiples endpoints en paralelo.
        
        Args:
            endpoints: Lista de tuplas (url, name)
            
        Returns:
            Lista de resultados
        """
        tasks = [
            self.check_single(url, name)
            for url, name in endpoints
        ]
        
        results = await asyncio.gather(*tasks)
        return list(results)
    
    async def check_services(
        self,
        services: dict[str, str],
    ) -> list[dict]:
        """Verificar health de servicios.
        
        Args:
            services: Diccionario {name: url}
            
        Returns:
            Lista de resultados
        """
        endpoints = [(url, name) for name, url in services.items()]
        return await self.check_multiple(endpoints)


class HTTPClient:
    """Cliente HTTP genérico async."""
    
    def __init__(
        self,
        timeout: float = 30.0,
        max_retries: int = 3,
    ):
        """Inicializar cliente HTTP.
        
        Args:
            timeout: Timeout por request
            max_retries: Reintentos automáticos
        """
        self.timeout = timeout
        self.max_retries = max_retries
    
    async def get(
        self,
        url: str,
        headers: dict | None = None,
    ) -> httpx.Response:
        """GET request async.
        
        Args:
            url: URL
            headers: Headers opcionales
            
        Returns:
            Response
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            return await client.get(url, headers=headers or {})
    
    async def post(
        self,
        url: str,
        json: dict | None = None,
        data: dict | None = None,
        headers: dict | None = None,
    ) -> httpx.Response:
        """POST request async.
        
        Args:
            url: URL
            json: JSON body
            data: Form data
            headers: Headers opcionales
            
        Returns:
            Response
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            return await client.post(
                url,
                json=json,
                data=data,
                headers=headers or {},
            )
    
    async def put(
        self,
        url: str,
        json: dict | None = None,
        headers: dict | None = None,
    ) -> httpx.Response:
        """PUT request async."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            return await client.put(url, json=json, headers=headers or {})
    
    async def delete(
        self,
        url: str,
        headers: dict | None = None,
    ) -> httpx.Response:
        """DELETE request async."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            return await client.delete(url, headers=headers or {})


# Funciones de conveniencia
async def check_health(url: str, name: str | None = None) -> dict:
    """Verificar health de un endpoint.
    
    Args:
        url: URL del endpoint
        name: Nombre del servicio
        
    Returns:
        Resultado del health check
    """
    checker = HealthChecker()
    return await checker.check_single(url, name)


async def check_services_health(services: dict[str, str]) -> list[dict]:
    """Verificar health de múltiples servicios.
    
    Args:
        services: Diccionario {name: url}
        
    Returns:
        Lista de resultados
    """
    checker = HealthChecker()
    return await checker.check_services(services)
