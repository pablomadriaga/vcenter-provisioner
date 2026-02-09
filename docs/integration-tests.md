# Integration Tests - Semana 2

Este documento describe los tests de integración implementados para el vCenter Provisioner como parte de la Semana 2 del plan de testing.

## 🎯 Objetivo

Validar la comunicación entre servicios y los flujos end-to-end del sistema, asegurando que todos los componentes trabajen correctamente en conjunto.

## 🏗 Arquitectura de Tests

Los tests de integración están organizados en las siguientes categorías:

### 1. Gateway ↔ Auth Integration
Prueba la autenticación completa a través del API Gateway:
- Registro de usuarios
- Login con credenciales válidas
- Verificación de tokens JWT
- Rechazo de tokens inválidos
- Protección de rutas sin autenticación

### 2. Gateway → Typing Service (con Auth)
Prueba el acceso al servicio de tipificación con autenticación:
- Health check con token válido
- Creación de templates de tipificación
- Listado de templates

### 3. Gateway → Orchestrator (con Auth)
Prueba el flujo de orquestación de VMs:
- Acceso a endpoint de status
- Envío de solicitudes de aprovisionamiento
- Consulta de estado de jobs

### 4. Full End-to-End Flow
Prueba el flujo completo del sistema:
1. Registro de usuario
2. Login y obtención de token
3. Creación de template de tipificación
4. Envío de solicitud de aprovisionamiento
5. Consulta de estado del job

### 5. Error Handling
Prueba el manejo de errores en la integración:
- Fallos de autenticación
- Solicitudes inválidas
- Servicios no disponibles

### 6. Concurrent Requests
Prueba la capacidad de manejar múltiples solicitudes concurrentes:
- 5 solicitudes de aprovisionamiento simultáneas
- Verificación de que todas sean procesadas correctamente

## 🚀 Ejecución de Tests

### Requisitos Previos

1. **Docker y Docker Compose** instalados
2. **Node.js** y **npm** instalados
3. Los servicios deben estar disponibles en:
   - API Gateway: http://localhost:3000
   - Auth Service: http://localhost:3001
   - Typing Service: http://localhost:8000
   - VM Orchestrator: http://localhost:8080

### Ejecución Automática (Recomendado)

El script `run-integration-tests.ps1` automatiza todo el proceso:

```powershell
# Inicia servicios, ejecuta tests, y detiene servicios
pwsh -File run-integration-tests.ps1 -StopAfter

# Ejecuta tests sin iniciar servicios (si ya están corriendo)
pwsh -File run-integration-tests.ps1 -SkipDocker

# Ejecución con output detallado
pwsh -File run-integration-tests.ps1 -Verbose
```

### Ejecución Manual

1. **Iniciar servicios** (opción recomendada):
    ```powershell
    # Pipeline unificado
    .\pipeline.ps1 --up

    # Opción 2: Manual (requiere navegar al directorio infra/local)
    cd infra/local
    docker-compose up -d
    ```

2. **Esperar que los servicios inicien** (~10-15 segundos)

3. **Ejecutar tests:**
    ```powershell
    cd apps/api-gateway
    npm test -- integration-real.test.ts
    ```

4. **Detener servicios** (opcional):
    ```powershell
    cd infra/local
    docker-compose down
    ```

## 📊 Resultados Esperados

Todos los tests deben pasar (exit code 0):

```
✓ Gateway ↔ Auth Integration (5 tests)
✓ Gateway → Typing Service (3 tests)
✓ Gateway → Orchestrator (2 tests)
✓ Full End-to-End Flow (1 test)
✓ Error Handling (2 tests)
✓ Concurrent Requests (1 test)

Total: 14 integration tests
```

## 🔍 Debugging

### Ver logs de servicios

```powershell
# Ver todos los logs
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f api-gateway
docker-compose logs -f auth-service
docker-compose logs -f vm-orchestrator
```

### Verificar que un servicio está respondiendo

```powershell
# Gateway
curl http://localhost:3000/health

# Auth Service
curl http://localhost:3001/health

# Typing Service
curl http://localhost:8000/health

# VM Orchestrator
curl http://localhost:8080/health
```

### Tests fallidos

Si los tests fallan, verifica:

1. **Servicios iniciados**: `docker-compose ps`
2. **Logs de errores**: `docker-compose logs`
3. **Conectividad**: Accede a los health checks manualmente
4. **Variables de entorno**: Verifica que las URLs de servicios sean correctas

## 📝 Consideraciones

### Base de Datos

Los tests de integración usan PostgreSQL en Docker. La base de datos se inicializa automáticamente con el script `init.sql`.

### Usuarios de Test

Cada test crea usuarios únicos usando timestamps para evitar conflictos:
- `integrationtest_${timestamp}`
- `integrationtest_login_${timestamp}`
- `fullflow_${timestamp}`
- `concurrent_${timestamp}`

### Limpieza

Los tests NO limpian automáticamente:
- Usuarios creados en la base de datos
- Templates de tipificación creados
- Jobs de aprovisionamiento creados

Para limpiar completamente:
```powershell
# Detener servicios y eliminar volúmenes
cd infra/local
docker-compose down -v
```

## 🎯 Próximos Pasos (Semana 3)

### E2E Tests con Playwright
- Tests de UI con navegación real del navegador
- Flujos completos desde el formulario de login hasta el dashboard

### Performance Testing
- Pruebas de carga con k6
- Medición de latencia de APIs
- Simulación de 10/50/200 usuarios concurrentes

## 📈 Métricas

| Métrica | Valor |
|---------|-------|
| Total Integration Tests | 14 |
| Tiempo de Ejecución | ~15-30s |
| Servicios Requeridos | 4 (Gateway, Auth, Typing, Orchestrator) |
| Cobertura de Flujos | 100% (login, create template, provision, status) |

---

**Fecha:** 2026-01-31  
**Autor:** Antigravity Staff Engineering  
**Versión:** 1.0  
**Estado:** ✅ Completado
