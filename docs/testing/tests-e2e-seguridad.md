---
description: "Tests E2E, integración, performance, seguridad, accesibilidad. Inventario y patrones."
category: testing
priority: medium
agent_role: test
---

# tests-e2e-seguridad.md — API, Integración, E2E, Performance, Seguridad, Accesibilidad

**Versión:** 1.0 | **Alcance:** Endpoints, Integración, E2E, Carga, Seguridad, WCAG 2.1 AA

---

## Inventario de Endpoints API

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/auth/login` | No | Login |
| POST | `/auth/logout` | No | Logout (limpia cookie) |
| GET | `/auth/me` | JWT | Usuario autenticado |
| GET | `/api/health` | No | Health check gateway |
| GET | `/api/vcenters` | JWT | Listar conexiones vCenter |
| POST | `/api/vcenters` | JWT | Crear conexión |
| POST | `/api/vcenters/test-temp` | JWT | Test de conexión |
| POST | `/api/vcenters/discover/datacenters` | JWT | Descubrir datacenters |
| POST | `/api/vcenters/discover/clusters` | JWT | Descubrir clusters |
| GET | `/api/typing/templates` | JWT | Listar plantillas |
| POST | `/api/typing/templates` | JWT | Crear plantilla |
| GET | `/api/vm-classes` | JWT | Listar clases VM |
| POST | `/api/typing/vm-classes` | JWT | Crear clase VM |
| GET | `/api/stats/summary` | JWT | Resumen stats |
| GET | `/api/stats/by-vcenter` | JWT | Stats por vCenter |
| GET | `/api/stats/by-vmclass` | JWT | Stats por clase VM |
| GET | `/api/stats/failures?limit=N` | JWT | Fallos recientes |
| GET | `/api/stats/recent?limit=N` | JWT | Actividad reciente |
| POST | `/api/provision` | JWT | Aprovisionar VM |
| GET | `/api/vcenter-data/resource-pools` | JWT | Resource pools |
| GET | `/api/vcenter-data/storage-policies` | JWT | Storage policies |
| GET | `/api/dashboard/monitoring/services-status` | JWT | Estado servicios |
| GET | `/api/dashboard/monitoring/services-history` | JWT | Historial servicios |
| GET | `/api/dashboard/monitoring/services-timeseries` | JWT | Series temporales |
| GET | `/api/dashboard/monitoring/connectivity-matrix` | JWT | Conectividad |

### Hallazgos de Seguridad en API

| # | Hallazgo | Gravedad | Recomendación |
|---|----------|----------|---------------|
| 1 | CORS refleja cualquier origen + `allow-credentials: true` | Crítico | Restringir a lista blanca |
| 2 | Cookie `session_id` sin `Secure` ni `HttpOnly` | Alto | Secure + HttpOnly + SameSite=Strict |
| 3 | Sin `Content-Security-Policy` | Medio | Implementar CSP estricto |
| 4 | Sin HSTS (`Strict-Transport-Security`) | Medio | HSTS con preload |
| 5 | Formato de error inconsistente (8 formatos) | Medio | Unificar a `{error, message, statusCode}` |
| 6 | Rate limiting solo en `/auth/login` | Medio | Extender a `/api/*` |

- **Schema de error recomendado:** `{"error": "<codigo>", "message": "<texto>", "statusCode": <http>}`

---

## Pruebas de Integración

| Categoría | Tests | Descripción |
|-----------|-------|-------------|
| Gateway ↔ Auth | 5 | Registro, Login, Verify Token, Token Inválido, Rutas Protegidas |
| Gateway → Typing | 3 | Health Check, Crear Template, Listar Templates |
| Gateway → Orchestrator | 2 | Status Endpoint, Provision VM |
| Full E2E Flow | 1 | Register → Login → Crear Template → Provision VM |
| Error Handling | 2 | Fallos Auth, Requests Inválidos |
| Concurrent Requests | 1 | 5 provisiones simultáneas |
| **Total** | **14** | 100% flujos críticos |

---

## Pruebas E2E (Playwright)

- **Login Flow** (8 tests): Visualización, credenciales inválidas, campos requeridos, redirección, persistencia JWT, errores red, rutas protegidas
- **Login Accessibility** (3 tests): Teclado, Enter, labels ARIA
- **Provisioning Wizard** (11 tests): Visualización, stepper 4 pasos, template, navegación, recursos vCenter, validación, resumen, submit, flujo completo
- **Typifications Page** (9 tests): Visualización, estado vacío, CRUD, validación, búsqueda
- **Typifications Accessibility** (2 tests): Teclado, labels ARIA
- **Full E2E Flow** (1 test): Login → Template → Wizard → Submit

| Navegador | Tipo | Total tests | Tiempo |
|-----------|------|-------------|--------|
| Chromium, Firefox, WebKit | Desktop | 34 | ~2-3 min |
| Mobile Chrome, Mobile Safari | Mobile | 100% cobertura | — |

---

## Pruebas de Performance (k6)

| Test | Usuarios | Duración | Error Rate Obj. | Latencia Avg Obj. |
|------|----------|----------|-----------------|-------------------|
| Auth Load | 10 → 50 | 3.5 min | <10% | <300ms |
| Provision Load | 10 → 50 | 3.5 min | <5% | <500ms |
| Full Flow Load | 10 → 50 | 5.5 min | <10% | <1000ms |

- **Patrón:** Ramp Up 30s → Steady 1-2 min → Ramp Up 30s → Steady → Ramp Down 30s
- **Métricas:** `auth_errors/latency`, `provision_errors/latency`, `full_flow_errors/latency`. **Thresholds:** `http_req_duration` p95 < objetivo; `*_errors` rate < objetivo; `*_latency` avg < objetivo

---

## Pruebas de Seguridad

### JWT Edge Cases (9 tests)

| Test | Descripción |
|------|-------------|
| Token expirado | Rechazar fuera de vigencia |
| Token malformado | Rechazar formato inválido |
| Algoritmo incorrecto | Rechazar firma con algoritmo distinto |
| Token servicio externo | Rechazar token de otro emisor |
| Payload manipulado | Rechazar payload alterado |
| Partes faltantes | Rechazar token incompleto |
| Ataque de replay | Detectar reuso |
| XSS en payload | Rechazar inyección XSS |
| SQL injection en payload | Rechazar inyección SQL |

### RBAC (4 tests)

| Test | Resultado esperado |
|------|--------------------|
| Admin → endpoints admin | Permitido |
| Operator → aprovisionamiento | Permitido |
| Usuario regular → admin | Denegado |
| Escalamiento de rol | Prevenido |

### Input Validation (5 tests)

| Test | Descripción |
|------|-------------|
| Sanitización HTML | Inputs HTML escapados |
| Prevención SQL injection | Inputs no ejecutan SQL |
| Validación formato email | Formato inválido rechazado |
| Complejidad contraseña | Contraseñas débiles rechazadas |
| Prevención command injection | Inputs no ejecutan comandos |

### Rate Limiting (2 tests)

| Test | Descripción |
|------|-------------|
| Fuerza bruta login | Bloqueo tras N intentos |
| Ráfaga solicitudes | 429 tras límite |

---

## Accesibilidad (WCAG 2.1 AA)

**Framework:** axe-core + Playwright

| Página | Tests | Cobertura |
|--------|-------|-----------|
| Login Page | 6 | 100% |
| Provisioning Wizard | 7 | 100% |
| Typifications Page | 6 | 100% |
| Dashboard | 4 | 100% |
| Screen Reader | 4 | 100% |
| **Total** | **27** | 100% rutas UI críticas |

---

## Frameworks

| Lenguaje | Framework | Servicios |
|----------|-----------|-----------|
| Python | pytest | typing-service, stats-service |
| Node.js | Vitest | api-gateway, auth-service, credential-manager |
| Go | go test | vm-orchestrator, vcenter-operations, monitoring-service |
| E2E | Playwright | provisioner-ui |
| Perf/Seg | k6, ZAP, axe-core | API + UI |
