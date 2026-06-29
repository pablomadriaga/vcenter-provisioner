---
description: "Pendientes de seguridad: secrets, CORS, cookies, CSP, rate limiting. Con file:line."
category: project
priority: high
agent_role: plan, debug
---

# vCenter Provisioner — Auditoría de Seguridad

> **Última actualización:** 2026-05-20

---

## Resumen

| Categoría | Total | Completado | Pendiente |
|-----------|-------|-----------|-----------|
| Tests | 9 servicios | 8 (89%) | 1 servicio |
| APIs | ~35 endpoints | ~32 (91%) | ~3 pendientes |
| Scripts Linux | 16 | 8 (50%) | 8 pendientes |
| Docs | 9 servicios | 8 (89%) | 1 pendiente |

---

## 🔴 Secrets Hardcodeados

| Archivo | Línea | Problema |
|---------|-------|-----------|
| `apps/api-gateway/src/index.ts` | 13 | JWT_SECRET fallback: `'antigravity-tier0-secret'` |
| `apps/auth-service/src/index.ts` | 11 | JWT_SECRET fallback: `'antigravity-tier0-secret'` |
| `apps/auth-service/src/index.ts` | 21 | Default admin password: `'password123'` en seed |
| `apps/credential-manager/src/index.ts` | 11 | Master key fallback hardcodeado |
| `apps/auth-service/knexfile.ts` | 6 | DB password hardcoded: `'password123'` |
| `apps/monitoring-service/main.go` | 23 | DB credentials: `'antigravity:password123'` |

**Solución:** K8s Secrets + validación fail-fast al startup. Nunca usar fallbacks en producción.

---

## 🟠 CORS Permisivo

| Archivo | Línea | Problema |
|---------|-------|-----------|
| `apps/api-gateway/src/index.ts` | 12, 28-31 | `CORS_ORIGINS = '*'` o `origin: true` |
| `apps/auth-service/src/server.ts` | 100-103 | `origin: true` |
| `apps/typing-service/app/main.py` | 30, 33-39 | CORS defaults a `'*'` |
| `apps/stats-service/app/main.py` | 39-45 | CORS permite todos los orígenes |

**Solución:** Whitelist explícita de orígenes desde variable de entorno `CORS_ORIGINS`.

---

## 🟡 Logging de Credenciales

| Archivo | Línea | Problema |
|---------|-------|-----------|
| `apps/vm-orchestrator/main.go` | 420 | `log.Printf` con credentials en texto plano |
| `apps/vcenter-operations/main.go` | 142, 174, 206, 344, 427 | Múltiples instancias de logging de credenciales |

**Solución:** Structured logging sin datos sensibles. Nunca loguear passwords ni tokens.

---

## 🔴 Scripts de Seguridad Faltantes

| Script | Estado |
|--------|--------|
| `scripts/security/zap-scan.sh` | ❌ Falta |
| `scripts/security/dependency-audit.sh` | ❌ Falta |

---

## Checklist Seguridad

- [ ] Crear `.env.example` con variables requeridas (sin valores reales)
- [ ] Validación de entorno al startup (fail-fast si faltan vars críticas)
- [ ] Restringir CORS a orígenes específicos (whitelist)
- [ ] Eliminar todo logging de credenciales y secrets
- [ ] Estandarizar logging: `slog` en Go, `server.log` en Node (Fastify)
- [ ] `scripts/security/zap-scan.sh`
- [ ] `scripts/security/dependency-audit.sh`

---

## Context7 — Mejores Prácticas (Seguridad)

| Área | Estado Actual | Recomendado |
|------|--------------|-------------|
| **Configuración** | Fallback a defaults inseguros | Fail-fast si vars críticas no existen |
| **CORS** | `origin: true` / `'*'` | Whitelist explícita por entorno |
| **Logging Node.js** | `console.log/error` | `server.log.error()` (Fastify built-in) |
| **Logging Go** | Mix `log` y `slog` | Solo `slog` (Go 1.21+) |
| **Error Handling** | Sin global handler | `fastify.setErrorHandler()` |
