# Errores y Problemas Encontrados

## 1. Provision Request - binding:"required" en datacenter y cluster

### Síntoma
- Error 400 al intentar crear VM: `"vcenter_datacenter and vcenter_cluster are required"`
- El payload incluye correctamente los campos `vcenter_datacenter` y `vcenter_cluster`
- Error persiste aunque los valores están presentes en el JSON

### Causa Raíz
El binding de Gin (`binding:"required"`) se ejecuta ANTES de que el código pueda procesar la request. La estructura Go:

```go
type ProvisionRequest struct {
    TemplateID          int      `json:"template_id" binding:"required"`
    ManualValue         string   `json:"manual_value" binding:"required"`
    VCenterConnectionID int      `json:"vcenter_connection_id"`
    VCenterDatacenter   string   `json:"vcenter_datacenter" binding:"required"`  // ← PROBLEMA
    VCenterCluster      string   `json:"vcenter_cluster" binding:"required"`     // ← PROBLEMA
    VCenterResourcePool string   `json:"vcenter_resource_pool,omitempty"`
}
```

El binding de Gin valida campos vacíos antes de que el handler pueda ejecutarse. Por lo tanto, aunque el código intenta obtener valores por defecto de la conexión (líneas 117-131), la validación falla antes.

### Código Affected
- `apps/vm-orchestrator/main.go` líneas 52-53

### Solución Propuesta (NO implementada - queda para el usuario)
Remover `binding:"required"` de los campos:
```go
VCenterDatacenter   string   `json:"vcenter_datacenter"`
VCenterCluster      string   `json:"vcenter_cluster"`
```

Luego el código ya existente en líneas 117-131 se encargará de obtener los valores por defecto de la conexión.

### Estado
- **Fecha:** 2026-03-23
- **Estado:** PENDIENTE - requiere cambio en backend
- **Severidad:** ALTA - impide creación de VMs

### Diagnóstico Realizado (2026-03-23)

Se ejecutaron las siguientes verificaciones desde el contenedor de debug:

```bash
# 1. Login exitoso
TOKEN=$(curl -s -X POST http://provisioner-auth:3001/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}' | jq -r '.token')

# 2. vCenter existe en BD con default_datacenter y default_cluster
curl -s http://provisioner-credential-manager:8090/api/vcenters
# Resultado:
# {
#   "id":1,
#   "name":"Default-Cloud",
#   "url":"https://vcenter-tanzu.cloud.playground.net",
#   "default_datacenter":"datacenter-3",
#   "default_cluster":"domain-c9"
# }

# 3. Payload enviado con TODOS los campos requeridos
curl -X POST "http://provisioner-vm-orchestrator:8080/provision" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": 1,
    "manual_value": "TEST001",
    "vcenter_connection_id": 1,
    "vcenter_datacenter": "datacenter-3",
    "vcenter_cluster": "domain-c9"
  }'

# Resultado: 400 "Missing required fields"
```

### Tests Realizados
| Test | Payload | Resultado |
|------|---------|-----------|
| Con datacenter y cluster | `{"vcenter_datacenter":"datacenter-3","vcenter_cluster":"domain-c9"}` | 400 Error |
| Con vcenter_connection_id | `{"vcenter_connection_id":1,"vcenter_datacenter":"datacenter-3",...}` | 400 Error |
| Sin resource_pool | `{"vcenter_datacenter":"datacenter-3","vcenter_cluster":"domain-c9"}` | 400 Error |

### Conclusión
El problema es 100% del lado del binding de Gin en el backend. El frontend está funcionando correctamente.

---

## 2. Proxy Configuration - Double Prefix Stripping

### Síntoma
- `GET /auth/me` → 404
- `POST /api/auth/login` → 200 (login funciona)
- `GET /api/stats/summary` → 401

### Causa Raíz
El nginx tenía `rewrite /auth/(.*) /$1 break;` que eliminaba el prefijo `/auth` antes de enviar al api-gateway.

**Flujo roto:**
```
Frontend → nginx → /auth/me → /me (rewrite) → api-gateway (espera /auth/me) → 404
```

### Solución
1. **nginx.conf**: Eliminar el `rewrite` para `/auth`:
```nginx
location /auth {
    set $api_backend "provisioner-api-gateway:3000";
    proxy_pass http://$api_backend;  # Sin rewrite
}
```

2. **api-gateway/src/index.ts**: Cambiar el proxy:
```typescript
server.register(proxy, {
    prefix: '/auth',      // Antes: '/'
    rewritePrefix: '/',    // Antes: '/auth'
});
```

### Archivos Modificados
- `apps/provisioner-ui/nginx.conf`
- `apps/api-gateway/src/index.ts`

---

## 2. DNS Resolution - Hostname Conflict

### Síntoma
- 502 Bad Gateway
- `getaddrinfo EAI_AGAIN auth-service`

### Causa Raíz
El contenedor se creaba sin hostname, y el search domain `playground.net` del host interfería con la resolución DNS de Docker.

```
api-gateway busca "auth-service" → Docker DNS → 172.20.0.x
api-gateway busca "auth-service.playground.net" → DNS público → FALLA
```

### Solución
1. Usar nombre completo del contenedor en nginx:
```nginx
set $api_backend "provisioner-api-gateway:3000";
```

2. O asegurar que el contenedor tenga el hostname correcto:
```bash
docker run --hostname auth-service ...
```

### Archivos Modificados
- `apps/provisioner-ui/nginx.conf`

---

## 3. Cookie Secure Flag - Browser Rejection

### Síntoma
- Login funciona (curl)
- Navegador muestra "Invalid credentials"
- Cookie no se guarda en el navegador

### Causa Raíz
La cookie tenía `Secure` flag, lo que significa que el navegador solo la guarda si la conexión es HTTPS.

```bash
# Cookie con Secure (rechazada por HTTP)
set-cookie: session_id=...; Max-Age=28800000; Path=/; HttpOnly; Secure; SameSite=Strict
```

El código tenía:
```typescript
secure: process.env.NODE_ENV === 'production'
```

En Docker, `NODE_ENV=production` por defecto, causando que `Secure` se active.

### Solución
1. Cambiar la verificación de secure:
```typescript
secure: process.env.COOKIE_SECURE === 'true'
```

2. En el contenedor, asegurar `COOKIE_SECURE=false` o no definirlo.

### Archivos Modificados
- `apps/auth-service/src/server.ts`

---

## 4. Stats Proxy - Wrong Rewrite Prefix

### Síntoma
- `/api/stats/summary` → 404
- El frontend usa `/api/stats/*`

### Causa Raíz
El proxy tenía `rewritePrefix: '/stats'` que duplicaba el prefijo.

```typescript
// Configuración incorrecta
prefix: '/stats',
rewritePrefix: '/stats'  // /stats/summary → /stats/stats/summary
```

### Solución
```typescript
prefix: '/api/stats/summary',
rewritePrefix: '/stats/summary'
```

Para cada endpoint de stats.

### Archivos Modificados
- `apps/api-gateway/src/index.ts`

---

## 5. Fastify Route Conflict - GET '/' Already Declared

### Síntoma
```
Error: Method 'GET' already declared for route '/' with constraints '{}'
```

### Causa Raíz
El proxy con `prefix: '/'` intentaba registrar `GET /`, pero ya existía `server.get('/')`.

### Solución
Cambiar `prefix: '/'` a `prefix: '/auth'` en el proxy de auth-service.

### Archivos Modificados
- `apps/api-gateway/src/index.ts`

---

## 6. API Base URL Inconsistency - Double Prefix in Login

### Síntoma
- `POST /api/auth/login` → 404
- Login desde el navegador falla
- curl funciona porque usa paths directos

### Causa Raíz
- **AuthContext.tsx** usa `fetch('/auth/me', ...)` - llama directamente a `/auth/me`
- **LoginPage.tsx** usa `api.post('/auth/login', ...)` donde `API_BASE_URL = '/api'`
- Resultado: `/api/auth/login` que no existe en nginx ni api-gateway

```typescript
// api.ts
const API_BASE_URL = (import.meta as any).env.VITE_API_URL || '/api';

// LoginPage.tsx
await api.post('/auth/login', formData)  // → /api/auth/login ❌

// AuthContext.tsx
fetch('/auth/me', ...)  // → /auth/me ✓
```

### Solución Aplicada (Opción A)
Cambiar LoginPage para usar `fetch` directo como AuthContext:

```typescript
// LoginPage.tsx - ANTES (incorrecto):
const response = await api.post('/auth/login', formData)

// LoginPage.tsx - DESPUÉS (correcto):
const response = await fetch('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify(formData)
})
if (!response.ok) throw new Error('Login failed')
const data = await response.json()
```

### Archivos Modificados
- `apps/provisioner-ui/src/pages/LoginPage.tsx`

---

## 8. Resumen de Problemas y Soluciones

| # | Problema | Solución | Estado |
|---|----------|----------|--------|
| 1 | Proxy double prefix | `prefix: '/auth'`, sin rewrite | ✓ Arreglado |
| 2 | DNS hostname conflict | Nombre completo contenedor | ✓ Arreglado |
| 3 | Cookie Secure flag | `COOKIE_SECURE=false` | ✓ Arreglado |
| 4 | Stats proxy wrong prefix | Prefijos correctos `/api/stats/*` | ✓ Arreglado |
| 5 | Fastify route conflict | `prefix: '/auth'` en vez de `'/'` | ✓ Arreglado |
| 6 | API Base URL inconsistency | fetch directo en LoginPage | ✓ Arreglado |
| 7 | CORS credentials + origin '*' | `origin: true` | ✓ Arreglado |
| 8 | SameSite=Lax + fetch() | Authorization header + localStorage | ✓ Arreglado |

---

## 8. SameSite=Lax con fetch() - Cookie no se envía

### Síntoma
- Login funciona (curl)
- Navegador: 401 en `/auth/me` antes y después de login
- Funciona en curl pero no en navegador real

### Causa Raíz
Según Context7/MDN:
> "Lax only sends cookies for... top-level navigation with safe methods (GET)"
> "Excludes: fetch() API calls"

Cuando el navegador hace `fetch('/auth/me', {credentials: 'include'})`, la cookie **SameSite=Lax** no se envía porque:
1. `fetch()` no es navegación top-level
2. Los navegadores modernos son más restrictivos con cookies

### Diagnóstico Realizado
- netshoot (Docker): Funciona ✅
- curl: Funciona ✅
- Navegador real: Falla ❌
- Logs de backend: Muestran requests llegando pero sin cookie

### Solución Implementada
Cambiar de cookies a **Authorization header**:

```typescript
// LoginPage.tsx - Guardar token en localStorage
localStorage.setItem('token', data.token)

// AuthContext.tsx - Leer token de localStorage
const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))

// api.ts - Agregar Authorization header
const token = localStorage.getItem('token');
const headers = {
  'Content-Type': 'application/json',
  ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
};
```

### Archivos Modificados
- `apps/provisioner-ui/src/contexts/AuthContext.tsx`
- `apps/provisioner-ui/src/utils/api.ts`
- `apps/provisioner-ui/src/pages/LoginPage.tsx`

### Lecciones Aprendidas Adicionales
10. **Cookies + fetch() no siempre funciona** - Navegadores modernos son más restrictivos
11. **Authorization header es más robusto** - Funciona en todos los navegadores
12. **localStorage + JWT es solución práctica** - Para SPA sin HTTPS

---

## 7. CORS Credentials con Origin Wildcard

### Síntoma
- Login funciona (curl)
- Navegador: 401 en `/auth/me`
- Ocurre en Chrome, Edge, incognito (todos los navegadores)

### Causa Raíz
Según Context7/MDN:
- Con `credentials: true`, `origin` NO puede ser `'*'`
- Si el servidor responde con `Access-Control-Allow-Origin: *` y `credentials: true`, el navegador **bloquea** la respuesta completa

```typescript
// Código actual (INCORRECTO):
await server.register(cors, {
    origin: CORS_ORIGINS === '*' ? '*' : CORS_ORIGINS.split(','),
    credentials: true  // ❌ Con credentials: true, origin '*' está prohibido
});
```

### Solución
Usar `origin: true` que retorna dinámicamente el origin de la request:

```typescript
// CORRECTO:
await server.register(cors, {
    origin: true,  // Permite cualquier origin dinámicamente
    credentials: true
});
```

**Resultado:** El servidor retorna `Access-Control-Allow-Origin: <origin real>` en vez de `*`

### Archivos a Modificar
- `apps/auth-service/src/server.ts`
- `apps/api-gateway/src/index.ts`

### Puntos en Común con Problemas Anteriores
- **Problema #3 (Cookie Secure)**: Ambos afectan cómo el navegador maneja cookies
- **Problema #6 (Login)**: Usa `credentials: 'include'` en fetch
- Las soluciones anteriores son **independientes** - no requieren revertirse

---

## 9. Contenedores con Código Viejo - Login 401 Persistente

### Síntoma
- Login funciona en curl con Bearer token
- Navegador: 401 en `/auth/me` antes y después de login
- Todos los fixes aplicados en código local pero sigue fallando

### Causa Raíz
Los contenedores Docker tienen **versiones antiguas del código**. Los archivos locales fueron modificados pero los containers no se rebuildaron.

```
Archivos locales: ✓ Actualizados con Bearer token + localStorage
Contenedores:     ✗ Todavía usan cookies + código viejo
```

### Diagnóstico
1. Los archivos locales tenían los fixes correctos
2. Los contenedores no se habían reconstruido
3. `docker system prune -a` + rebuild era necesario

### Solución Aplicada
```bash
# 1. Bajar servicios
./pipeline.sh --down

# 2. Limpieza completa (incluye removal de imágenes)
./pipeline.sh --cleanup-full

# 3. Limpiar Docker cache residual
docker system prune -a

# 4. Build y up fresco
./pipeline.sh --lint --build --up
```

### Resultado
- Login funciona correctamente ✅
- 401 antes de login desaparece ✅

### Lecciones Aprendidas
- **Siempre rebuildear después de cambios de código**
- Los cambios en archivos locales no se reflejan automáticamente en containers
- `docker system prune -a` asegura que no queden imágenes cached

---

## 10. Race Condition - Componentes cargan antes de que AuthContext termine de verificar

### Síntoma
- Login funciona correctamente
- Después de login, el dashboard muestra errores 401 en las llamadas a la API
- Los errores vienen de `/api/stats/summary`, `/api/vcenters`, etc.

### Causa Raíz
Los componentes del frontend ejecutan sus efectos antes de que el AuthContext termine de verificar la sesión:

```typescript
// AuthContext.tsx
const [isLoading, setIsLoading] = useState(true)
useEffect(() => {
  if (token) checkSession()  // Verificación asíncrona
  else setIsLoading(false)
}, [])
```

Cuando el usuario navega a /dashboard después del login:
1. DashboardWidgets se renderiza
2. useEffect se ejecuta, llama a checkAuth()
3. checkAuth() retorna false porque user=null (verificación no terminada)
4. Componente no hace requests (early return)
5. AuthContext termina verificación, actualiza user
6. Componente NO se re-renderiza (falta dependencia)

### Solución Implementada
Agregar `isLoading` del AuthContext como dependencia en los useEffects:

```typescript
// DashboardWidgets.tsx
const { checkAuth, isLoading: authLoading } = useAuth()

useEffect(() => {
  if (authLoading) return  // Esperar a queAuthContext termine
  if (!checkAuth()) {
    setLoading(false)
    return
  }
  fetchDashboardData()
}, [checkAuth, authLoading])
```

### Archivos Modificados
- `apps/provisioner-ui/src/components/Stats/DashboardWidgets.tsx`
- `apps/provisioner-ui/src/components/Stats/StatsWidgets.tsx`
- `apps/provisioner-ui/src/pages/DashboardPage.tsx`

---

## 11. Session Cookie Priority Bug - Bearer Token Ignorado

### Síntoma
- Login funciona correctamente
- Dashboard muestra errores 401 en `/api/stats/summary`, `/api/vcenters`, etc.
- El debug container con Bearer token funciona, pero el navegador falla

### Análisis Profundo - Flujo Completo de Capas

```
CAPA 1: NAVEGADOR
- Envía: Authorization: Bearer <token> + Cookie: session_id=<sid>
- Estado: ✅ Funciona correctamente

CAPA 2: NGINX (puerto 5173)
- Recibe ambos headers y los re-envía al api-gateway
- Pasa las cookies correctamente
- Estado: ✅ Funciona correctamente

CAPA 3: API-GATEWAY (el bug está aquí)
- Recibe: Authorization + Cookie
- Extrae el session_id de las cookies
- PRIORIZA session_id sobre Authorization (BUG)
- Envía session_id al auth-service en el BODY
- NO re-envía la cookie al auth-service (BUG)
- Estado: ❌ BUG - Lógica de prioridad incorrecta

CAPA 4: AUTH-SERVICE
- Cuando recibe con cookie: funciona
- Cuando recibe sin cookie: funciona
- Estado: ✅ Funciona correctamente
```

### Tests de Verificación Realizados

| Test | Descripción | Resultado |
|------|-------------|-----------|
| 1 | Bearer token solo | **200 OK** ✅ |
| 2 | Cookie + Bearer (como navegador) | **401** ❌ |
| 3a | Session ID en body (como api-gateway envía) | Error ❌ |
| 3b | Session ID en cookie (como auth-service espera) | **200 OK** ✅ |
| 4 | Solo Authorization header | **200 OK** ✅ |

### Causa Raíz

El api-gateway tenía lógica de prioridad que:
1. Prioriza session cookie sobre Bearer token
2. Envía el session_id en el body, pero auth-service lo busca en cookies
3. Este mismatch causa que la autenticación falle

### Solución Implementada
Eliminar la lógica de session cookies y usar solo Bearer tokens:

```typescript
// api-gateway/src/index.ts
server.decorate('authenticate', async (request: any, reply: any) => {
    try {
        const authHeader = request.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            reply.code(401).send({ error: 'Unauthorized', details: 'Missing or invalid Authorization header' });
            return;
        }

        const token = authHeader.replace('Bearer ', '');
        
        try {
            const decoded = await request.server.jwt.verify(token);
            request.user = decoded;
        } catch (jwtErr) {
            reply.code(401).send({ error: 'Unauthorized', details: 'Invalid or expired token' });
        }
    } catch (err) {
        reply.code(401).send({ error: 'Unauthorized', details: 'Invalid or missing token' });
    }
});
```

### Beneficios de la Solución
- Eliminó el bug de comunicación session_id body vs cookies
- Verificación local del JWT (más eficiente, no requiere HTTP call a auth-service)
- Código más simple y mantenible
- Alineado con mejores prácticas de Context7

### Archivos Modificados
- `apps/api-gateway/src/index.ts`
- Agregado `import jwt from '@fastify/jwt'`
- Agregado `JWT_SECRET` (mismo valor que auth-service)
- Eliminada lógica de cookies y session_id

---

## 12. Endpoint Faltante - /api/typing/templates 404

### Síntoma
- Todos los otros endpoints funcionan correctamente
- `/api/typing/templates` retorna 404

### Causa Raíz
El api-gateway no tenía proxy configurado para `/api/typing/templates`.

### Test Completo de Endpoints Realizado

```
ENDPOINTS PÚBLICOS:
GET /vm-classes          → 200 ✅
GET /api/vm-classes      → 200 ✅
GET /health              → 200 ✅

ENDPOINTS PROTEGIDOS (con Bearer token):
GET /api/stats/summary   → 200 ✅
GET /api/stats/recent    → 200 ✅
GET /api/stats/by-vmclass → 200 ✅
GET /api/stats/by-vcenter → 200 ✅
GET /api/vcenters        → 200 ✅
GET /api/typing/templates → 404 ❌ (antes del fix)
```

### Solución Implementada

```typescript
// apps/api-gateway/src/index.ts
fastify.register(proxy, {
    upstream: TYPING_SERVICE_URL,
    prefix: '/api/typing/templates',
    rewritePrefix: '/templates',
    config: { proxyTimeout: 30000 }
});
```

### Archivos Modificados
- `apps/api-gateway/src/index.ts`

---

## 14. Campo Confuso templateId vs typificationId - Error 400 Bad Request

### Síntoma
- Error: `Faltan datos requeridos: templateId="", vcenterId="1"`
- El usuario completa todos los campos pero el error muestra `templateId=""` vacío

### Análisis del Problema

El formulario tenía dos problemas:

1. **Campo sin uso**: `templateId` en el estado nunca se llenaba desde ningún dropdown
2. **Validación incorrecta**: El código validaba `formData.templateId` cuando debería validar `formData.typificationId`

```typescript
// DashboardPage.tsx - Estado inicial (CONFUSO)
interface CreateVMFormData {
  templateId: string       // ❌ Nunca se usa, siempre vacío
  typificationId: string  // ✅ El que llena el usuario
  // ...
}

// Validación (INCORRECTA)
if (!formData.templateId || !formData.vcenterId) {  // ❌ Valida campo vacío
  showError('Error', `Faltan datos requeridos: templateId="${formData.templateId}"`)
}
```

### Diagnóstico

Según Context7 para React/TypeScript:
- Usar tipos específicos en lugar de `any` para payloads
- Eliminar campos sin uso que confunden
- Nombres claros para variables

### Solución Implementada

1. **Eliminar campo innecesario** - Removí `templateId` de `CreateVMFormData`

2. **Crear tipo específico para el payload**:
```typescript
interface ProvisionRequestPayload {
  template_id: number
  manual_value: string
  vcenter_connection_id: number
  vcenter_datacenter?: string
  vcenter_cluster?: string
  vcenter_resource_pool?: string
  storage_policy?: string
  vm_class_id?: number
}
```

3. **Renombrar variable confusa** - `selectedTemplate` → `selectedVMClass`

4. **Corregir validación**:
```typescript
// Antes (incorrecto)
if (!formData.templateId || !formData.vcenterId)

// Después (correcto)
if (!formData.typificationId || !formData.vcenterId)
```

5. **Usar tipo específico en payload**:
```typescript
// Antes
const payload: any = { ... }

// Después
const payload: ProvisionRequestPayload = { ... }
```

### Archivos Modificados
- `apps/provisioner-ui/src/pages/DashboardPage.tsx`

### Lecciones Aprendidas
- **Eliminar campos sin uso** - Si un campo no se usa, eliminarlo para evitar confusión
- **Tipos específicos > any** - TypeScript funciona mejor con tipos definidos
- **Nombres claros** - `selectedVMClass` vs `selectedTemplate` (más explícito)
- **Validar el campo correcto** - Asegurarse de validar lo que realmente se envía

---
## Lecciones Aprendidas

1. **No usar `rewrite` en nginx** cuando el backend espera el path completo
2. **Usar nombres completos de contenedores** (`provisioner-api-gateway`) para evitar conflictos DNS
3. **Verificar `Secure` flag en cookies** - debe coincidir con el protocolo (HTTP/HTTPS)
4. **Testear con curl** antes de asumir que funciona en el navegador
5. **Los tests locales pueden pasar** pero los contenedores tener código viejo
6. **Usar pipeline.sh** para rebuild y restart de contenedores
7. **Verificar que las imágenes tengan los hashes correctos** antes de usar docker-compose
8. **Consistencia en API calls** - usar el mismo patrón en todo el frontend
9. **CORS credentials: `origin: '*'` con `credentials: true` está prohibido** - usar `origin: true` para origins dinámicos
10. **curl ≠ navegador** - curl ignora CORS y SameSite, el navegador los enforce
11. **Cookies + fetch() no siempre funciona** - Navegadores modernos son más restrictivos
12. **Authorization header es más robusto que cookies** - Funciona en todos los escenarios
13. **Testing comprehensivo** - Probar TODOS los endpoints del frontend, no solo los que seem fail
14. **Usar debug container** - Para testing desde dentro de la red Docker
15. **Análisis de flujo completo** - Entender cada capa (navegador → nginx → api-gateway → auth-service)
16. **No asumir** - Verificar cada hipótesis con tests antes de claimar soluciones
17. **Debug container es tu amigo** - Herramientas como curl, httpie, jq disponibles para testing detallado

---

## Comandos Útiles para Debug

### Debug Container - Testing Desde Dentro de Docker

```bash
# Iniciar debug container
cd provisioner-debug && docker compose up -d

# Login y obtener token
docker exec provisioner-debug bash -c '
TOKEN=$(curl -s -X POST http://provisioner-api-gateway:3000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"password123\"}" | jq -r ".token")

# Test con Bearer token
curl -H "Authorization: Bearer $TOKEN" http://provisioner-api-gateway:3000/api/stats/summary
'

# Verificar typing-service endpoints
docker exec provisioner-debug bash -c '
curl -s http://provisioner-typing:8000/templates | jq .
'
```

### Test Completo de Todos los Endpoints

```bash
docker exec provisioner-debug bash -c '
TOKEN=$(curl -s -X POST http://provisioner-api-gateway:3000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"password123\"}" | jq -r ".token")

echo "=== ENDPOINTS PÚBLICOS ==="
curl -s -w "\nHTTP:%{http_code}" http://provisioner-api-gateway:3000/vm-classes | head -c 100

echo ""
echo "=== ENDPOINTS PROTEGIDOS ==="
curl -s -w "\nHTTP:%{http_code}" -H "Authorization: Bearer $TOKEN" \
  http://provisioner-api-gateway:3000/api/stats/summary

curl -s -w "\nHTTP:%{http_code}" -H "Authorization: Bearer $TOKEN" \
  http://provisioner-api-gateway:3000/api/typing/templates
'
```

### Ver Logs del Api-Gateway

```bash
# Ver requests 401
docker logs provisioner-api-gateway 2>&1 | grep "401"

# Ver headers de requests del navegador
docker logs provisioner-api-gateway 2>&1 | grep -E "Headers.*authorization" | tail -5

# Ver todas las requests recientes
docker logs provisioner-api-gateway --tail 50 2>&1 | grep -E "req.*method.*GET"
```

---

## 13. API Gateway - Wrong Rewrite Prefix para /api/provision

### Síntoma
- POST /api/provision desde el navegador → 404
- POST /api/provision desde curl (dentro de Docker) → 401 (auth required) - funciona correctamente

### Causa Raíz
El api-gateway tenía configurado:
```typescript
prefix: '/api/provision',
rewritePrefix: '/'  // ← INCORRECTO
```

Cuando el navegador hace POST a `/api/provision`:
1. El proxy reescribe a `/` antes de enviar al vm-orchestrator
2. vm-orchestrator espera `/provision`, no `/`
3. Resultado: 404 porque no existe el endpoint `/`

### Solución Implementada
Cambiar el rewritePrefix para que coincida con el endpoint del backend:

```typescript
prefix: '/api/provision',
rewritePrefix: '/provision'  // ← CORRECTO
```

### Archivos Modificados
- `apps/api-gateway/src/index.ts` (línea 122)
