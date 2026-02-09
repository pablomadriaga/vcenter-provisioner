# Solución de Problemas - Docker en Windows

## 🔍 Error Detectado

```
unable to get image 'local-auth-service': error during connect: Get "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/v1.51/images/local-auth-service/json": open //./pipe/dockerDesktop|: The system cannot find the file specified.
```

## ⚠️ Causa

El named pipe de Docker Desktop (`dockerDesktopLinuxEngine`) no está accesible. Esto puede ocurrir por:

1. **Docker Desktop no está corriendo**
2. **Docker Desktop necesita ser reiniciado**
3. **Problema con la configuración de Docker en Windows**
4. **Servicio de Docker Desktop no iniciado correctamente**

---

## 🛠️ Soluciones

### Solución 1: Verificar que Docker Desktop esté corriendo

1. Abre **Docker Desktop** (busca el icono de Docker en la barra de tareas o en el menú de inicio)
2. Si Docker Desktop está abierto, verá el ícono de la ballena gris en la barra de tareas
3. Espera a que se ponga verde (indica que Docker está listo)

### Solución 2: Reiniciar Docker Desktop

1. Haz **clic derecho** en el icono de Docker Desktop en la barra de tareas
2. Selecciona **"Quit Docker Desktop"**
3. Abre **Docker Desktop** de nuevo
4. Espera a que el ícono de Docker se ponga verde (puede tomar 1-2 minutos)

### Solución 3: Verificar el servicio de Docker Desktop

1. Abre **Ejecutar** (Win + R)
2. Escribe `services.msc` y presiona Enter
3. Busca **Docker Desktop Service** en la lista
4. Verifica que el estado sea "En ejecución"
5. Si está parado, haz **clic derecho** → **Iniciar**

### Solución 4: Verificar la configuración de Docker

1. Abre **Docker Desktop**
2. Ve a **Settings** (engranaje)
3. Selecciona **General**
4. Asegúrate de que:
   - **"Use the WSL 2 based engine"** esté habilitado (recomendado)
   - **"File sharing"** esté configurado si es necesario
5. Aplica los cambios y reinicia Docker Desktop

### Solución 5: Usar Docker sin Docker Desktop (Linux en WSL)

Si tienes WSL2 instalado:

1. Abre **PowerShell como Administrador**
2. Instala el motor de Docker para WSL2:
   ```powershell
   wsl --update
   ```
3. Verifica la instalación:
   ```powershell
   docker version
   docker-compose --version
   ```

---

## ✅ Verificar que Docker funciona

Una vez que Docker esté funcionando:

```powershell
# Verificar versión de Docker
docker version

# Verificar versión de docker-compose
docker-compose --version

# Listar contenedores corriendo
docker ps

# Verificar que Docker Engine está accesible
docker info
```

Si estos comandos funcionan, Docker está listo.

---

## 🚀 Una vez que Docker esté funcionando

### Levantar los servicios del vCenter Provisioner

**Opción recomendada (automática):**
```powershell
cd "/path/a/tu/proyecto/vcenter-provisioner"
.\pipeline.ps1 --up
```

**Opción manual:**
```powershell
cd "C:\Users\Juan Pablo Madriaga\Documents\antigravity\projects\vcenter-provisioner\infra\local"
docker-compose up -d
```

### Verificar que los servicios estén corriendo

```powershell
cd "C:\Users\Juan Pablo Madriaga\Documents\antigravity\projects\vcenter-provisioner\infra\local"

# Ver contenedores
docker-compose ps

# Ver logs de todos los servicios
docker-compose logs

# Ver logs de un servicio específico
docker-compose logs api-gateway
docker-compose logs auth-service
```

### Ejecutar verificación completa

```powershell
# Navegar al directorio del proyecto
cd "/path/a/tu/proyecto/vcenter-provisioner"

# Verificar estado con pipeline
.\pipeline.ps1 --status
```

---

## 🌐 Acceso al Sistema

Una vez que Docker esté funcionando y los servicios estén levantados:

- **API Gateway**: http://localhost:3000
- **Auth Service**: http://localhost:3001
- **Typing Service**: http://localhost:8000
- **VM Orchestrator**: http://localhost:8080
- **vCenter Integration**: http://localhost:8081
- **Stats Service**: http://localhost:8001
- **Monitoring Service**: http://localhost:8082
- **Provisioner UI**: http://localhost:5173

### Credenciales de Prueba

- **Usuario**: admin@antigravity.local
- **Contraseña**: admin123

---

## 📋 Checklist

- [ ] Docker Desktop está corriendo (ícono verde en barra de tareas)
- [ ] `docker version` funciona en PowerShell
- [ ] `docker-compose --version` funciona en PowerShell
- [ ] `docker ps` muestra contenedores corriendo
- [ ] `docker-compose ps` muestra servicios del vCenter Provisioner
- [ ] `curl http://localhost:3000/health` retorna 200 OK
- [ ] `curl http://localhost:5173` carga la UI en el navegador

---

## 🔗 Recursos

- **Documentación principal**: [README.md](../README.md)
- **Guía rápida**: [QUICKSTART.md](../QUICKSTART.md)
- [Docker Desktop para Windows](https://www.docker.com/products/docker-desktop/)
- [Documentación de Docker Compose](https://docs.docker.com/compose/)
- [Documentación de PowerShell para Docker](https://docs.microsoft.com/en-us/powershell/)

---

**Fecha**: 2026-01-31  
**Autor**: Antigravity Staff Engineering  
**Versión**: 1.0  
**Estado**: ✅ Completado
