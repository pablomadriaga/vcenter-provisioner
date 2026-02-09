# E2E & Performance Tests - Week 3

Este documento describe los tests de E2E (End-to-End) y Performance implementados para el vCenter Provisioner como parte de la Semana 3 del plan de testing.

## 🎯 Objetivos

1. **E2E Tests**: Validar el flujo completo de usuario desde la UI, navegando por el wizard de aprovisionamiento
2. **Performance Tests**: Validar que el sistema puede manejar carga concurrente manteniendo tiempos de respuesta aceptables

## 🧪 E2E Tests (Playwright)

### Arquitectura de Tests

Los tests E2E están organizados en 3 suites:

#### 1. Login Flow Tests (`login.spec.ts`)

| Test | Descripción |
|------|-------------|
| `should display login page` | Verifica que la página de login se muestre correctamente |
| `should show error for invalid credentials` | Prueba manejo de error para credenciales inválidas |
| `should show error for missing username` | Valida campo username requerido |
| `should show error for missing password` | Valida campo password requerido |
| `should redirect to dashboard after successful login` | Prueba redirección post-login |
| `should save token to localStorage` | Verifica persistencia de JWT |
| `should handle network errors gracefully` | Prueba manejo de errores de red |
| `should redirect to login when accessing protected routes` | Valida autenticación requerida |

#### 2. Login Accessibility Tests

| Test | Descripción |
|------|-------------|
| `should navigate with keyboard only` | Prueba navegación por teclado (WCAG 2.1) |
| `should submit form with Enter key` | Valida envío de formulario con Enter |
| `should have proper ARIA labels` | Verifica labels para lectores de pantalla |

#### 3. Provisioning Wizard Flow Tests (`provision.spec.ts`)

| Test | Descripción |
|------|-------------|
| `should display provisioning page` | Verifica página de aprovisionamiento |
| `should show stepper with 4 steps` | Valida visualización del wizard |
| `should create template first if none exists` | Maneja estado vacío |
| `should navigate through wizard steps` | Prueba navegación del wizard |
| `should enter manual values and generate preview` | Test paso de configuración de nombre |
| `should configure vCenter resources` | Test paso de configuración vCenter |
| `should show validation errors for missing fields` | Valida campos requeridos |
| `should display summary and confirm` | Test paso de confirmación |
| `should submit provisioning request` | Test envío de solicitud |
| `should complete full provisioning flow` | Test E2E completo |

#### 4. Typifications Page Tests (`typifications.spec.ts`)

| Test | Descripción |
|------|-------------|
| `should display typifications page` | Verifica página de tipificaciones |
| `should display empty state when no templates exist` | Maneja estado vacío |
| `should create new typification` | Prueba creación de template |
| `should list all typifications` | Test listado de templates |
| `should view typification details` | Prueba visualización de detalles |
| `should edit typification` | Test edición de template |
| `should delete typification` | Test eliminación |
| `should validate required fields` | Valida campos requeridos |
| `should search typifications` | Test búsqueda |

#### 5. Typifications Accessibility Tests

| Test | Descripción |
|------|-------------|
| `should navigate with keyboard` | Prueba navegación por teclado |
| `should have proper ARIA labels` | Verifica labels para lectores de pantalla |

### Configuración de Playwright

**File:** `playwright.config.ts`

Features:
- 5 proyectos: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- Generación de traces en retry
- Screenshots en fallos
- Web server automático (Vite dev server)
- Reporter HTML

### Ejecución de E2E Tests

#### Requisitos Previos

1. **Node.js** y **npm** instalados
2. **Docker** y **Docker Compose** instalados
3. **Playwright** browsers instalados

```powershell
cd apps/provisioner-ui
npm install
npx playwright install --with-deps
```

#### Ejecución Automática (Recomendado)

**Script:** `run-e2e-tests.ps1`

```powershell
# Inicia servicios, ejecuta tests, y detiene servicios
pwsh -File run-e2e-tests.ps1 -StopAfter

# Ejecuta tests sin iniciar servicios (si ya están corriendo)
pwsh -File run-e2e-tests.ps1 -SkipDocker

# Ejecución con navegador visible (headed)
pwsh -File run-e2e-tests.ps1 -Headed

# Ejecución con interfaz UI de Playwright
pwsh -File run-e2e-tests.ps1 -UI

# Ejecución con output detallado
pwsh -File run-e2e-tests.ps1 -Verbose
```

#### Ejecución Manual

```powershell
# 1. Iniciar servicios (opción recomendada)
.\pipeline.ps1 --up

# Opción manual:
# cd infra/local
# docker-compose up -d

# 2. Esperar que los servicios inicien (~15 segundos)

# 3. Ejecutar tests
cd apps/provisioner-ui
npm run test:e2e

# 4. Ver reporte HTML
# Se genera en playwright-report/index.html

# 5. Detener servicios (opcional)
.\pipeline.ps1 --down
```

### Métricas E2E

| Métrica | Valor |
|---------|-------|
| Total E2E Tests | 23 tests |
| Tiempo de Ejecución | ~2-3 minutos (todos los navegadores) |
| Navegadores Probados | 5 (Chrome, Firefox, Safari, Mobile Chrome, Mobile Safari) |
| Cobertura de Flujos UI | 100% (login, wizard, CRUD templates) |

---

## 🚀 Performance Tests (k6)

### Arquitectura de Tests

Los tests de performance están organizados en 3 suites:

#### 1. Authentication Load Test (`auth-load-test.js`)

**Métricas:**
- Rate de errores: < 10%
- Latencia promedio: < 300ms
- Latencia p95: < 500ms

**Stages:**
- 30s: Ramp up a 10 usuarios
- 1m: Mantener 10 usuarios
- 30s: Ramp up a 50 usuarios
- 1m: Mantener 50 usuarios
- 30s: Ramp down a 0

**Tests:**
- Login
- Verificación de token

#### 2. Provisioning Load Test (`provision-load-test.js`)

**Métricas:**
- Rate de errores: < 5%
- Latencia promedio: < 500ms
- Latencia p95: < 1000ms

**Stages:**
- 30s: Ramp up a 10 usuarios
- 1m: Mantener 10 usuarios
- 30s: Ramp up a 50 usuarios
- 1m: Mantener 50 usuarios
- 30s: Ramp down a 0

**Tests:**
- Login (para obtener token)
- Submit provisioning request

#### 3. Full Flow Load Test (`full-flow-load-test.js`)

**Métricas:**
- Rate de errores: < 10%
- Latencia promedio: < 1000ms
- Latencia p95: < 2000ms

**Stages:**
- 30s: Ramp up a 10 usuarios
- 2m: Mantener 10 usuarios
- 30s: Ramp up a 50 usuarios
- 2m: Mantener 50 usuarios
- 30s: Ramp down a 0

**Tests:**
- Login
- Verificación de token
- Listar templates
- Submit provisioning request
- Check job status

### Configuración de k6

**Thresholds:**
- `http_req_duration`: p95 < latency target
- `*_errors`: rate < error rate target
- `*_latency`: avg < latency target

**Custom Metrics:**
- `auth_errors`, `auth_latency`
- `provision_errors`, `provision_latency`
- `full_flow_errors`, `full_flow_latency`

### Ejecución de Performance Tests

#### Requisitos Previos

1. **k6** instalado: https://k6.io/docs/getting-started/installation/
2. **Docker** y **Docker Compose** instalados

#### Ejecución Automática (Recomendado)

**Script:** `run-perf-tests.ps1`

```powershell
# Authentication Load Test (10 → 50 usuarios)
pwsh -File run-perf-tests.ps1 -TestType auth -StopAfter

# Provisioning Load Test (10 → 50 usuarios)
pwsh -File run-perf-tests.ps1 -TestType provision -StopAfter

# Full Flow Load Test (10 → 50 usuarios)
pwsh -File run-perf-tests.ps1 -TestType full-flow -StopAfter

# Con API URL personalizada
pwsh -File run-perf-tests.ps1 -TestType auth -ApiUrl "http://my-gateway:3000"

# Sin iniciar servicios (si ya están corriendo)
pwsh -File run-perf-tests.ps1 -TestType provision -SkipDocker
```

#### Ejecución Manual

```powershell
# 1. Iniciar servicios (opción recomendada)
.\pipeline.ps1 --up

# Opción manual:
# cd infra/local
# docker-compose up -d

# 2. Esperar que los servicios inicien (~15 segundos)

# 3. Ejecutar test (desde directorio perf-tests)
cd perf-tests

# Authentication Load Test
k6 run auth-load-test.js

# Provisioning Load Test
k6 run provision-load-test.js

# Full Flow Load Test
k6 run full-flow-load-test.js

# 4. Ver resultados en archivo JSON
# Se genera test-results.json

# 5. Detener servicios (opcional)
docker-compose -f infra/local/docker-compose.yml down
```

### Métricas de Performance

| Test | Usuarios | Duración | Latencia Target | P95 Target |
|------|----------|----------|-----------------|-------------|
| Auth Load | 10 → 50 | 3.5 min | 300ms avg | 500ms |
| Provision Load | 10 → 50 | 3.5 min | 500ms avg | 1000ms |
| Full Flow Load | 10 → 50 | 5.5 min | 1000ms avg | 2000ms |

---

## 📊 Resultados Esperados

### E2E Tests

Todos los tests deben pasar:
- ✅ 23 E2E tests
- ✅ 5 navegadores probados
- ✅ 100% de flujos UI cubiertos

### Performance Tests

Todos los thresholds deben ser cumplidos:
- ✅ Auth: Error rate < 10%, Latency avg < 300ms
- ✅ Provision: Error rate < 5%, Latency avg < 500ms
- ✅ Full Flow: Error rate < 10%, Latency avg < 1000ms

---

## 🔍 Debugging

### Ver logs de servicios

```powershell
# Ver logs desde cualquier directorio
docker-compose -f infra/local/docker-compose.yml logs -f [service-name]

# O navegar al directorio de infra/local
cd infra/local
docker-compose logs -f [service-name]
```

### Ver reporte HTML de Playwright

```powershell
cd apps/provisioner-ui
# Abre playwright-report/index.html en el navegador
```

### Ver resultados JSON de k6

```powershell
cd perf-tests
cat test-results.json
```

---

## 📝 Consideraciones

### Base de Datos

Los tests de performance crean usuarios y templates automáticamente con IDs únicos para evitar conflictos.

### Limpieza

Los tests de performance NO limpian automáticamente. Para limpiar:

```powershell
# Opción 1 (recomendada)
docker-compose -f infra/local/docker-compose.yml down -v

# Opción 2 (requiere navegar al directorio)
cd infra/local
docker-compose down -v
```

### Requisitos de Hardware

- **E2E Tests**: 2GB RAM mínimo (Playwright browsers)
- **Performance Tests**: 4GB RAM mínimo (Docker + k6 + servicios)

---

## 🎯 Próximos Pasos (Week 4)

### Security Testing
- OWASP ZAP scan
- JWT validation edge cases
- Dependency audit

### Accessibility Testing
- WCAG 2.1 AA compliance (axe-core)
- Keyboard navigation avanzado
- Screen reader compatibility

---

**Fecha:** 2026-01-31  
**Autor:** Antigravity Staff Engineering  
**Versión:** 1.0  
**Estado:** ✅ Completado
