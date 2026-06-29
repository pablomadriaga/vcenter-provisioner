---
description: "Checklist de migración 12-Factor. Histórico: migración completada."
category: deployment
priority: low
agent_role: reference
---

# Plan de Migración a Kubernetes (Alineado a 12-Factor)

> **Migración completada.** Docker Compose se retiene para desarrollo local. Ver [ARCHITECTURE.md](../ARCHITECTURE.md) para estado actual.
>
> Estados: `[PENDING]` `[IN PROGRESS]` `[COMPLETED]` `[WONTFIX]` `[BLOCKED]`

---

## Fases Completadas (1–22)

| Fase | Items | Estado |
|:-----|:------|:------:|
| **Pre-Migración** | Commit inicial, branch `k8s` | COMPLETED |
| **Factor III** (Config) | Secrets hardcodeados → env vars | COMPLETED |
| **Factor VI** (Procesos) | Stateless garantizado | COMPLETED |
| **Factor V** (Build/Release/Run) | Registro de contenedores | COMPLETED |
| **Factor IX** (Desechabilidad) | Graceful shutdown | COMPLETED |
| **Recursos K8s** | Namespace, Secrets, ConfigMaps, PVCs, Probes | COMPLETED |
| **Manifiestos** | StatefulSets (PG, Redis), Deployments, Services, Ingress, Cert-Manager, HPA, Job migraciones | COMPLETED |
| **Factor X** (Paridad) | Kustomize overlays: `base/` + `overlays/{dev,staging,prod}` | COMPLETED |
| **CI/CD** | `pipeline.sh` actualizado, testing en K8s | COMPLETED |

---

## Producción

- **23.** Despliegue a Producción `[IN PROGRESS]`
- **24.** Limpieza de Docker Compose `[WONTFIX — Docker retenido para desarrollo local]`

---

## Post-Migración: Hardening & Correcciones

### 25. Refresh Token Rotation `[COMPLETED]`
`POST /refresh` con one-use refresh_token (UUID v4), stored en DB. Frontend: 401 → refresh automático con lock (`refreshPromise`).

### 26. Server-side Token Blacklist `[COMPLETED]`
Tabla `token_blacklist(jti)`, check en `/verify`, insert en `/logout`. Pendiente: CronJob de limpieza periódica.

### 27. Rate Limiting en Login `[COMPLETED]`
`@fastify/rate-limit`: 5 req/min en `/login`, 429 con `Retry-After`.

### 28. Feature Flags `[COMPLETED]`
`src/utils/features.ts` con flags por env var (`VITE_FEATURE_*`). Custom Charts gated tras `FEATURES.CUSTOM_CHARTS`.

### 29. API Client Unificado `[COMPLETED]`
3 `fetch()` directos migrados a `api.post/get` (LoginPage, AuthContext). Centraliza headers, 401 handling, timeouts.

### 30. Error Boundary Global `[COMPLETED]`
`ErrorBoundary` class component wrappea `<RouterProvider>` en App.tsx.

### 31. Request Timeout Global `[COMPLETED]`
AbortController con 10s default en `api.ts`, configurable por endpoint.

### 32. Salud de Backend — CronJob de Health Checks `[PENDING]`
Diseño pendiente: watchdog externo cada 5 min, reporta a monitoring-service.

### 33. CA Rotation Audit `[COMPLETED]`
Dos CAs detectadas (old vs new). Verificar Issuer antes de prod.

### 34. Automatización de Image Tags `[PENDING]`
### 35. Pre-commit Hook: TypeScript Check `[PENDING]`
### 36. Playwright Regression Suite `[PENDING]`

### 37. Bug #1 — Live Preview Stale Closure `[COMPLETED]`
Fix: pasar valor directo en lugar de `manualValueRef` en `DashboardPage.tsx`.

### 38. Bug #2 — ResourcePoolSelector No Fetch `[COMPLETED]`
Fix: `useEffect([clusterId])` en `ResourcePoolSelector.tsx`. Auto-fetch + error state con Reintentar.

### 39. Bug #3 — "Crear VM(s)" Button `[COMPLETED]`
Fix: `type="submit"` → `type="button"`, onClick directo a `handleConfirmSubmit`.

### 40. Seguridad: Remover fallbacks hardcodeados `[COMPLETED]`
`JWT_SECRET`, `DB_URL`, `VCENTER_MASTER_KEY`, seed de admin — todos requieren env vars sin fallback.

### 41. Seguridad: Data sensible fuera de Secrets `[COMPLETED]`
Credenciales reales eliminadas de `.env.example`, ConfigMaps y scripts de migración.

### 42. Seguridad: Fix typo en STATS_DB_URL `[COMPLETED]`
`antgravity` → `antigravity` en `k8s/base/secrets/vcenter-provisioner-secrets.yaml`.

---

## Leyenda
- `[PENDING]` No iniciado
- `[IN PROGRESS]` En progreso
- `[COMPLETED]` Completado
- `[WONTFIX]` No se implementará (justificación documentada)
- `[BLOCKED]` Bloqueado por dependencia
