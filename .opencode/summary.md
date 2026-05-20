# Session Summary

## Goal
Fix monitoring-service IDENTITY sequence bug + JWT auth blocking probes + NetworkPolicy blocking cross-service traffic

## Progress
### Troubleshooting (with empirical-debugging methodology)
- **4 sub-agents** investigaron en paralelo: pod restarts, monitoring-service code, PostgreSQL/migrations, NetworkPolicy/infra
- **3 bloqueos independientes descubiertos** (Ley de Murphy: todo lo que podía salir mal, salió mal):

### Fixes Applied
| # | Fix | Files Changed | Status |
|---|-----|---------------|--------|
| 1 | **JWT bypass**: POST /api/probe-result fuera del AuthMiddleware | `monitoring-service/main.go:694-703` | ✅ v11 deployed |
| 2 | **IDENTITY sequences**: setval para 11 tablas | `migrations/1773800000014_fix_identity_sequences.cjs` | ✅ v7 deployed |
| 3 | **NetworkPolicy**: agregar 9 service pods como sources | `k8s/base/network-policies/restrict-monitoring-ingress.yaml` | ✅ applied |

### Verification
- **Experiment 1**: POST con JWT válido → `500` (duplicate key, confirmó IDENTITY bug) ✓
- **Experiment 2**: POST sin JWT → antes `401`, después `500` (JWT fix works) ✓
- **Experiment 3**: POST sin JWT después de migration → `200 {"status":"stored"}` ✓
- **Experiment 4**: Redis `KEYS monitoring:probe:*` → 10 services ✓
- **Experiment 5**: Playwright en /monitor → 10/10 UP, 0 unknown ✓
- **Experiment 6**: auth-service → monitoring-service:8082 → antes timeout, después `200` ✓
- **Test files**: `tests/k6/probe-load-test.js` + `e2e/tests/10-monitoring.spec.ts`

### Key Config Changes
- `monitoring-service:v11` → harbor + kustomization dev overlay
- `vcenter-provisioner-migrations:v7` → harbor + base jobs/migrations.yaml
- NetworkPolicy → declarative YAML con todos los service pods

### Remaining Issues (non-blocking)
- **backup-service**: 33 restarts (liveness probe failing) — separate issue
- **typing-service**: 8 restarts — timing probes timing out
- **Liveness/Readiness probe timeouts** across multiple pods — possible node resource pressure or CNI issue
- `getServicesStatus()` swallows Redis errors silently (line 248)
- No PG fallback in getServicesStatus() if Redis is cold
