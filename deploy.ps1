# Docker Deployment Script - vCenter Provisioner

Este script automatiza el proceso de despliegue asegurando que las imágenes Docker
se reconstruyan correctamente con las nuevas versiones.

**REGLA DE ORO:** Siempre usar `--build` al actualizar versiones

## Usage

```powershell
# Desplegar o actualizar un servicio específico
.\deploy.ps1 -Service provisioner-ui

# Desplegar todos los servicios
.\deploy.ps1

# Reconstruir sin caché (más lento pero garantiza cambios)
.\deploy.ps1 -NoCache

# Forzar reconstrucción específica
.\deploy.ps1 -ForceRebuild -Service provisioner-ui

# Verificar versión desplegada
.\deploy.ps1 -VerifyVersion
```

## Parameters

| Parameter | Alias | Description | Default |
|-----------|--------|-------------|---------|
| `-Service` | `-s` | Nombre del servicio a desplegar | All services |
| `-NoCache` | `-nc` | Reconstruir sin usar caché de Docker | `$false` |
| `-ForceRebuild` | `-fr` | Forzar reconstrucción de imágenes | `$false` |
| `-VerifyVersion` | `-vv` | Solo verificar versión desplegada | `$false` |
| `-StopAfter` | `-sa` | Detener contenedores después del despliegue | `$false` |
| `-Verbose` | `-v` | Mostrar salida detallada | `$false` |

## Examples

### Example 1: Actualizar UI service después de version bump
```powershell
# Este script garantiza que la nueva versión se use
.\deploy.ps1 -Service provisioner-ui -ForceRebuild

# Salida esperada:
# ✅ Detecting version 0.1.1 for provisioner-ui
# ✅ Stopping container provisioner-ui-v0.1.0
# ✅ Removing container provisioner-ui-v0.1.0
# ✅ Removing image antigravity/provisioner-ui:0.1.0 (if exists)
# ✅ Building image antigravity/provisioner-ui:0.1.1...
# ✅ Starting container provisioner-ui-v0.1.1
# ✅ Health check passed
# ✅ Deployment successful!
```

### Example 2: Desplegar todos los servicios
```powershell
.\deploy.ps1
```

### Example 3: Reconstruir sin caché (para cambios profundos)
```powershell
.\deploy-ps1 -NoCache
```

### Example 4: Verificar versión actual
```powershell
.\deploy.ps1 -VerifyVersion -Service provisioner-ui

# Salida:
# 📦 Image Version: 0.1.1
# 🏷️ Image Tag: antigravity/provisioner-ui:0.1.1
# 🐳 Container Name: provisioner-ui-v0.1.1
# ✅ Version verified: MATCHES docker-compose.yml
```

## Workflow

### 1. Version Detection
- Lee `package.json` de cada servicio
- Detecta versión actual
- Compara con imagen Docker existente

### 2. Pre-Deployment
- Verifica que Docker esté ejecutándose
- Detiene contenedores existentes
- Elimina imágenes viejas (si coincide versión)

### 3. Build
- Ejecuta `docker-compose build` con flags apropiados
- Usa `--no-cache` si se especifica

### 4. Deploy
- Levanta contenedores con nueva imagen
- Ejecuta health checks
- Verifica versión desplegada

### 5. Verification
- Confirma que contenedor está healthy
- Verifica que la URL responda
- Muestra resumen del despliegue

## Important Notes

### Why This Script is Necessary

**Problem:** `docker-compose up -d` NO reconstruye imágenes automáticamente
- Docker usa caché de imágenes
- Cambios en código o version no forzan reconstrucción
- Contenedores viejos siguen ejecutándose con imágenes obsoletas

**Solution:** This script ensures proper deployment
- Siempre usa `--build` o `--no-cache`
- Elimina contenedores e imágenes viejas
- Verifica versión desplegada
- Provee feedback claro del proceso

### Version Management

Cuando actualizas una versión en `package.json`, sigue estos pasos:

```powershell
# 1. Update version in package.json
#    version: "0.1.0" -> "0.1.1"

# 2. Update docker-compose.yml
#    image: antigravity/provisioner-ui:0.1.1
#    container_name: provisioner-ui-v0.1.1

# 3. Update Dockerfile (if needed)
#    ARG VERSION=0.1.1

# 4. Deploy with this script (SIEMPRE)
.\deploy.ps1 -Service provisioner-ui -ForceRebuild
```

### NEVER Do This After Version Update

```powershell
# ❌ INCORRECTO - NO reconstruye la imagen
docker-compose up -d

# ❌ INCORRECTO - Puede usar imagen en caché
docker-compose up -d --build service-name

# ❌ INCORRECTO - No elimina imagen vieja
docker-compose stop service-name
docker-compose rm service-name
docker-compose up -d
```

### ALWAYS Do This After Version Update

```powershell
# ✅ CORRECTO - Usa script de despliegue
.\deploy.ps1 -Service provisioner-ui -ForceRebuild

# ✅ CORRECTO - Manual pero completo
docker-compose build --no-cache provisioner-ui
docker-compose stop provisioner-ui
docker-compose rm provisioner-ui
docker rmi antigravity/provisioner-ui:old-version
docker-compose up -d --build provisioner-ui
```

## Error Handling

### Common Errors

**Error:** `Container already exists`
```powershell
# Solución: Script lo maneja automáticamente
.\deploy.ps1 -ForceRebuild
```

**Error:** `Image not found`
```powershell
# Solución: Reconstruir sin caché
.\deploy.ps1 -NoCache
```

**Error:** `Port already in use`
```powershell
# Solución: Detener contenedores que usan el puerto
docker ps --filter "publish=5173"
docker stop <container-id>
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy Services
        run: ./deploy.ps1 -NoCache -Service provisioner-ui
```

### Jenkins Example

```groovy
node {
    stage('Deploy') {
        sh './deploy.ps1 -NoCache -Service provisioner-ui'
    }
}
```

## Troubleshooting

### Version Mismatch

Si detectas que la versión no cambió:

```powershell
# 1. Verificar versión en package.json
cat apps/provisioner-ui/package.json | grep version

# 2. Verificar versión en docker-compose.yml
cat infra/local/docker-compose.yml | grep provisioner-ui

# 3. Verificar versión de imagen Docker
docker images | grep provisioner-ui

# 4. Verificar versión del contenedor
docker inspect provisioner-ui-v0.1.1 | grep version

# 5. Forzar despliegue limpio
.\deploy.ps1 -NoCache -ForceRebuild
```

### Image Cache Issues

Si Docker usa caché incorrectamente:

```powershell
# Limpiar todo el caché de Docker
docker system prune -a --volumes

# Reconstruir todo
.\deploy.ps1 -NoCache
```

## Best Practices

1. **SIEMPRE** usa este script después de actualizar versiones
2. **SIEMPRE** verifica la versión desplegada con `-VerifyVersion`
3. **NUNCA** uses `docker-compose up -d` solo después de cambios de versión
4. **SIEMPRE** commit tanto `package.json` como `docker-compose.yml` juntos
5. **REVISAR** CHANGELOG.md antes de cada deployment
6. **TESTAR** en staging antes de producción

## Scripts Alternativos

Para verificación rápida:
```powershell
# Ver versión de todos los servicios
.\deploy.ps1 -VerifyVersion

# Ver versión de un servicio específico
.\deploy.ps1 -VerifyVersion -Service provisioner-ui
```

Para despliegue completo:
```powershell
# Desplegar todo el stack
.\deploy.ps1

# Desplegar sin caché (recomendado para producción)
.\deploy.ps1 -NoCache
```

---

**Version:** 1.0.0
**Created:** 2026-02-01
**Maintainer:** Antigravity Staff Engineering

---

© 2026 Antigravity Engineering | Docker Deployment Script
