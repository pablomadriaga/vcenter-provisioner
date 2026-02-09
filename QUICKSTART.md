# Guía Rápida: Levantar vCenter VM Provisioner con Docker

> ⚠️ **IMPORTANTE**: Esta es la guía rápida para levantar el sistema. Para documentación completa del proyecto, arquitectura, testing y más, ver **[README.md](./README.md)**.

---

## 🚀 Levantar todos los servicios (comando único - RECOMENDADO)

```powershell
# Navegar al directorio del proyecto
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner"

# Levantar todos los servicios
.\pipeline.ps1 --up
```

Esto levanta todos los servicios:
- ✅ PostgreSQL Database (puerto 5432)
- ✅ API Gateway (puerto 3000)
- ✅ Auth Service (puerto 3001)
- ✅ Typing Service (puerto 8000)
- ✅ VM Orchestrator (puerto 8080)
- ✅ vCenter Integration (puerto 8081)
- ✅ Stats Service (puerto 8001)
- ✅ Monitoring Service (puerto 8082)
- ✅ Backup Service (puerto 8002)
- ✅ Provisioner UI (puerto 5173)

---

## 🌐 URLs de Acceso

### APIs
- **API Gateway**: http://localhost:3000
- **Auth Service**: http://localhost:3001
- **Typing Service**: http://localhost:8000
- **VM Orchestrator**: http://localhost:8080
- **vCenter Integration**: http://localhost:8081
- **Stats Service**: http://localhost:8001
- **Monitoring Service**: http://localhost:8082
- **Backup Service**: http://localhost:8002

### UI
- **Provisioner UI**: http://localhost:5173

### Health Checks
```powershell
# Verificar que los servicios están corriendo
curl http://localhost:3000/health    # API Gateway
curl http://localhost:3001/health    # Auth Service
curl http://localhost:8000/health    # Typing Service
curl http://localhost:8080/health    # VM Orchestrator
curl http://localhost:8081/health    # vCenter Integration
curl http://localhost:8001/health    # Stats Service
curl http://localhost:8082/health    # Monitoring Service
curl http://localhost:8002/health    # Backup Service
```

---

## 🧪 Ejecutar Tests

### Unit Tests (solo backend)
```powershell
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner"
.\pipeline.ps1 --test
```

### Integration Tests (requiere servicios levantados)
```powershell
# Usando pipeline unificado
.\pipeline.ps1 --up && .\pipeline.ps1 --test
```

---

## 🎨 Probar la UI Moderna

La UI ahora tiene un diseño moderno con:
- ✨ Floating Action Button con Speed Dial (esquina inferior derecha)
- ❤️ Rating con corazones rojos (5 corazones, color #ef4444)
- 🏷 Multiple Select con Chips codificados por tipo (Manual, Auto, Fijo)
- 📊 Slider con labels siempre visibles (1-10)
- 🎨 Chips con colores codificados (Rojo, Azul, Verde, etc.)
- 🏷️ Badge con gradiente de color
- ⭐ Icons modernos consistentes
- 🎯 Vertical Stepper con botones y pasos
- ✨ Cards con Glassmorphism y gradientes
- 🎨 Hover effects sutiles y animaciones suaves

**Para probar la UI:**
```powershell
# Abrir en el navegador
http://localhost:5173

# Login con:
# Usuario: admin
# Contraseña: password123

# Navegar a /typifications
# Probar las nuevas características modernas de diseño
#   - Floating Action Button con Speed Dial
#   - Rating con corazones rojos
#   - Multiple Select con Chips
#   - Slider con labels siempre visibles
#   - Chips con colores codificados
#   - Badge con gradiente
# - Icons modernos
#   - Vertical Stepper con botones
#   - Cards con Glassmorphism y gradientes
#   - Hover effects y animaciones
#   - Favoritos
#   - Filtros
#   - Empty states
#   - Loading states
```

---

## 🔄 Actualizar Versiones - MUY IMPORTANTE

### 🚨 PROBLEMA CRÍTICO

**¿Sientes que a pesar de actualizar la versión en `package.json` y `docker-compose.yml`, los cambios NO se aplican?**

**Causa raíz:**
```powershell
# ❌ ESTE COMANDO NO RECONSTRUYE LA IMAGEN
docker-compose up -d

# Docker usa el caché de imágenes y NO reconstruye
# El contenedor sigue ejecutándose la VERSIÓN ANTIGUA
```

**Por qué pasa:**
1. `docker-compose up -d` solo inicia contenedores con imágenes EXISTENTES
2. El campo `image: nombre:versión` en `docker-compose.yml` es solo una ETIQUETA
3. **NO forza la reconstrucción** de la imagen Docker
4. Si la imagen existe en caché local, Docker la reusará

---

### ✅ SOLUCIÓN CORRECTA (SIEMPRE)

**Opción 1: Script de deployment (RECOMENDADO)**
```powershell
# Pipeline unificado con caching inteligente:
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner"
.\pipeline.ps1 --build
```

**Opción 2: Comando manual correcto (desde directorio del proyecto)**
```powershell
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner\infra\local"

# RECOMENDADO: Siempre usar --build para actualizar versiones
docker-compose up -d --build provisioner-ui
```

**Opción 3: Proceso manual completo (si el comando anterior falla)**
```powershell
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner\infra\local"

# 1. Detener y eliminar contenedor viejo
docker-compose stop provisioner-ui
docker-compose rm provisioner-ui

# 2. Eliminar imagen vieja (opcional pero recomendado)
docker rmi antigravity/provisioner-ui:versión-vieja

# 3. Reconstruir imagen (IMPORTANTE: sin caché)
docker-compose build --no-cache provisioner-ui

# 4. Levantar nuevo contenedor
docker-compose up -d --build provisioner-ui
```

---

### 🔍 CÓMO VERIFICAR LA VERSIÓN DESPLEGADA

**Método 1: Script de verificación**
```powershell
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner"
.\pipeline.ps1 --status

# Salida esperada:
# 📦 Version: 0.1.2
# 🐳 Container: provisioner-ui-v0.1.2
# ✅ Services running: All healthy
```

**Método 2: Verificar labels de la imagen**
```powershell
docker inspect antigravity/provisioner-ui:0.1.2 --format='{{.Config.Labels.version}}'
```

**Método 3: Verificar versión en el contenedor**
```powershell
docker exec provisioner-ui-v0.1.2 cat /usr/share/nginx/html/package.json | grep version
```

---

### ❌ NUNCA HAGAS ESTO DESPUÉS DE ACTUALIZAR VERSIÓN

```powershell
# ❌ INCORRECTO - NO reconstruye la imagen
docker-compose up -d

# ❌ INCORRECTO - Puede usar caché
docker-compose up -d --build

# ❌ INCORRECTO - No elimina imagen vieja
docker-compose stop provisioner-ui
docker-compose rm provisioner-ui
docker-compose up -d
```

---

## 📋 CHECKLIST PARA ACTUALIZACIONES DE VERSIÓN

Cuando actualices la versión de un servicio:

- [ ] ✅ Actualizar `version` en `package.json`
- [ ] ✅ Actualizar `image: nombre:version` en `docker-compose.yml`
- [ ] ✅ Actualizar `container_name` en `docker-compose.yml`
- [ ] ✅ Actualizar `ARG VERSION` en `Dockerfile` (si aplica)
- [ ] ✅ **CRÍTICO**: Ejecutar script de deployment (desde CUALQUIER directorio)
- [ ] ✅ **CRÍTICO**: Siempre usar `--build` cuando se hace `docker-compose up`
- [ ] ✅ Verificar versión desplegada
- [ ] [ ] ✅ Probar los cambios en el navegador
- [ ] [ ] ✅ Actualizar `CHANGELOG.md`

---

### 📚 Documentación Adicional

Para más detalles sobre versionamiento y despliegue, consulta:
- **[CHANGELOG.md](./CHANGELOG.md)** - Historial de versiones
- **[docs/CI-CD-LOCAL.md](./docs/CI-CD-LOCAL.md)** - Documentación del pipeline
- **[docs/dos-and-donts-playbook.md](./docs/dos-and-donts-playbook.md)** - Guía de comandos

---

## 🧪 Ejecutar Tests

```powershell
# Navegar al directorio del proyecto
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner\infra\local"

# Levantar todos los servicios
docker-compose up -d
```

Esto levanta todos los servicios:
- ✅ PostgreSQL Database (puerto 5432)
- ✅ API Gateway (puerto 3000)
- ✅ Auth Service (puerto 3001)
- ✅ Typing Service (puerto 8000)
- ✅ VM Orchestrator (puerto 8080)
- ✅ vCenter Integration (puerto 8081)
- ✅ Stats Service (puerto 8001)
- ✅ Monitoring Service (puerto 8082)
- ✅ Backup Service (puerto 8002)
- ✅ Provisioner UI (puerto 5173)

---

## 🌐 URLs de Acceso

### APIs
- **API Gateway**: http://localhost:3000
- **Auth Service**: http://localhost:3001
- **Typing Service**: http://localhost:8000
- **VM Orchestrator**: http://localhost:8080
- **vCenter Integration**: http://localhost:8081
- **Stats Service**: http://localhost:8001
- **Monitoring Service**: http://localhost:8082
- **Backup Service**: http://localhost:8002

### UI
- **Provisioner UI**: http://localhost:5173

### Health Checks
```powershell
# Verificar que los servicios están corriendo
curl http://localhost:3000/health    # API Gateway
curl http://localhost:3001/health    # Auth Service
curl http://localhost:8000/health    # Typing Service
curl http://localhost:8080/health    # VM Orchestrator
curl http://localhost:8081/health    # vCenter Integration
curl http://localhost:8001/health    # Stats Service
curl http://localhost:8082/health    # Monitoring Service
```

---

## 🧪 Ejecutar Tests

### Unit Tests (solo backend)
```powershell
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner"
.\pipeline.ps1 --test
```

### Integration Tests (requiere servicios levantados)
```powershell
# Usando pipeline unificado
.\pipeline.ps1 --up && .\pipeline.ps1 --test
```

### 🎨 Probar la UI Moderna

La UI ahora tiene un diseño moderno con:
- ✨ Floating Action Button con Speed Dial (esquina inferior derecha)
- ❤️ Rating con corazones rojos (5 corazones, color #ef4444)
- 🏷 Multiple Select con Chips codificados por tipo (Manual, Auto, Fijo)
- 📊 Slider con labels siempre visibles (1-10)
- 🎨 Chips con colores codificados (Rojo, Azul, Verde, etc.)
- 🏷️ Badge con gradiente de color
- ⭐ Icons modernos consistentes
- 🎯 Vertical Stepper con botones y pasos
- ✨ Cards con Glassmorphism y gradientes
- 🎨 Hover effects sutiles y animaciones suaves

**Para probar la UI:**
```powershell
# Abrir en el navegador
http://localhost:5173

# Login con:
# Usuario: admin@antigravity.local
# Contraseña: admin123

# Navegar a /typifications
# Probar las nuevas características modernas de diseño
```

### Integration Tests (requiere servicios levantados)
```powershell
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner"

# Opción 1: Levantar servicios, ejecutar tests, detener servicios
pwsh -File run-integration-tests.ps1 -StopAfter

# Opción 2: Ejecutar tests solo (si servicios ya están corriendo)
pwsh -File run-integration-tests.ps1 -SkipDocker
```

### E2E Tests (requiere servicios levantados)
```powershell
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner"

# Primero, instalar Playwright browsers (solo la primera vez)
cd apps\provisioner-ui
npm install
npx playwright install --with-deps

# Ejecutar tests E2E
cd ..\..
pwsh -File run-e2e-tests.ps1 -StopAfter
```

### Performance Tests (requiere servicios levantados)
```powershell
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner"

# Authentication Load Test
pwsh -File run-perf-tests.ps1 -TestType auth -StopAfter

# Provisioning Load Test
pwsh -File run-perf-tests.ps1 -TestType provision -StopAfter

# Full Flow Load Test
pwsh -File run-perf-tests.ps1 -TestType full-flow -StopAfter
```

### Security Tests (requiere servicios levantados)
```powershell
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner"

# Requisitos: Instalar OWASP ZAP y zap-cli

# Ejecutar todos los tests de seguridad
pwsh -File run-security-tests.ps1 -StopAfter

# Solo dependency audit (no requiere servicios)
pwsh -File security-tests\run-dependency-audit.ps1
```

### Accessibility Tests (requiere servicios levantados)
```powershell
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner"

# Ejecutar todos los tests de accesibilidad
pwsh -File run-accessibility-tests.ps1 -StopAfter
```

---

## 🔧 Comandos Útiles

### Ver logs de un servicio
```powershell
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner\infra\local"

# Ver todos los logs
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f api-gateway
docker-compose logs -f auth-service
docker-compose logs -f vm-orchestrator
docker-compose logs -f provisioner-ui
```

### Reiniciar un servicio
```powershell
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner\infra\local"

# Reiniciar un servicio específico
docker-compose restart api-gateway
docker-compose restart auth-service

# Reconstruir y reiniciar
docker-compose up -d --build api-gateway
```

### Detener todos los servicios
```powershell
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner\infra\local"

# Detener servicios
docker-compose down

# Detener y eliminar volúmenes (eliminar base de datos)
docker-compose down -v

# Detener, eliminar volúmenes y imágenes
docker-compose down -v --rmi all
```

### Verificar estado de servicios
```powershell
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner\infra\local"

# Ver qué servicios están corriendo
docker-compose ps

# Ver recursos utilizados
docker stats
```

### Opción alternativa: Usar el pipeline unificado
```powershell
# Desde el directorio raíz del proyecto
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner"

# Levantar servicios automáticamente y verificar que funcionan
.\pipeline.ps1 --up

# Verificar estado
.\pipeline.ps1 --status

# O para detener servicios
.\pipeline.ps1 --down
```

---

## 🐛 Solución de Problemas

### La UI no carga en http://localhost:5173/

**Síntoma:**
- `docker-compose up -d` muestra que los contenedores iniciaron
- Pero http://localhost:5173/ no responde o muestra "Empty reply from server"
- El contenedor `provisioner-ui` puede mostrar `Up (unhealthy)`

**Causas comunes:**
1. Errores de mapeo de puertos en `docker-compose.yml`
2. Configuración incorrecta de nginx en `nginx.conf`
3. Health check incorrecto en `Dockerfile`

**Solución:**

1. **Verificar estado del contenedor:**
   ```powershell
   cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner\infra\local"
   docker-compose ps provisioner-ui
   ```

2. **Si el contenedor está `unhealthy`, reconstruirlo:**
   ```powershell
   cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner\infra\local"
   docker-compose up -d --build provisioner-ui
   ```

3. **Verificar que responde:**
   ```powershell
   curl http://localhost:5173/
   curl http://localhost:5173/health
   ```

4. **Ver logs para errores:**
   ```powershell
   docker-compose logs provisioner-ui --tail=50
   ```

**Para más detalles, ver:** [docs/DOCKER-LESSONS-LEARNED.md](docs/DOCKER-LESSONS-LEARNED.md)

---

### Los servicios no se inician
```powershell
# Ver logs de Docker
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner\infra\local"
docker-compose logs

# Reconstruir contenedores desde cero
docker-compose down -v
docker-compose up -d --build
```

### Puertos ya están en uso
```powershell
# Ver qué está usando el puerto
netstat -ano | findstr ":3000"
netstat -ano | findstr ":5173"

# O usar PowerShell
Get-NetTCPConnection -LocalPort 3000
Get-NetTCPConnection -LocalPort 5173
```

### Error de conexión a la base de datos
```powershell
# Verificar que PostgreSQL está listo
docker-compose logs db | Select-String "ready to accept connections"

# Reiniciar servicio de base de datos
docker-compose restart db
```

### El UI no se conecta al API
```powershell
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner\infra\local"

# 1. Verificar que el Gateway está corriendo
curl http://localhost:3000/health

# 2. Verificar logs del UI
docker-compose logs provisioner-ui

# 3. Verificar configuración de entorno
docker-compose exec provisioner-ui printenv VITE_API_URL
```

### Puertos ya están en uso
```powershell
# Ver qué está usando el puerto
netstat -ano | findstr ":3000"
netstat -ano | findstr ":5173"

# O usar PowerShell
Get-NetTCPConnection -LocalPort 3000
Get-NetTCPConnection -LocalPort 5173
```

### Error de conexión a la base de datos
```powershell
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner\infra\local"

# Verificar que PostgreSQL está listo
docker-compose logs db | Select-String "ready to accept connections"

# Reiniciar servicio de base de datos
docker-compose restart db
```

### El UI no se conecta al API
```powershell
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner\infra\local"

# 1. Verificar que el Gateway está corriendo
curl http://localhost:3000/health

# 2. Verificar logs del UI
docker-compose logs provisioner-ui

# 3. Verificar configuración de entorno
docker-compose exec provisioner-ui printenv VITE_API_URL
```

---

## ✅ Verificación Docker Compose

### Verificar Estado de Servicios
```powershell
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner\infra\local"
docker-compose ps
```

**Esperado:** Todos los servicios en estado "healthy" o "Up"

### Verificar Endpoints
```powershell
# Todos los health checks
curl http://localhost:3000/health    # Gateway
curl http://localhost:3001/health    # Auth
curl http://localhost:8000/health    # Typing
curl http://localhost:8080/health    # Orchestrator

# Verificar respuesta de UI
curl http://localhost:5173/ | head -5
```

### Verificar Login
```powershell
curl -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'
```

**Esperado:** JSON con `token` y `user`

### Verificar API a través del Gateway
```powershell
# Obtener token
$TOKEN = (curl -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@antigravity.local","password":"admin123"}' | \
  jq -r '.token')

# Listar VM Classes
curl http://localhost:3000/vm-classes

# Listar Templates
curl -X GET http://localhost:3000/typing/templates \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📊 Flujo de Trabajo Completo

### 1. Desarrollo Local
```powershell
# Levantar servicios
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner"
.\pipeline.ps1 --up

# En otra terminal, correr tests unitarios
.\pipeline.ps1 --test
```

### 2. Pruebas de Integración
```powershell
# Levantar servicios y verificar
.\pipeline.ps1 --up

# Ejecutar tests de integración
.\pipeline.ps1 --test
```

### 3. Pruebas E2E
```powershell
# Levantar servicios y verificar
.\pipeline.ps1 --up

# Ejecutar tests E2E (requiere configuración adicional)
cd apps\provisioner-ui
npm install
npx playwright install --with-deps
cd ..\..
# Ejecutar E2E tests

# Abrir UI en el navegador para pruebas manuales
# http://localhost:5173
```

### 4. Pruebas de Performance
```powershell
# Levantar servicios y verificar
.\pipeline.ps1 --up

# Ejecutar tests de performance
.\pipeline.ps1 --test
```

### 5. Pruebas de Seguridad
```powershell
# Levantar servicios y verificar
.\pipeline.ps1 --up

# Ejecutar dependency audit (no requiere servicios levantados)
# Scripts de seguridad en security-tests/

# Ejecutar OWASP ZAP scan (servicios ya están levantados)
```

### 6. Pruebas de Accesibilidad
```powershell
# Levantar servicios y verificar
.\pipeline.ps1 --up

# Ejecutar tests de accesibilidad
.\pipeline.ps1 --test
```

---

## 📝 Notas Importantes

### Usuario de Prueba por Defecto
- **Username**: admin
- **Password**: password123
- **Role**: admin

Este usuario se crea automáticamente al levantar los servicios (ver `infra/local/init.sql`).

### Base de Datos
- **Base de datos**: PostgreSQL 15 Alpine
- **Usuario**: antigravity
- **Contraseña**: password123
- **Nombre**: vcenter_provisioner
- **Puerto**: 5432

### vCenter Integration
- Está en modo **MOCK** por defecto
- No requiere conexión real a vCenter
- Los requests se simulan con respuestas mockeadas

---

## 🎯 Próximos Pasos

1. **Levantar servicios**:
    ```powershell
    .\pipeline.ps1 --up
    ```

2. **Verificar health checks**:
    ```powershell
    .\pipeline.ps1 --status
    ```

3. **Abrir UI**:
    ```
    http://localhost:5173
    ```

4. **Ejecutar tests**:
    ```powershell
    .\pipeline.ps1 --test
    ```

5. **Ver documentación completa**:
    ```
    Ver README.md para arquitectura, testing plan, troubleshooting y más
    ```

---

**Fecha**: 2026-01-31  
**Autor**: vCenter Provisioner Team  
**Versión**: 1.0  
**Estado**: ✅ Completado
