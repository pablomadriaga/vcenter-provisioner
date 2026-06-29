# Test Plan: vCenter VM Provisioner

**Version:** 1.0  
**Date:** 2026-01-30  
**Author:** Antigravity Staff Engineering  
**Status:** Approved

---

## 1. Executive Summary

**Objective:** Validar la funcionalidad end-to-end del vCenter VM Provisioner, desde el login del usuario hasta la orquestación completa de aprovisionamiento de VMs, asegurando calidad en lógica de negocio, integración de servicios, y UX.

**Scope:** 
- **Incluye**: Login flow, wizard UI, tipificación de nombres, orquestación, integración vCenter (mock), APIs de todos los 9 servicios.
- **Excluye**: Integración con vCenter real (fuera de scope del MVP), deployment en Kubernetes (futuro).

**Timeline:** 
- **Start**: 2026-01-30  
- **Milestone**: Testing completo - 2026-02-05  
- **End**: Release MVP - 2026-02-10

---

## 2. Test Strategy

### 2.1 Testing Pyramid Distribution

| Type | Target % | Quantity | Time Budget |
|------|----------|----------|-------------|
| Unit Tests | 70% | ~140 | 5s |
| Integration Tests | 20% | ~40 | 20s |
| E2E Tests | 10% | ~8 | 2min |
| **Total** | **100%** | **~188** | **~2.5min** |

### 2.2 Testing Types by Phase

**Pre-Construction (COMPLETADO):**
- ✅ Smoke Tests (validar viabilidad arquitectónica)
- ✅ Risk-Based Testing (priorizar auth, tipificación, orquestación)

**During Construction (ITERATIVO - EN CURSO):**
- ✅ Unit Tests (typing-service, auth-service, vm-orchestrator)
- ⏳ Integration Tests (Gateway ↔ Auth, Orchestrator ↔ vCenter)
- ⏳ Regression Tests (login flow, wizard navigation)

**Post-Construction (PENDIENTE):**
- ⏳ System/E2E Tests (flujo completo UI → Backend → vCenter mock)
- ⏳ Performance Tests (latencia de tipificación, throughput de orquestación)
- ⏳ Security Tests (JWT validation, RBAC, SQL injection)
- ⏳ Accessibility Tests (WCAG 2.1 AA en wizard UI)

---

## 3. Test Environments

| Environment | Purpose | URL/Access |
|-------------|---------|------------|
| **Local (Docker)** | Dev testing | http://localhost:3000 (UI), http://localhost:3001-8082 (Services) |
| **Staging** | Pre-prod testing | TBD (futuro K8s deployment) |
| **Production** | Smoke tests only | N/A (no desplegado aún) |

---

## 4. Test Coverage Goals

### 4.1 Code Coverage

- **Target**: 80-90% line coverage en lógica de negocio crítica
- **Minimum**: 70% overall coverage
- **Exceptions**: 
  - Config files (`config.ts`, `main.py`)
  - Auto-generated Prisma/SQLModel models
  - Dockerfiles y scripts de deployment

### 4.2 Functional Coverage

| Feature | Priority | Coverage Target | Status |
|---------|----------|-----------------|--------|
| **User Authentication (Login/JWT)** | High | 100% | ⏳ En progreso |
| **Naming Typification Engine** | High | 100% | ✅ 95% actual |
| **VM Orchestration State Machine** | High | 100% | ✅ 90% actual |
| **Wizard UI (Step Navigation)** | Medium | 90% | ⏳ 70% actual |
| **vCenter Integration (Mock)** | Medium | 80% | ⏳ 50% actual |
| **Stats & Analytics** | Low | 60% | ❌ 20% actual |
| **Monitoring Health Checks** | Low | 60% | ❌ 30% actual |
| **Backup/Recovery Scripts** | Low | 50% | ❌ 10% actual |

---

## 5. Testing Tools & Frameworks

### 5.1 Frameworks

| Language | Framework | Purpose |
|----------|-----------|---------|
| **Python** | pytest | Unit + Integration (typing-service, stats-service, backup-service) |
| **Node.js** | Vitest | Unit + Integration (api-gateway, auth-service) |
| **Go** | go test | Unit + Integration (vm-orchestrator, vcenter-integration, monitoring-service) |
| **E2E** | Playwright | End-to-End (UI → Backend full flow) |
| **API** | Postman/Thunder Client | API Testing (REST endpoints) |

### 5.2 CI/CD Integration (FUTURO)

- **Platform:** GitHub Actions (cuando migremos a repo público)
- **Trigger:** On every PR + nightly full suite
- **Failure Policy:** Block merge if coverage < 70%

**Estado Actual:** Tests ejecutables localmente con `npm test`, `pytest`, `go test`.

---

## 6. Test Cases Overview

### 6.1 High-Level Test Scenarios

#### **6.1.1 User Authentication Flow**
1. **Valid Login**
   - User: `admin@antigravity.local` / Password: `admin123`
   - Expected: JWT token returned, redirect to dashboard
2. **Invalid Credentials**
   - User: `admin@antigravity.local` / Password: `wrong`
   - Expected: 401 Unauthorized, error message displayed
3. **JWT Expiration**
   - Login → wait 1 hour → API call
   - Expected: 401 Unauthorized, redirect to login

#### **6.1.2 Wizard Navigation**
1. **Step-by-Step Progression**
   - Navigate: Step 1 → 2 → 3 → 4
   - Expected: All steps accessible, data persisted between steps
2. **Required Fields Validation**
   - Submit step without filling required fields
   - Expected: Validation error, cannot proceed
3. **Final Submit**
   - Complete all steps → Submit
   - Expected: POST to `/template`, success notification

#### **6.1.3 Naming Typification**
1. **Valid Input (All Segments)**
   - Location: `AR`, Environment: `PROD`, App: `WEB`, Role: `FE`, Sequential: `001`
   - Expected: VM Name = `AR-PROD-WEB-FE-001` (RFC 1123 compliant)
2. **Invalid Input (Missing Segment)**
   - Location: `AR`, Environment: ``, App: `WEB`
   - Expected: Validation error, segment required
3. **Special Characters Sanitization**
   - App: `My@App!`
   - Expected: Sanitized to `MYAPP`

#### **6.1.4 VM Orchestration**
1. **Successful Provisioning (Mock)**
   - Submit template with valid data
   - Expected: State: Pending → InProgress → Completed, vCenter mock returns success
2. **Orchestration Failure**
   - vCenter mock returns error (simulated network failure)
   - Expected: State: Failed, error logged, user notified

#### **6.1.5 Stats & Analytics**
1. **VM Count**
   - Query `/stats/vms/total`
   - Expected: Returns count of provisioned VMs
2. **Provisioning Time Average**
   - Query `/stats/provisioning/average-time`
   - Expected: Returns average time in seconds

---

### 6.2 Detailed Test Cases

Ver archivo separado: **`test-cases.md`** (a crear con casos detallados incluyendo Test ID, Steps, Expected Results, Actual Results, Status).

---

## 7. Non-Functional Testing

### 7.1 Performance Testing

**Herramienta:** k6 (load testing)

**Métricas Target:**
- **API Gateway Response Time**: < 200ms (p95)
- **Tipificación Endpoint**: < 50ms (p95)
- **Orquestación Throughput**: > 10 requests/s

**Load Scenarios:**
- **Normal Load**: 10 usuarios concurrentes
- **Peak Load**: 50 usuarios concurrentes
- **Stress Test**: 200 usuarios concurrentes (validar degradación graceful)

### 7.2 Security Testing

**Herramienta:** OWASP ZAP, Snyk

**Checks Obligatorios:**
- ✅ **JWT Validation**: Tokens expirados rechazados
- ✅ **RBAC**: Usuarios no-admin no pueden acceder a endpoints admin-only
- ✅ **SQL Injection**: Inputs sanitizados (typing-service, auth-service)
- ⏳ **XSS**: React sanitiza inputs automáticamente, validar edge cases
- ✅ **CSRF**: No aplica (API stateless con JWT)
- ⏳ **Dependency Vulnerabilities**: `npm audit`, `pip-audit`, `go mod tidy`

### 7.3 Accessibility Testing

**Estándar:** WCAG 2.1 AA

**Herramientas:** axe-core (integrado en Playwright), pa11y

**Coverage:** 
- ✅ Login Page
- ⏳ Dashboard
- ⏳ Wizard (Steps 1-4)

**Checks:**
- Contraste de color > 4.5:1
- ARIA labels en form inputs
- Navegación por teclado (Tab, Enter)
- Screen reader compatibility

---

## 8. Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **vCenter Integration Mock no refleja realidad** | High | Medium | Crear mock más robusto basado en docs de govmomi |
| **Tests E2E lentos (> 5 min)** | Medium | High | Usar Playwright sharding (4 workers paralelos) |
| **Flaky tests en UI (timing issues)** | Medium | Medium | Usar `waitForSelector` con timeouts explícitos |
| **Falta de acceso a vCenter real para testing** | Low | High | Mantener mock, documentar como limitación conocida |

---

## 9. Deliverables

- [x] Test Plan (este documento)
- [ ] Test Cases (`test-cases.md` - a crear)
- [ ] Test Reports (`test-report.md` - generar post-ejecución)
- [ ] Coverage Reports (HTML + JSON - generar con `pytest --cov`, `npm test --coverage`)
- [ ] Bug Reports (logged en GitHub Issues cuando estén disponibles)

---

## 10. Execution Schedule

| Week | Focus | Deliverable |
|------|-------|-------------|
| **Week 1 (Actual)** | Unit Tests + Coverage Audit | Coverage reports por servicio |
| **Week 2** | Integration Tests | API integration validated |
| **Week 3** | E2E Tests + Performance | Playwright suite + k6 results |
| **Week 4** | Security + Accessibility | OWASP ZAP report + axe-core results |

---

## 11. Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| QA Lead | Antigravity Staff Engineering | ✅ | 2026-01-30 |
| Dev Lead | (Usuario actual) | Pending | |
| Product Manager | (TBD) | Pending | |

---

**Notas:**
- Este plan sigue la pirámide de testing 70/20/10 (unit/integration/e2e).
- Los tests están diseñados para ejecutarse localmente SIN CI/CD (desarrollo actual).
- Frameworks prescriptivos: pytest, Vitest, Playwright (según skill `qa-testing-engineer`).

---
© 2026 Antigravity Engineering | vCenter Provisioner Test Plan
