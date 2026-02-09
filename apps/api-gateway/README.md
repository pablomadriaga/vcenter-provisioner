# API Gateway (Unified Access Hub) 💠

Este microservicio es el único punto de entrada (Single Point of Entry) para el frontend y clientes externos, consolidando la seguridad y el enrutamiento.

## 📋 Responsabilidades
- **Request Proxying**: Enruta peticiones a los servicios de Auth, Typing y Orchestrator de forma transparente.
- **Security Middleware**: Intercepta toda petición protegida y valida el token JWT contra el `auth-service` antes de proceder.
- **CORS Management**: Centraliza las políticas de Cross-Origin Resource Sharing para todo el ecosistema.

## ⚙️ Especificaciones Técnicas
- **Runtime**: Node.js 20 (Fastify)
- **High Performance Proxy**: Utiliza `@fastify/http-proxy` para enrutamiento de baja latencia.
- **Inter-Service Communication**: Protocolo REST/HTTP.

## 🧪 Testing

### Ejecutar Tests
```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests en modo watch
npm run test:watch

# Ejecutar tests con reporte de cobertura
npm run test:coverage
```

### Cobertura de Código
El API Gateway mantiene un **coverage del 80-81%** en lógica crítica:

| Tipo | Cobertura |
|------|-----------|
| Statements | 81.39% |
| Branches | 85.71% |
| Functions | 75% |
| Lines | 80.95% |

### Test Suite
La suite de pruebas incluye **16 tests** que cubren:

- ✅ Health checks (`GET /health`, `GET /`)
- ✅ CORS headers
- ✅ Middleware de autenticación JWT
- ✅ Rechazo de peticiones sin token
- ✅ Rechazo de tokens inválidos
- ✅ Verificación de tokens válidos
- ✅ Propagación de contexto de usuario
- ✅ Configuración de rutas protegidas (typing, orchestrator)
- ✅ Manejo de errores (404, network errors, timeouts)
- ✅ Peticiones concurrentes
- ✅ Manejo de headers de autorización (con y sin prefix "Bearer")
- ✅ Ejecución del middleware antes de rutas protegidas

## 🧪 Estrategia de Verificación
- **Integration Readiness**: El ciclo de vida del Gateway es dependiente de la disponibilidad de los servicios de respaldo (`depends_on` con healthchecks).
- **Validation**: Valida la existencia del header `Authorization` en rutas críticas `/typing/*` y `/provision/*`.

## 📦 Scripts de NPM
```bash
npm run dev          # Inicia el servidor en modo desarrollo
npm run build        # Compila TypeScript a JavaScript
npm start           # Inicia el servidor compilado
npm test            # Ejecuta tests
npm run test:watch  # Ejecuta tests en modo watch
npm run test:coverage # Ejecuta tests con cobertura
```

## 🌐 Endpoints

### Públicos
- `GET /health` - Health check
- `GET /` - Información del servicio
- `POST /auth/*` - Proxy a auth-service (login, register, verify)

### Protegidos (requieren JWT)
- `GET|POST|PUT|DELETE /typing/*` - Proxy a typing-service
- `GET|POST|PUT|DELETE /provision/*` - Proxy a vm-orchestrator

## 🔒 Autenticación
Todas las rutas protegidas requieren un header `Authorization` con un JWT válido:

```http
Authorization: Bearer <jwt-token>
```

El gateway valida el token contra el `auth-service` antes de proxyar la petición.

## 🚀 Variables de Entorno
```bash
PORT=3000
HOST=0.0.0.0
CORS_ALLOWED_ORIGINS=*
AUTH_SERVICE_URL=http://auth-service:3001
TYPING_SERVICE_URL=http://typing-service:8000
ORCHESTRATOR_URL=http://vm-orchestrator:8080
```

---
© 2026 Antigravity Engineering | Governance Layer
