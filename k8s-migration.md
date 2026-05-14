# Kubernetes Migration Plan (Alineado a 12-Factor)
> Estados: [PENDING], [IN PROGRESS], [COMPLETED], [BLOCKED]

---

## Pre-Migración
### 1. Commit de estado actual [COMPLETED]
- Snapshot de todo el proyecto antes de iniciar migración
- Commit: `chore: snapshot current state before k8s migration`

### 2. Creación de branch `k8s` [COMPLETED]
- Branch aislado para todo el trabajo de migración
- Comando: `git checkout -b k8s`

---

## Fase 1: Remediación de Gaps 12-Factor
### 3. Factor III (Config): Eliminar secrets hardcodeados [COMPLETED]
- Auditar `docker-compose.yml` y archivos `.env` por credenciales en texto plano
- Mover todos los valores sensibles a variables de entorno/Secrets de K8s
- Crear `.env.example` sin valores reales
- Servicios a ajustar: `auth-service`, `typing-service`, `vcenter-operations`, `credential-manager`, `monitoring-service`, Postgres, Redis

### 4. Factor VI (Procesos): Garantizar stateless [COMPLETED]
- Eliminar volumen local `./mocks` de `vcenter-operations`: incrustar mocks en imagen de contenedor o usar ConfigMap
- Verificar que ningún servicio almacene estado en memoria/archivos locales (sesiones en Redis)
- Actualizar `vcenter-operations/Dockerfile` para incluir mocks si es necesario

### 5. Factor V (Build/Release/Run): Configurar registro de contenedores [COMPLETED]
- Elegir registro (Docker Hub, ECR, GCR)
- Actualizar `pipeline.sh` para pushear imágenes con tags semánticos: `antigravity/<servicio>:vX.Y.Z`
- Probar push/pull de imágenes al registro

### 6. Factor IX (Desechabilidad): Verificar graceful shutdown [COMPLETED]
- Confirmar que todos los servicios manejen `SIGTERM` correctamente
- Agregar handlers de cierre graceful si faltan (Node.js, Python, Go)
- Probar con `docker stop` para confirmar que no se caen requests

---

## Fase 2: Diseño de Recursos Kubernetes
### 7. Namespace [COMPLETED]
- Crear namespace `vcenter-provisioner`
- Manifest: `k8s/base/namespace.yaml`

### 8. Secrets [COMPLETED]
- Lista de secrets requeridos (`vcenter-provisioner-secrets`):
  - `POSTGRES_USER`
  - `POSTGRES_PASSWORD`
  - `INTERNAL_API_TOKEN`
- Usar `kubectl create secret` o Sealed Secrets (para GitOps)
- No commitear valores reales a git

### 9. ConfigMaps [COMPLETED]
- ConfigMap global `vcenter-provisioner-config` (valores no sensibles):
  - `PORT` por servicio
  - URLs de servicios (`AUTH_SERVICE_URL`, `TYPING_SERVICE_URL`)
  - Intervalos de probes (`PROBE_INTERVAL`)
- Manifests: `k8s/base/configmaps/`

### 10. PersistentVolumeClaims (PVCs) [COMPLETED]
| Recurso | Tamaño | Modo Acceso | StorageClass |
|---------|--------|-------------|--------------|
| Postgres | 10Gi | ReadWriteOnce | default |
| Redis | 2Gi | ReadWriteOnce | default |
- Manifests: `k8s/base/pvcs/`

### 11. Réplicas y Resource Requests/Limits [COMPLETED]
| Servicio | Réplicas | CPU Request | CPU Limit | Memory Request | Memory Limit |
|---------|----------|-------------|-----------|----------------|--------------|
| postgres (StatefulSet) | 1 | 500m | 1 | 512Mi | 1Gi |
| redis (StatefulSet) | 1 | 100m | 500m | 128Mi | 512Mi |
| auth-service | 2 | 100m | 300m | 128Mi | 256Mi |
| typing-service | 2 | 100m | 300m | 128Mi | 256Mi |
| credential-manager | 2 | 100m | 300m | 128Mi | 256Mi |
| vcenter-operations | 2 | 100m | 300m | 128Mi | 256Mi |
| vm-orchestrator | 2 | 100m | 300m | 128Mi | 256Mi |
| stats-service | 2 | 100m | 300m | 128Mi | 256Mi |
| monitoring-service | 2 | 100m | 300m | 128Mi | 256Mi |
| api-gateway | 2 | 100m | 300m | 128Mi | 256Mi |
| provisioner-ui | 2 | 50m | 200m | 64Mi | 128Mi |
| backup-service | 1 | 50m | 200m | 64Mi | 128Mi |

### 12. Probes (Liveness/Readiness) [COMPLETED]
- Alineados a healthchecks de docker-compose existentes:
  - Path: `/health`
  - Port: Puerto del servicio
  - Initial delay: 5s
  - Period: 10s
  - Timeout: 5s
  - Failure threshold: 3
- Ejemplo para `api-gateway`:
  ```yaml
  livenessProbe:
    httpGet:
      path: /health
      port: 3000
    initialDelaySeconds: 5
    periodSeconds: 10
    timeoutSeconds: 5
    failureThreshold: 3
  readinessProbe:
    httpGet:
      path: /health
      port: 3000
    initialDelaySeconds: 3
    periodSeconds: 5
    timeoutSeconds: 3
    failureThreshold: 2
  ```
- Aplica a todos los microservicios, Postgres y Redis

---

## Fase 3: Manifiestos Kubernetes
### 13. Backing Services (StatefulSets) [COMPLETED]
- Postgres 15: StatefulSet, PVC, Service (ClusterIP)
- Redis 7: StatefulSet, PVC, Service (ClusterIP)
- Usar Helm charts oficiales (Bitnami) o manifiestos custom
- Manifests: `k8s/base/backing-services/`

### 14. Core Microservicios (Deployments) [COMPLETED]
- Actualizar `apps/*/k8s/deployment.yaml` existentes para incluir:
  - Imagen de registro (no local)
  - Referencias a ConfigMap/Secret
  - Requests/limits
  - Probes
  - Réplicas
- Orden de despliegue (por dependencias):
  1. auth-service
  2. typing-service
  3. credential-manager
  4. vcenter-operations
  5. vm-orchestrator
  6. stats-service
  7. monitoring-service
  8. api-gateway
  9. provisioner-ui
  10. backup-service

### 15. Services (ClusterIP) [COMPLETED]
- Crear Services ClusterIP para todos los deployments
- Actualizar `apps/*/k8s/service.yaml` existentes
- Manifests: `k8s/base/services/`

### 16. Ingress [COMPLETED]
- Instalar Nginx Ingress Controller
- Regla de Ingress:
  - `/*` → `provisioner-ui:80`
  - `/api/*` → `api-gateway:3000`
- Manifests: `k8s/base/ingress/`

### 17. Cert-Manager [COMPLETED]
- Instalar cert-manager via Helm
- Crear ClusterIssuer para Let's Encrypt (staging/prod)
- Actualizar Ingress para usar TLS con anotaciones de cert-manager
- Timing: Después de Ingress funcional, antes de despliegue a producción

### 18. HPA (Autoescalado) [COMPLETED]
- Instalar metrics-server
- Crear HPA para servicios sin estado (api-gateway, auth-service, etc.)
- Ejemplo: HPA para api-gateway (target CPU 70%)
- Manifests: `k8s/base/hpa/`

### 19. Job de Migraciones (Factor XII) [COMPLETED]
- Convertir servicio `migrations` de docker-compose a K8s Job
- Idempotente, `restartPolicy: OnFailure`
- Manifest: `k8s/base/jobs/migrations.yaml`

---

## Fase 4: Paridad Dev/Prod (Factor X)
### 20. Kustomize Overlays [COMPLETED]
```
k8s/
├── base/          # Manifiestos comunes
├── overlays/
    ├── dev/       # Dev (1 réplica, sin TLS)
    ├── staging/   # Staging (réplicas medias, test data)
    └── prod/      # Prod (HPA, TLS, réplicas altas)
```

---

## Fase 5: CI/CD
### 21. Actualizar pipeline.sh para K8s [COMPLETED]
- Agregar comandos:
  - `./pipeline.sh --k8s-deploy` (despliegue a dev)
  - `./pipeline.sh --k8s-prod` (despliegue a prod)
- Pasos: push de imágenes, apply de manifiestos, verificación

### 22. Testing en K8s [COMPLETED]
- Ejecutar tests híbridos en entorno dev de K8s
- Verificar salud de todos los servicios
- Probar failover, escalado, graceful shutdown

---

## Fase 6: Producción
### 23. Despliegue a Producción [IN PROGRESS]
- Aplicar overlay de prod: `kubectl apply -k k8s/overlays/prod`
- Verificar pods: `kubectl get pods -n vcenter-provisioner`
- Probar acceso externo vía Ingress
- Monitorear con monitoring-service

### 24. Limpieza de Docker Compose [PENDING]
- Deprecar `docker-compose.yml` después de validar K8s
- Actualizar documentación a K8s

---

---

## Fase 7: Post-Migración — Hardening & Best Practices

### 25. Refresh Token Rotation [COMPLETED]
- **Problema**: JWT reusable 8h tras logout. No hay forma de invalidar tokens activos.
- **Implementación**:
  - Auth-service: endpoint `POST /refresh` que emite nuevo `access_token` (15min) + `refresh_token` (7d, one-use) ✓
  - `access_token`: firmado con `jti` único, 15min de vida ✓
  - `refresh_token`: opaco (UUID v4), almacenado en DB, un solo uso (rotate on each refresh) ✓
  - Frontend: interceptor en `api.ts` captura 401 → refresh automático → retry original request ✓
  - Lock `refreshPromise` para evitar race conditions en requests concurrentes ✓
- **Tocó**: `apps/auth-service/src/server.ts` (login, `/refresh`), `apps/provisioner-ui/src/utils/api.ts`, `apps/provisioner-ui/src/contexts/AuthContext.tsx`, `apps/provisioner-ui/src/pages/LoginPage.tsx`
- **Imagen**: `auth-service:v3`, `provisioner-ui:v11`
- **Migraciones**: `1773800000010_refresh_tokens`

### 26. Server-side Token Blacklist [COMPLETED]
- **Problema**: No hay blacklist de JWTs. Token robado es usable hasta expirar.
- **Implementación**:
  - Tabla `token_blacklist(jti TEXT PK, blacklisted_at TIMESTAMPTZ, expires_at TIMESTAMPTZ)` ✓
  - Auth-service checkea `jti` contra blacklist en `/verify` ✓
  - Login firma JWT con `jti` único ✓
  - Logout inserta `jti` en blacklist con `exp` del token ✓
  - `/logout-all` blacklistea + invalida todas las sessions ✓
  - Pendiente: CronJob de limpieza periódica (`DELETE FROM token_blacklist WHERE expires_at < NOW()`)
- **Tocó**: `apps/auth-service/src/server.ts` (login, `/verify`, `/logout`, `/logout-all`)
- **Imagen**: `auth-service:v3`
- **Migraciones**: `1773800000009_token_blacklist`

### 27. Rate Limiting en Login [COMPLETED]
- **Problema**: Login sin rate-limit permite fuzzing/fuerza bruta.
- **Implementación**:
  - `@fastify/rate-limit` en auth-service: 5 intentos/minuto por IP ✓
  - Headers `Retry-After` en respuesta 429 ✓
  - Global: 100 req/min (deshabilitado global), 5 req/min en `/login` ✓
- **Archivos modificados**: `apps/auth-service/src/server.ts`, `apps/auth-service/package.json` (add `@fastify/rate-limit`)

### 28. Feature Flags [COMPLETED]
- **Problema**: Custom Charts visible sin backend CRUD. Componentes sin feature gating.
- **Archivos afectados**:
  - `StatsWidgets.tsx:5` → import de `CustomChartsEditor`
  - `StatsWidgets.tsx:51` → type `TabType` incluye `'custom'`
  - `StatsWidgets.tsx:110` → tab definition `{ id: 'custom', label: 'Custom Charts' }`
  - `StatsWidgets.tsx:121-122` → render: `case 'custom': return <CustomChartsEditor />`
  - `CustomChartsEditor.tsx` → 407 líneas, 6 llamadas API a `/custom-charts/*` (endpoint inexistente)
  - `index.ts:5` → re-export
- **Implementación**:
  - Crear `src/utils/features.ts`:
    ```typescript
    export const FEATURES = {
      CUSTOM_CHARTS: import.meta.env.VITE_FEATURE_CUSTOM_CHARTS === 'true',
      ADVANCED_STATS: import.meta.env.VITE_FEATURE_ADVANCED_STATS !== 'false',
      BULK_IMPORT: false,
    }
    ```
  - `StatsWidgets.tsx`: UI-level gating (componente sigue bundleado; si se quiere exclusion real del bundle, usar `React.lazy()` + dynamic import)
    ```typescript
    const tabs = [
      { id: 'overview', label: 'Overview' },
      { id: 'vmclass', label: 'By VM Class' },
      { id: 'vcenter', label: 'By vCenter' },
      ...(FEATURES.CUSTOM_CHARTS ? [{ id: 'custom' as TabType, label: 'Custom Charts' }] : []),
    ]
    ```
  - Enables: `true` en dev (`VITE_FEATURE_CUSTOM_CHARTS=true`), `false` en prod (default)
  - **No interactúa** con gateway, Contour, ni deployments K8s — solo frontend
- **Archivos modificados**: `apps/provisioner-ui/src/utils/features.ts` (creado), `apps/provisioner-ui/src/components/Stats/StatsWidgets.tsx` (import + tabs)

### 29. API Client Unificado [COMPLETED]
- **Problema**: 3 `fetch()` directos bypassan `ApiClient`:
  - `LoginPage.tsx:57` → `fetch('/auth/login', { method: 'POST', headers, credentials: 'include', body })`
  - `AuthContext.tsx:46` → `fetch('/auth/me', { method: 'GET', headers: { Authorization } })`
  - `AuthContext.tsx:80` → `fetch('/auth/logout', { method: 'POST', headers: { Authorization } })`
- **Trazado de rutas** (cómo llega cada request a su backend):
  ```
  Frontend                         Contour                    api-gateway              Backend
  api.post('/auth/login')        → /api/auth/login           → /auth/login → /login    auth-service:3001/login
  api.get('/auth/me')            → /api/auth/me              → /auth/me    → /me       auth-service:3001/me
  api.post('/auth/logout')       → /api/auth/logout          → /auth/logout → /logout  auth-service:3001/logout

  /api  → Contour replacePrefix: /api→/    →  api-gateway recibe /auth/*
  /auth → gateway rewritePrefix: '/'       →  auth-service recibe /login, /me, /logout
  ```
- **Migración**:
  - `LoginPage.tsx:57`: `api.post('/auth/login', formData)` — seguro, token es null en login (ApiClient no envía `Authorization` cuando no hay token)
  - `AuthContext.tsx:46`: `api.get('/auth/me')` — ApiClient añade `Bearer` automáticamente
  - `AuthContext.tsx:80`: `api.post('/auth/logout')` — idem
- **Tabla completa de rewrites del gateway** (`apps/api-gateway/src/index.ts:104-180`):
  | Prefijo gateway | rewritePrefix | Backend recibe | Servicio destino |
  |---|---|---|---|
  | `/auth/*` | `/` | `/login`, `/me`, `/logout` | auth-service:3001 |
  | `/typing/*` | `''` | `/vm-classes`, etc. (preserva) | typing-service:3002 |
  | `/provision/*` | `''` | (preserva prefijo) | vm-orchestrator:3003 |
  | `/vcenters/*` | `/api/vcenters` | `/api/vcenters/123` (agrega) | credential-manager:3004 |
  | `/vcenter-data/*` | `''` | (preserva prefijo) | vcenter-operations:3005 |
  | `/stats/*` | `/stats` | `/stats/timeline` (preserva) | stats-service:3006 |
  | `/dashboard/monitoring/*` | `/api` | `/api/services-status` | monitoring-service:3007 |
- **Beneficio**: centraliza headers, 401 handling (refresh automático), timeouts, logging, consistent credentials/include policy, content-type, signal, retry
- **Archivos modificados**: `apps/provisioner-ui/src/pages/LoginPage.tsx` (fetch→api.post), `apps/provisioner-ui/src/contexts/AuthContext.tsx` (fetch→api.get/api.post)
- **Verificado** con playwright-cli: login → /dashboard, stats muestra 3 tabs sin Custom Charts

### 30. Error Boundary Global [COMPLETED]
- **Problema**: Errores inesperados de render/runtime pueden desmontar la UI React.
- **Archivo destino**: `apps/provisioner-ui/src/App.tsx`
- **Implementación**:
  - Componente clase `ErrorBoundary` (React class component, no existe hook equivalente para error boundaries) en `src/components/ErrorBoundary.tsx`
  - Wrapper en `App.tsx`:
    ```typescript
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
    ```
  - Fallback UI: mensaje "Algo salió mal" + botón "Recargar página" (`window.location.reload()`)
  - Log: `console.error(error, errorInfo)` + opcional POST a monitoring-service
  - **Limitación**: ErrorBoundary solo captura errores de render, lifecycle y constructor. NO captura errores async (fetch, event handlers, setTimeout, promises rechazadas sin `.catch()`).
  - **No interactúa** con gateway, Contour, ni K8s — solo frontend React
- **Archivos modificados**: `apps/provisioner-ui/src/components/ErrorBoundary.tsx` (creado), `apps/provisioner-ui/src/App.tsx` (wrapper)

### 31. Request Timeout Global [COMPLETED]
- **Problema**: `api.ts` no tiene timeout (line 85: `request<T>` recibe `RequestInit` sin `timeout`). Requests cuelgan indefinidamente.
- **Cadena de timeouts actual**:
  | Capa | Timeout | Fuente |
  |---|---|---|
  | Contour/Envoy | Sin configurar (defaults de versión) | `k8s/base/httpproxy/...yaml` sin `timeoutPolicy` |
  | api-gateway (Fastify) | 30s | `proxyTimeout: 30000` en cada `register(proxy)` |
  | Frontend (api.ts) | **Ninguno** ← brecha | No hay AbortController |
- **Implementación**:
  - AbortController con timeout por defecto 10s en `ApiClient.request()` (`api.ts:85`):
    ```typescript
    private async request<T>(endpoint: string, options: RequestInit & { timeout?: number } = {}): Promise<T> {
      const { timeout = 10000, ...fetchOptions } = options;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      fetchOptions.signal = controller.signal;
      try {
        // ...existing fetch code...
        return await this.processResponse<T>(response);
      } finally {
        clearTimeout(timer);
      }
    }
    ```
  - Timeout configurable por endpoint: `api.get('/slow-report', { timeout: 30000 })`
  - Captura `AbortError` → `ApiError(408, 'Request timed out')`
- **Verificación de compatibilidad**: No se identificaron endpoints streaming/SSE/EventSource/WebSocket en el código actual de los 6 servicios (verificado con grep). Timeout de 10s es seguro.
- **No afecta K8s probes**: `livenessProbe`/`readinessProbe` apuntan al container port (`:3001/health`), no pasan por Contour ni por `api.ts`.
- **Archivos modificados**: `apps/provisioner-ui/src/utils/api.ts` (request + get/post/put/delete timeout param)
- **Tag**: `provisioner-ui:v11` → `v12` (build + push + kubectl apply -k)

### 32. Salud de Backend — CronJob de Health Checks [PENDING]
- **Problema**: Health checks solo manuales via kubectl exec.
- **Implementación**:
  - CronJob cada 5min que corre `kubectl exec` en cada servicio
  - Reporta a monitoring-service si algún endpoint falla
  - Manifest: `k8s/base/cronjobs/health-check.yaml`

### 33. CA Rotation Audit [COMPLETED]
- **Hallazgo**: `cert-manager/vcenter-ca-secret` (old CA) ≠ `vcenter-provisioner-dev/vcenter-ca-secret` (new CA)
- **Server cert** firmado por old CA (Subject Key Identifier: `01:E0:3E:C9:D5:31:1D:AB:E2:3B:62:F4:96:07:F7:4B:6E:4F:7B:D1`)
- **Riesgo**: Si cert-manager Issuer se actualiza al new CA, el TLS cert dejará de ser válido
- **Acción recomendada**: Verificar que el Issuer de cert-manager apunte al CA correcto. Si hay dos CAs, documentar cuál es la autoridad actual.

### 34. Automatización de Image Tags [PENDING]
- **Problema**: Tags manuales (`v8→v9→v10`) propensos a error humano.
- **Implementación**:
  - CI pipeline: `git describe --tags --always` genera tag único
  - O usar timestamp: `YYYYMMDD-HHMMSS-<commit_short>`

### 35. Pre-commit Hook: TypeScript Check [PENDING]
- **Problema**: Errores de tipo pueden llegar a build.
- **Implementación**:
  - `husky` + `lint-staged` en `provisioner-ui/package.json`
  - Hook: `npx tsc --noEmit` en staged `.ts/.tsx` files
  - Bloquea commit si falla

### 36. Playwright Regression Suite [PENDING]
- **Problema**: Tests manuales no repetibles.
- **Implementación**:
  - Script autónomo `test/regression.js` que ejecuta los 24 tests de QA
  - CI: corre contra dev después de cada deploy
  - Reporte PASS/FAIL con evidencia

### 37. Bug #1 — Live Preview Stale Closure [COMPLETED]
- **Problema**: `updateNamePreview` referenciaba `manualValueRef` obsoleto (stale closure) en `DashboardPage.tsx`, mostrando vista previa incompleta.
- **Fix**: Reemplazar `updateNamePreview()` en `handleInputChange` por paso directo del valor del evento (`manualValueRef.current = value; setManualValue(value); updateNamePreview(value)`).
- **Resultado**: Live preview ahora muestra el valor completo (ej: "AUD-RCE-hello-063" en lugar de trunco).
- **Archivo**: `apps/provisioner-ui/src/pages/DashboardPage.tsx`

### 38. Bug #2 — ResourcePoolSelector No Fetch al Cambiar Cluster [COMPLETED]
- **Problema**: `ResourcePoolSelector` no disparaba fetch de resource pools cuando `clusterId` cambiaba. El dropdown quedaba vacío/stale.
- **Fix**: Agregar `useEffect([clusterId])` que llama a `fetch()` cuando `clusterId` cambia.
- **Resultado**: Dropdown muestra "(sin conexión)" con botón Reintentar si vCenter no responde, confirmando que la auto-búsqueda se dispara al seleccionar cluster.
- **Archivo**: `apps/provisioner-ui/src/components/vcenter/ResourcePoolSelector.tsx`

### 39. Bug #3 — "Crear VM(s)" Button Bypass Preview [COMPLETED]
- **Problema**: Botón "Crear VM(s)" mostraba modal de preview en lugar de provisionar directamente. El type="submit" también causaba validaciones no deseadas.
- **Fix**: Cambiar `type="submit"` → `type="button"`, eliminar guard `vmNameList.length === 0`, wire onClick directamente a `handleConfirmSubmit`.
- **Resultado**: Botón "Crear VM(s)" ahora envía el formulario directamente (POST /provision → 202). Botón "Vista Previa" mantiene el modal de confirmación para usuarios que quieran previsualizar antes.
- **Archivo**: `apps/provisioner-ui/src/pages/DashboardPage.tsx`
- **Tags**: `provisioner-ui:v13` → `v14` (bug fix), `api-gateway:v14` → `v15` (rewritePrefix)

## Leyenda de Estados
- [PENDING]: No iniciado
- [IN PROGRESS]: En progreso
- [COMPLETED]: Completado
- [BLOCKED]: Bloqueado por dependencia
