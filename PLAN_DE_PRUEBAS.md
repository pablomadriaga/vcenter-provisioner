# Plan Integral de Pruebas — vCenter Provisioner (vc-ui.playground.net)

## Hallazgos Iniciales (Reconocimiento)

### Endpoints Descubiertos

| Método | Ruta | Auth | Comportamiento Actual |
|--------|------|------|-----------------------|
| POST | `/auth/login` | No | 400 input inválido / 401 credenciales / 429 rate-limit |
| POST | `/auth/logout` | No | 200, limpia cookie `session_id` |
| GET | `/auth/me` | JWT | 401 si token inválido |
| GET | `/api/health` | No | `{"status":"ok","service":"gateway"}` |
| GET | `/api/vcenters` | JWT | 401 si token inválido |
| POST | `/api/vcenters` | JWT | 401 si token inválido |
| POST | `/api/vcenters/test-temp` | JWT | Requiere body `{host,username,password,insecure}` |
| POST | `/api/vcenters/discover/datacenters` | JWT | Proxy a vcenter-operations |
| POST | `/api/vcenters/discover/clusters` | JWT | Proxy a vcenter-operations |
| GET | `/api/typing/templates` | JWT | Lista plantillas |
| POST | `/api/typing/templates` | JWT | Crea plantilla |
| GET | `/api/vm-classes` | JWT | Lista clases VM |
| POST | `/api/typing/vm-classes` | JWT | Crea clase VM |
| GET | `/api/stats/summary` | JWT | Resumen estadísticas |
| GET | `/api/stats/by-vcenter` | JWT | Stats por vCenter |
| GET | `/api/stats/by-vmclass` | JWT | Stats por VM class |
| GET | `/api/stats/failures?limit=N` | JWT | Fallos recientes |
| GET | `/api/stats/recent?limit=N` | JWT | Actividad reciente |
| POST | `/api/provision` | JWT | Provisiona VM `{template_id,vcenter_connection_id,manual_value,...}` |
| GET | `/api/vcenter-data/resource-pools` | JWT | Pools por vCenter |
| GET | `/api/vcenter-data/storage-policies` | JWT | Storage policies |
| GET | `/api/dashboard/monitoring/services-status` | JWT | Estado servicios |
| GET | `/api/dashboard/monitoring/services-history` | JWT | Historial servicio |
| GET | `/api/dashboard/monitoring/services-timeseries` | JWT | Series temporales |
| GET | `/api/dashboard/monitoring/connectivity-matrix` | JWT | Matriz conectividad |

### Problemas de Seguridad Identificados

1. **CORS abierto peligrosamente**: `access-control-allow-origin:` refleja cualquier origen (`Origin: https://evil.com` → permitido). Incluso `Origin: null` es aceptado. Combinado con `access-control-allow-credentials: true`, permite CSRF con credenciales desde cualquier sitio.
2. **Cookie `session_id` sin flags de seguridad**: No tiene `Secure`, no tiene `HttpOnly`. Solo `SameSite=Lax`. Esto permite exfiltración via XSS y transmisión por HTTP plano.
3. **Sin CSP**: No hay headers `Content-Security-Policy`. Esto permite XSS, inyección de scripts, y data exfiltration.
4. **Sin HSTS**: No hay `Strict-Transport-Security`. Vulnerable a SSL stripping.
5. **Sin CSRF tokens**: Las operaciones POST en `/api/*` no tienen mecanismo CSRF visible, lo que combinado con CORS abierto es crítico.

### Inconsistencias en Formato de Error

| Escenario | Código | Formato Respuesta |
|-----------|--------|-------------------|
| Body inválido en login | 400 | `{"error":"Invalid input"}` |
| Credenciales incorrectas | 401 | `{"error":"Invalid credentials"}` |
| Rate limit excedido | 429 | `{"statusCode":429,"error":"Too Many Requests","message":"..."}` |
| JSON mal formado | 400 | `{"statusCode":400,"code":"FST_ERR_CTP_INVALID_JSON_BODY","error":"Bad Request","message":"..."}` |
| Ruta no encontrada | 404 | `{"message":"Route ... not found","error":"Not Found","statusCode":404}` |
| Token ausente | 401 | `{"error":"Unauthorized","details":"Missing or invalid Authorization header"}` |
| Token inválido/expirado | 401 | `{"error":"Unauthorized","details":"Invalid or expired token"}` |
| Gateway saludable | 200 | `{"status":"ok","service":"gateway"}` |

**Problema**: 8 formatos de error distintos para 8 escenarios. El frontend no puede tener un parser de errores uniforme.

---

## 1. Pruebas de Contrato API / Validación de Esquema (5+)

### 1.1 `GET /api/vcenters` — Código de estado y formato

```
REQUEST:
  GET /api/vcenters
  Authorization: Bearer <JWT_VÁLIDO>

PASS (✓):
  • Status 200
  • Content-Type: application/json; charset=utf-8
  • Body es un array JSON: [{id, host, username, status, created_at, ...}]
  • Cada objeto tiene campos consistentes (mismo schema)

FAIL (✗):
  • Status 401/403
  • Body no es array o tiene estructura distinta
  • Campos faltantes o tipo incorrecto (string vs number)

ERROR HANDLING:
  Sin token → {"error":"Unauthorized","details":"Invalid or expired token"}
  Token expirado → {"error":"Unauthorized","details":"Invalid or expired token"}
```

### 1.2 `POST /api/vcenters` — Validación de entrada

```
REQUEST:
  POST /api/vcenters
  Authorization: Bearer <JWT_VÁLIDO>
  Content-Type: application/json
  Body: {"host":"","username":"","password":""}

PASS (✓):
  • Status 400 si campos vacíos
  • Error descriptivo: {"error":"El campo host es requerido"} (formato consistente)

FAIL (✗):
  • Status 200 con datos inválidos
  • Error 500 sin validación
  • Error SQL/stack trace expuesto (seguridad)
```

### 1.3 Consistencia de formato de error en todos los endpoints

```
PRUEBA: Enviar peticiones inválidas a cada endpoint y verificar FORMATO ÚNICO

Escenarios por endpoint:
  a) Body mal formado: enviar "not-json"
  b) Campos requeridos ausentes: enviar {}
  c) Tipos incorrectos: enviar string donde espera number
  d) Token inválido: Authorization: Bearer INVALIDO
  e) Token ausente: sin header Authorization

PASS (✓):
  • TODOS los errores 4xx siguen el mismo schema:
    {"error":"<código_máquina>","message":"<texto_legible>","statusCode":<http_status>}
  • Content-Type es siempre application/json

FAIL (✗):
  • Mezcla de formatos: {"error":"..."} vs {"statusCode":...,"code":"FST_ERR_..."}
  • Stack traces o detalles internos expuestos
  • HTML en errores API
```

### 1.4 Headers Content-Type correctos

```
PRUEBA: Verificar Content-Type en todas las respuestas

PASS (✓):
  • Static assets (JS, CSS, SVG) → tipos MIME correctos
  • API (4xx, 2xx, 5xx) → application/json; charset=utf-8
  • HTML (/) → text/html
  • OPTIONS preflight → sin Content-Type, Status 204

FAIL (✗):
  • API devuelve text/html o text/plain en errores
  • Static assets con tipo incorrecto
```

### 1.5 CORS — Comportamiento y riesgos (CRÍTICO)

```
PRUEBA A:
  OPTIONS /api/vcenters
  Origin: https://evil.com
  Access-Control-Request-Method: POST
  Access-Control-Request-Headers: Authorization, Content-Type

RESULTADO ACTUAL: Status 204
  access-control-allow-origin: https://evil.com
  access-control-allow-credentials: true
  access-control-allow-methods: GET,HEAD,PUT,PATCH,POST,DELETE
  access-control-allow-headers: Authorization, Content-Type

EVALUACIÓN: FAIL ✗ — CUALQUIER origen puede hacer peticiones autenticadas
  La combinación allow-credentials + allow-origin: "*" (o espejado)
  permite CSRF desde cualquier dominio con fetch(..., {credentials:"include"})

PRUEBA B (CORS con credenciales):
  POST /api/vcenters
  Origin: https://evil.com
  Authorization: Bearer <JWT_VÁLIDO>

PASS (✓): Origin es bloqueado con 403, o no se permite CORS con credenciales
FAIL (✗): Status 200 con datos sensibles → VULNERABILIDAD CSRF

PRUEBA C (Null Origin):
  OPTIONS /api/vcenters
  Origin: null

RESULTADO ACTUAL: Permitido ← Riesgo de iframe sandboxed
```

## 2. Pruebas de Resiliencia / Inyección de Fallos (5+)

### 2.1 Timeout en backend — ¿El gateway responde con error amigable?

```
SETUP: Inyectar latency de 30s en un microservicio (e.g., vcenter-operations)

PRUEBA:
  POST /api/vcenters/test-temp (vcenter-operations timeout)
  Body: {host, username, password, insecure}

EXPECTATIVA:
  • Gateway responde antes de 30s con 504 Gateway Timeout
  • Error JSON: {"error":"Gateway Timeout","message":"Upstream timeout","statusCode":504}
  • El frontend muestra: "El servicio de vCenter no responde, intente nuevamente"

PASS (✓):
  • Timeout manejado con 504 en < 30s
  • Sin stack traces
  • Frontend muestra error amigable

FAIL (✗):
  • Conexión cuelga hasta timeout del browser (~120s)
  • Error 500 genérico
  • Pantalla blanca/crash del frontend
```

### 2.2 Error 5xx del backend — ¿El gateway traduce correctamente?

```
SETUP: Forzar error 503 en auth-service

PRUEBA:
  POST /auth/login con credenciales válidas pero auth-service caído

PASS (✓):
  • Status 503 con {"error":"Service Unavailable","message":"..."}
  • Frontend muestra: "Servicio de autenticación temporalmente fuera de servicio"
  • Botón de reintento visible

FAIL (✗):
  • El error 503 se transforma en 500
  • Se exponen detalles internos (cluster name, pod IP, stack)
  • Frontend muestra error genérico sin acción posible
```

### 2.3 JWT expira en medio de la sesión — ¿Manejo graceful?

```
SETUP: Obtener JWT con tiempo corto (o manipular clock)

PRUEBA:
  1. Login exitoso → obtener JWT
  2. POST /api/provision con JWT expirado

PASS (✓):
  • 401 con {"error":"Unauthorized","details":"Invalid or expired token"}
  • Frontend intercepta 401 globalmente
  • Redirige a /login sin perder datos del formulario (localStorage/sessionStorage)
  • Muestra: "Su sesión ha expirado. Por favor inicie sesión nuevamente."

FAIL (✗):
  • Error 500 sin manejo
  • Redirección a /login con pérdida de datos
  • Loop de redirect login→dashboard→login
  • Modal infinito sin acción
```

### 2.4 Provisionamiento concurrente — Race conditions

```
SETUP: Tener 2 sesiones activas (2 JWTs diferentes para mismo usuario)

PRUEBA:
  1. Enviar 5 POST /api/provision simultáneos (mismo template_id, mismo vcenter)
  2. Verificar jobs creados en backend

PASS (✓):
  • Todos los requests reciben 202 Accepted con job ID único
  • Cada job tiene ID distinto
  • No hay datos duplicados ni corruptos en la BD
  • Todos los jobs completan o fallan individualmente

FAIL (✗):
  • Algunos requests reciben 409 Conflict
  • Se crean VMs duplicadas
  • Error 500 por deadlock en BD
  • Timeout simultáneo mata todo el pool de conexiones
```

### 2.5 Corte parcial de servicio — Degradación graceful

```
SETUP: Detener 2 microservicios (e.g., stats-service, monitoring-service)

PRUEBA:
  Navegar por todas las vistas del frontend:
  • /dashboard → debe cargar (sin estadísticas? con placeholder?)
  • /typifications → debe cargar
  • /vcenters → debe cargar
  • /monitor → debe cargar con datos parciales
  • /stats → debe mostrar placeholder "Servicio no disponible"

PASS (✓):
  • Cada vista carga independientemente
  • Las secciones caídas muestran "Servicio temporalmente no disponible"
  • El resto de la app funciona completo
  • No hay cascada de errores (un servicio caído no tumba el frontend)

FAIL (✗):
  • Pantalla en blanco porque un microservicio no responde
  • Error 500 gateway bloquea toda la app
  • Timeout de un servicio bloquea otros requests (sin aislamiento)
```

## 3. Pruebas de Línea Base de Rendimiento (5+)

### 3.1 Métricas de carga de página

```
PRUEBA: Medir con Puppeteer/Playwright desde ubicación de red real

MÉTRICAS A CAPTURAR:
  • FCP (First Contentful Paint): < 1.5s
  • LCP (Largest Contentful Paint): < 2.0s
  • TTFB (Time to First Byte):
    - / (HTML): ~29ms ✓ actual
    - /api/health: ~30ms ✓ actual
    - POST /auth/login: ~46ms ✓ actual
  • TTI (Time to Interactive): < 3.0s
  • SI (Speed Index): < 3.0s

PASS (✓): Métricas dentro del rango objetivo
FAIL (✗): LCP > 4s, TTFB > 200ms, TTI > 5s
```

### 3.2 Tiempos de respuesta por endpoint

```
PRUEBA: Benchmark cada endpoint autenticado (10 iteraciones)

  ENDPOINT                   | P50 actual | Objetivo P95
  ---------------------------|------------|-------------
  GET /api/health            | ~30ms      | < 100ms
  GET /api/vcenters          | ?          | < 200ms
  POST /api/vcenters         | ?          | < 500ms (crea recurso)
  POST /api/vcenters/test-temp| ?         | < 3s (conecta vCenter)
  POST /api/provision        | ?          | 202 async
  GET /api/typing/templates  | ?          | < 200ms
  GET /api/stats/summary     | ?          | < 300ms
  GET /api/stats/by-vcenter  | ?          | < 500ms
  POST /auth/login           | ~46ms      | < 200ms

PASS (✓): P95 dentro del objetivo
FAIL (✗): P95 > 2x el objetivo, timeouts, degradación bajo carga
```

### 3.3 Peso del bundle JS / Recursos

```
RECURSOS ACTUALES:
  • index-B66Q8oXp.js: 776,187 bytes (775 KB)
  • index-W95uqYXG.css: 27,311 bytes (27 KB)
  • favicon.svg: 250 bytes ✓

EVALUACIÓN: FAIL ✗ para bundle JS
  • 775 KB sin comprimir — excesivo para una SPA
  • Sin code splitting visible (un solo bundle grande)
  • Sugerir chunking por ruta (dashboard, typifications, vcenters, stats, monitor)

PASS (✓):
  • bundle JS < 250 KB comprimido (gzip)
  • Code splitting por ruta
  • Lazy loading para vistas no críticas
  • Tamaño total de recursos < 500 KB (gzip)

FAIL (✗):
  > 500 KB JS aunque sea comprimido
```

### 3.4 Optimización de imágenes / assets

```
PRUEBA: Verificar assets estáticos

ACTUAL:
  • favicon.svg: 250 bytes (SVG optimizado) ✓
  • No hay imágenes raster (PNG/JPG) en assets ✓
  • CSS: 27 KB, minificado ✓

PASS (✓):
  • SVG para iconos (vectorial)
  • Imágenes raster optimizadas (WebP, AVIF)
  • Lazy loading para imágenes fuera del viewport
  • Sin imágenes inline en JS bundle

FAIL (✗):
  • Imágenes grandes sin optimizar
  • PNG > 100 KB donde SVG serviría
  • Imágenes inline como base64 en JS/CSS
```

### 3.5 Estrategia de caché

```
VERIFICACIÓN DE HEADERS:

  Static assets (JS/CSS):
    cache-control: max-age=31536000, public, immutable
    expires: +1 año
    etag presente ✓

  HTML (/):
    last-modified ✓
    etag ✓
    NO tiene cache-control → browser decide
    Sujeto a condiciones de carrera de deploy (ETag vs nuevo build)

  API responses:
    Sin headers de caché (correcto para API dinámica)

PASS (✓):
  • Static assets con hash en filename e immutable ✓
  • API sin caché con no-cache o no-store
  • ETag o Last-Modified presente en recursos estáticos
  • Versión de build en URL de assets

FAIL (✗):
  • API responde con cache-control: public
  • Static assets sin hash en URL (riesgo de caché rota tras deploy)
  • Sin etag ni last-modified
```

## 4. Pruebas de Consistencia de Datos (3+)

### 4.1 VM provisionada → aparece en historial de actividad

```
PRUEBA:
  1. POST /api/provision → 202 Accepted, job_id creado
  2. Esperar que el job complete (pooling GET /api/stats/recent?limit=10)
  3. Verificar GET /api/vcenters/<id> status actualizado

PASS (✓):
  • El job aparece en /api/stats/recent con status "completed" o "failed"
  • La VM creada es visible en el listado de VMs del vCenter
  • Los recursos están contabilizados en stats (CPU, RAM, storage)

FAIL (✗):
  • Job creado pero nunca completa (PENDING forever)
  • VM creada pero no aparece en historial
  • Datos inconsistentes: job completed pero VM no existe
```

### 4.2 vCenter agregado → persiste al recargar página

```
PRUEBA:
  1. POST /api/vcenters (crear conexión vCenter)
  2. GET /api/vcenters → verificar que aparece
  3. Recargar página / recargar sesión
  4. GET /api/vcenters → debe seguir apareciendo

PASS (✓):
  • vCenter visible después de page reload
  • Los campos (host, username, status) coinciden con lo creado
  • Status refleja correctamente "connected" o "disconnected"

FAIL (✗):
  • vCenter desaparece tras recargar (datos en memoria, no en BD)
  • Status incorrecto o datos inconsistentes
  • Conexión duplicada si se envía el mismo formulario dos veces
```

### 4.3 Typification creada → usable inmediatamente (sin delay)

```
PRUEBA:
  1. POST /api/typing/templates (crear typificación)
  2. GET /api/typing/templates → debe aparecer inmediatamente
  3. POST /api/provision usando template_id recién creado
  4. Verificar que el provisionamiento usa la typification correctamente

PASS (✓):
  • Typification visible en GET sin delay
  • Provisionamiento con template_id devuelve 202
  • El nombre generado sigue el patrón de la typification

FAIL (✗):
  • Eventual consistency delay: typification no visible por N segundos
  • Provisionamiento falla porque typification no está propagada
  • Datos corruptos: typification visible pero con campos default
```

## 5. Pruebas de Resiliencia Específicas de K8s (3+)

### 5.1 Reinicio de pod → ¿La sesión sobrevive?

```
SETUP: Tener sesión activa con JWT válido

PRUEBA:
  1. Obtener JWT mediante login exitoso
  2. Eliminar pod del auth-service: kubectl delete pod -l app=auth-service
  3. Inmediatamente: GET /api/vcenters con el mismo JWT
  4. POST /auth/me con el mismo JWT

PASS (✓):
  • Si el JWT no ha expirado, las APIs siguen funcionando
  • auth-service se recupera (nuevo pod ready)
  • La sesión en el frontend no se pierde
  • logout/re-login funciona después del restart

FAIL (✗):
  • JWT inválido después del restart (si la clave HMAC se regeneró)
  • Sesión perdida porque el estado está en memoria del pod
  • Error sin mensaje claro, solo pantalla blanca
  • Loop de redirect login→dashboard permanentemente
```

### 5.2 Backing service no disponible (PostgreSQL/Redis caído)

```
SETUP: Escalar PostgreSQL a 0 réplicas o bloquear acceso

PRUEBA A (BD caída):
  • GET /api/vcenters → debe fallar con 503
  • POST /auth/login → debe fallar con 503
  • Frontend debe mostrar "Base de datos temporalmente fuera de servicio"

PRUEBA B (Redis caído):
  • Sesiones/cache pueden fallar
  • Login puede funcionar sin Redis (autenticación directa contra BD)
  • Rate limiting: si usa Redis, se pierde → riesgo de DoS

PASS (✓):
  • Errores 503 claros, no 500 internos
  • Mensajes: "Servicio de base de datos no disponible, intente más tarde"
  • Degradación graceful: partes que no requieren BD siguen funcionando
  • Reconexión automática cuando el servicio se restaura

FAIL (✗):
  • Error 500 con stack trace de conexión a BD
  • Conexiones colgadas que saturan el pool
  • Frontend crash sin mensaje de error
```

### 5.3 Fallo de Liveness/Readiness Probe → impacto en usuario

```
SETUP: Forzar fallo de health check en un pod (e.g., typing-service responde 500 en /health)

PRUEBA:
  1. typing-service comienza a fallar liveness probe
  2. K8s mata el pod, crea uno nuevo (restart)

OBSERVAR:
  • ¿Cuánto tarda el nuevo pod en estar ready? (ideal < 5s)
  • Durante la ventana sin servicio:
    - GET /api/typing/templates → 503 o timeout?
    - POST /api/typing/templates → 503?
  • ¿El frontend maneja el 503 o se cae?
  • ¿Hay mensaje contextual: "Servicio de typificación temporalmente no disponible"?

PASS (✓):
  • Ventana de indisponibilidad < 10s
  • Errores 503 con mensajes claros
  • Sin pantalla blanca ni crash
  • Reintento automático desde el frontend (opcional)

FAIL (✗):
  • Ventana de > 30s (probes muy lentas o startup lento)
  • Errores 500 sin manejo
  • Frontend muestra datos inconsistentes o vacíos sin indicación
```

## 6. Pruebas de Logging y Observabilidad (3+)

### 6.1 ¿Qué se loguea en errores?

```
PRUEBA: Para cada escenario de error, verificar logs estructurados

ESCENARIOS:
  • 400 Bad Request → debe loguear: método, path, IP, user-agent, error brief
  • 401 Unauthorized → debe loguear: IP, path, motivo (token expirado/inválido)
  • 429 Rate Limited → debe loguear: IP, contador actual, reset time
  • 500 Internal → debe loguear: stack trace COMPLETO, request ID, usuario
  • 503 Service Unavailable → debe loguear: upstream, reason, duration

PASS (✓):
  • Logs en formato JSON estructurado
  • Cada log incluye: timestamp, severity, service_name, trace_id, request_id
  • Stack traces solo en 500, no expuestos al cliente
  • Sin datos sensibles en logs (passwords, tokens, secrets)

FAIL (✗):
  • Logs en texto plano sin estructura
  • Sin request ID/trace ID → imposible correlacionar
  • Passwords o tokens en logs
  • Errores silenciosos (500 sin log)
```

### 6.2 ¿Hay credenciales sensibles en URLs/Headers?

```
PRUEBA: Inspeccionar tráfico de red en frontend

VERIFICAR:
  • Headers Authorization: Bearer <token> → OK (estándar seguro)
  • ¿Hay tokens en query params? Ej: /api/vcenters?token=xxx → FAIL
  • ¿Passwords en URLs? → FAIL
  • ¿Hay credenciales en GET request bodies? → FAIL (GET no debe tener body)
  • Cookies: session_id sin Secure ni HttpOnly → FAIL (riesgo)

PASS (✓):
  • Todas las credenciales viajan en headers Authorization
  • Passwords solo en POST body, nunca en GET params
  • Cookie session_id tiene Secure + HttpOnly + SameSite=Strict

FAIL (✗):
  • JWT en query params (expuesto en logs de proxy/browser history)
  • Passwords en GET params
  • Cookies sin Secure en HTTPS
  • Credenciales en Referer header (via CORS)
```

### 6.3 Identificadores de trazabilidad (Request tracing)

```
PRUEBA: Verificar headers de tracing en cadena de requests

FLUJO:
  Cliente → Envoy (Contour) → API Gateway → auth-service/stats/etc → PostgreSQL

VERIFICAR HEADERS:
  • x-request-id: presente en todas las respuestas (Envoy)
  • x-envoy-upstream-service-time: presente ✓ (~3-56ms según endpoint)
  • traceparent / tracestate: ¿OpenTelemetry propagation?
  • x-b3-traceid, x-b3-spanid: ¿Zipkin/Jaeger propagation?
  • ¿El trace ID persiste a través de toda la cadena de microservicios?

PRUEBA:
  1. POST /auth/login → capturar x-request-id
  2. GET /api/vcenters → verificar que x-request-id es NUEVO (cada request)
  3. En logs del gateway, buscar ambos request IDs

PASS (✓):
  • Cada request tiene x-request-id único
  • x-envoy-upstream-service-time presente con latencia real
  • OpenTelemetry propagation headers (traceparent/tracestate)
  • Logs del gateway correlacionables con logs de microservicios

FAIL (✗):
  • Sin trace ID que cruce servicios
  • x-request-id ausente en algunas respuestas
  • x-envoy-upstream-service-time ausente
  • Sin propagación de contexto entre microservicios
```

---

## Resumen de Riesgos Altos Encontrados Durante el Reconocimiento

| # | Riesgo | Gravedad | Acción Requerida |
|---|--------|----------|------------------|
| 1 | CORS con cualquier origen + credentials=true | 🔴 CRÍTICO | Bloquear orígenes no confiables |
| 2 | Cookie sin Secure/HttpOnly | 🔴 ALTO | Agregar Secure + HttpOnly + SameSite=Strict |
| 3 | Sin CSP ni HSTS | 🟡 MEDIO | Implementar CSP estricto + HSTS preload |
| 4 | Error format inconsistente (8 formatos) | 🟡 MEDIO | Unificar schema de error: `{error, message, statusCode}` |
| 5 | Bundle JS 775 KB sin code splitting | 🟡 MEDIO | Implementar lazy loading por ruta |
| 6 | Sin trace ID visible entre servicios | 🟡 MEDIO | Implementar OpenTelemetry propagation |
| 7 | Rate limit solo en login, no en API | 🟡 MEDIO | Extender rate limiting a todas las rutas /api/* |
| 8 | Null Origin permitido en CORS | 🟡 MEDIO | Bloquear Origin: null |
