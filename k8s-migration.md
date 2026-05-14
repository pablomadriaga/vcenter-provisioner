# Kubernetes Migration Plan (Alineado a 12-Factor)
> Estados: [PENDING], [IN PROGRESS], [COMPLETED], [BLOCKED]

---

## Pre-Migración
### 1. Commit de estado actual [COMPLETED]
### 2. Creación de branch `k8s` [COMPLETED]

---

## Fase 1: Remediación de Gaps 12-Factor
### 3. Factor III (Config): Eliminar secrets hardcodeados [COMPLETED]
### 4. Factor VI (Procesos): Garantizar stateless [COMPLETED]
### 5. Factor V (Build/Release/Run): Configurar registro de contenedores [COMPLETED]
### 6. Factor IX (Desechabilidad): Verificar graceful shutdown [COMPLETED]

---

## Fase 2: Diseño de Recursos Kubernetes
### 7. Namespace [COMPLETED] — `k8s/base/namespace.yaml`
### 8. Secrets [COMPLETED] — `vcenter-provisioner-secrets` + per-service secrets
### 9. ConfigMaps [COMPLETED] — `k8s/base/configmaps/`
### 10. PersistentVolumeClaims [COMPLETED] — Postgres 10Gi, Redis 2Gi
### 11. Réplicas y Resource Requests/Limits [COMPLETED] — 10 microservicios, 2 réplicas c/u (1 dev)
### 12. Probes (Liveness/Readiness) [COMPLETED] — `/health` en todos los servicios

---

## Fase 3: Manifiestos Kubernetes
### 13. Backing Services (StatefulSets) [COMPLETED] — Postgres 15, Redis 7
### 14. Core Microservicios (Deployments) [COMPLETED] — Todos los deployments con envFrom, probes, securityContext
### 15. Services (ClusterIP) [COMPLETED] — `k8s/base/services/`
### 16. Ingress [COMPLETED] — Contour HTTPProxy (`vc-ui.playground.net`)
### 17. Cert-Manager [COMPLETED] — Let's Encrypt staging/prod + CA interno
### 18. HPA (Autoescalado) [COMPLETED] — target CPU 70%
### 19. Job de Migraciones (Factor XII) [COMPLETED] — `k8s/base/jobs/migrations.yaml`

---

## Fase 4: Paridad Dev/Prod (Factor X)
### 20. Kustomize Overlays [COMPLETED] — base/ + overlays/{dev,staging,prod}

---

## Fase 5: CI/CD
### 21. Actualizar pipeline.sh para K8s [COMPLETED]
### 22. Testing en K8s [COMPLETED]

---

## Fase 6: Producción
### 23. Despliegue a Producción [IN PROGRESS]
### 24. Limpieza de Docker Compose [PENDING]

---

## Fase 7: Post-Migración — Hardening & Best Practices

### 25. Refresh Token Rotation [COMPLETED]
- `POST /refresh` con one-use refresh_token (UUID v4), stored en DB
- Frontend: 401 → refresh automático con lock (`refreshPromise`)
- **Tags**: `auth-service:v3`, `provisioner-ui:v11`

### 26. Server-side Token Blacklist [COMPLETED]
- Tabla `token_blacklist(jti)`, check en `/verify`, insert en `/logout`
- **Pendiente**: CronJob de limpieza periódica

### 27. Rate Limiting en Login [COMPLETED]
- `@fastify/rate-limit`: 5 req/min en `/login`, 429 con `Retry-After`

### 28. Feature Flags [COMPLETED]
- `src/utils/features.ts` con flags por env var (`VITE_FEATURE_*`)
- Custom Charts gated tras `FEATURES.CUSTOM_CHARTS`

### 29. API Client Unificado [COMPLETED]
- 3 `fetch()` directos migrados a `api.post/get` (LoginPage, AuthContext)
- Centraliza headers, 401 handling, timeouts, logging

### 30. Error Boundary Global [COMPLETED]
- `ErrorBoundary` class component wrappea `<RouterProvider>` en App.tsx

### 31. Request Timeout Global [COMPLETED]
- AbortController con 10s default en `api.ts`, configurable por endpoint

### 32. Salud de Backend — CronJob de Health Checks [PENDING]
- Diseño pendiente: watchdog externo cada 5 min, reporta a monitoring-service

### 33. CA Rotation Audit [COMPLETED]
- Dos CAs detectadas (old vs new). Verificar Issuer antes de prod.

### 34. Automatización de Image Tags [PENDING]
### 35. Pre-commit Hook: TypeScript Check [PENDING]
### 36. Playwright Regression Suite [PENDING]

### 37. Bug #1 — Live Preview Stale Closure [COMPLETED]
- Fix: pasar valor directo en lugar de `manualValueRef` en `DashboardPage.tsx`
- **Resultado**: Live preview muestra valor completo (ej: "AUD-RCE-hello-063")

### 38. Bug #2 — ResourcePoolSelector No Fetch [COMPLETED]
- Fix: `useEffect([clusterId])` en `ResourcePoolSelector.tsx`
- **Resultado**: Auto-fetch al cambiar cluster, error state con Reintentar

### 39. Bug #3 — "Crear VM(s)" Button [COMPLETED]
- Fix: `type="submit"` → `type="button"`, onClick directo a `handleConfirmSubmit`
- **Tags**: `provisioner-ui:v13→v14`, `api-gateway:v14→v15`

### 40. Seguridad: Remover fallbacks hardcodeados en source [COMPLETED]
- `auth-service/src/server.ts`: `JWT_SECRET || 'antigravity-tier0-secret'` → `requireEnv('JWT_SECRET')`
- `auth-service/src/db.ts` + `knexfile.ts`: `DB_URL || 'postgresql://...'` → `requireEnv('DB_URL')`
- `credential-manager/src/index.ts`: `VCENTER_MASTER_KEY` → agregado al Secret (estaba vacío)
- `auth-service/src/index.ts`: Seed de admin solo si `ADMIN_SEED_PASSWORD` env var está seteada
- **Tags**: `auth-service:v4→v5`

### 41. Seguridad: Data sensible fuera de Secrets [COMPLETED]
- `vcenter-operations/.env.example`: Eliminado `VCENTER_PASSWORD=Wetcom01!` (credencial real)
- `k8s/base/configmaps/vcenter-operations-config.yaml`: Eliminado `INTERNAL_API_TOKEN` default (ya está en Secret)
- `scripts/migrations.sh`: `DB_PASSWORD:-password123` → `${DB_PASSWORD:?FATAL:...}`

### 42. Seguridad: Fix typo en STATS_DB_URL [COMPLETED]
- `k8s/base/secrets/vcenter-provisioner-secrets.yaml`: `antgravity` → `antigravity`

## Leyenda de Estados
- [PENDING]: No iniciado
- [IN PROGRESS]: En progreso
- [COMPLETED]: Completado
- [BLOCKED]: Bloqueado por dependencia
