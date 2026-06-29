"""
Wrapper para Docker SDK.
Proporciona una interfaz limpia para operaciones Docker.
"""

import docker
from docker.models.images import Image
from docker.models.containers import Container
from typing import Generator
import logging


logger = logging.getLogger(__name__)


class DockerClient:
    """Cliente Docker usando el SDK oficial."""
    
    def __init__(self):
        """Inicializar cliente Docker."""
        try:
            self._client = docker.from_env()
            # Verificar conexión
            self._client.ping()
            logger.debug("Docker client connected")
        except docker.errors.DockerException as e:
            logger.error(f"Failed to connect to Docker: {e}")
            raise
    
    @property
    def client(self) -> docker.DockerClient:
        """Obtener el cliente Docker raw."""
        return self._client
    
    def image_exists(self, tag: str) -> bool:
        """Verificar si una imagen existe localmente.
        
        Args:
            tag: Tag de la imagen (ej: 'nginx:latest')
            
        Returns:
            True si la imagen existe
        """
        try:
            self._client.images.get(tag)
            return True
        except docker.errors.NotFound:
            return False
        except docker.errors.APIError as e:
            logger.warning(f"Error checking image {tag}: {e}")
            return False
    
    def build_image(
        self,
        path: str,
        tag: str,
        rm: bool = True,
        buildargs: dict | None = None,
    ) -> tuple[Image, Generator[dict, None, None]]:
        """Construir una imagen Docker.
        
        Args:
            path: Ruta al contexto de build
            tag: Tag para la imagen
            rm: Eliminar contenedores intermedios
            buildargs: Argumentos de build
            
        Returns:
            Tupla (Image, build_logs)
        """
        logger.info(f"Building image: {tag}")
        
        image, logs = self._client.images.build(
            path=path,
            tag=tag,
            rm=rm,
            buildargs=buildargs or {},
        )
        
        return image, logs
    
    def pull_image(self, tag: str) -> Image:
        """Descargar una imagen de un registry.
        
        Args:
            tag: Tag de la imagen
            
        Returns:
            La imagen descargada
        """
        logger.info(f"Pulling image: {tag}")
        return self._client.images.pull(tag)
    
    def list_images(self, filters: dict | None = None) -> list[Image]:
        """Listar imágenes locales.
        
        Args:
            filters: Filtros opcional
            
        Returns:
            Lista de imágenes
        """
        return self._client.images.list(filters=filters)
    
    def remove_image(self, tag: str, force: bool = False) -> list[str]:
        """Eliminar una imagen.
        
        Args:
            tag: Tag de la imagen
            force: Forzar eliminación
            
        Returns:
            Lista de IDs de imágenes eliminadas
        """
        return self._client.images.remove(tag, force=force)
    
    def list_containers(
        self,
        all: bool = False,
        filters: dict | None = None,
    ) -> list[Container]:
        """Listar contenedores.
        
        Args:
            all: Incluir contenedores detenidos
            filters: Filtros opcional
            
        Returns:
            Lista de contenedores
        """
        return self._client.containers.list(all=all, filters=filters or {})
    
    def get_container(self, container_id: str) -> Container:
        """Obtener un contenedor por ID o nombre.
        
        Args:
            container_id: ID o nombre del contenedor
            
        Returns:
            El contenedor
        """
        return self._client.containers.get(container_id)
    
    def remove_container(
        self,
        container_id: str,
        force: bool = False,
        v: bool = False,
    ) -> None:
        """Eliminar un contenedor.
        
        Args:
            container_id: ID o nombre
            force: Forzar eliminación
            v: Eliminar volúmenes asociados
        """
        container = self.get_container(container_id)
        container.remove(force=force, v=v)
    
    def list_networks(self) -> list:
        """Listar redes Docker."""
        return self._client.networks.list()
    
    def remove_network(self, network_id: str) -> None:
        """Eliminar una red."""
        network = self._client.networks.get(network_id)
        network.remove()
    
    def list_volumes(self) -> list:
        """Listar volúmenes."""
        return self._client.volumes.list()
    
    def remove_volume(self, name: str, force: bool = False) -> None:
        """Eliminar un volumen."""
        volume = self._client.volumes.get(name)
        volume.remove(force=force)
    
    def compose_up(
        self,
        project_dir: str,
        compose_file: str = "docker-compose.yml",
        detach: bool = True,
    ) -> None:
        """Ejecutar docker-compose up.
        
        Args:
            project_dir: Directorio del proyecto
            compose_file: Archivo compose
            detach: Modo detached
        """
        import subprocess
        
        cmd = ["docker-compose", "-f", compose_file, "up"]
        if detach:
            cmd.append("-d")
        
        subprocess.run(cmd, cwd=project_dir, check=True)
    
    def compose_down(
        self,
        project_dir: str,
        compose_file: str = "docker-compose.yml",
        volumes: bool = False,
    ) -> None:
        """Ejecutar docker-compose down.
        
        Args:
            project_dir: Directorio del proyecto
            compose_file: Archivo compose
            volumes: Eliminar volúmenes
        """
        import subprocess
        
        cmd = ["docker-compose", "-f", compose_file, "down"]
        if volumes:
            cmd.append("-v")
        
        subprocess.run(cmd, cwd=project_dir, check=True)


# Instancia global
_docker_client: DockerClient | None = None


def get_docker() -> DockerClient:
    """Obtener instancia global del cliente Docker."""
    global _docker_client
    if _docker_client is None:
        _docker_client = DockerClient()
    return _docker_client
