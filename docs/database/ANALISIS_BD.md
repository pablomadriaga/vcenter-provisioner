---
description: "Análisis y auditoría de PostgreSQL: inventario, hallazgos resueltos, diagnóstico K8s"
category: database
priority: medium
agent_role: debug, plan
---

# Análisis de BD — PostgreSQL 15.18

**Fecha**: 2026-05-19 | **Entorno**: K8s dev (10.12.4.165, namespace: vcenter-provisioner-dev)
**Postgres**: 15.18 Alpine (StatefulSet, 1 réplica, 10Gi PVC)

## Bases de Datos

| Base de Datos | Size | Contenido |
|---|---|---|
| **vcenter_provisioner** | **57 MB** | 14 tablas `public` + schema `monitoring` |
| antigravity | 7.5 MB | `knex_migrations` vacía (artefacto) |
| postgres/template0/template1 | ~22 MB | System |

### vcenter_provisioner

| Tabla | Filas | Notas |
|---|---|---|
| `users` | 3 | admin, operator, default |
| `vm_classes` | 4 | Gold/Silver/Bronze/Micro (FK created_by_id) |
| `typification_templates` | 4 | PROD/SRV, DEV/SRV, PROD/DB, QA/TEST |
| `typification_counters` | 4 | 1:1 con templates |
| `sessions`/`refresh_tokens`/`pgmigrations` | 1/1/13 | Activos + tracking |
| resto (8 tablas) | 0 | Vacías |
| `monitoring.probes` | 798,668 | **165 MB** (71% BD, sin retención ni particionamiento) |
| `monitoring.service_status` | 10 | ~64 KB |
| `monitoring.connectivity_matrix` | 0 | — |

**Roles:** `antigravity` (superuser), `app_user` (DML+SELECT), `migration_user` (DDL+DML+SELECT), `readonly_user` (SELECT). _Eliminadas: knex_migrations, knex_migrations_lock._

## Hallazgos y Resoluciones

| ID | Hallazgo | Sev | Resolución |
|----|----------|:---:|------------|
| C1 | Sin connection pooler (6+ servicios directo a PG) | 🔴 | PgBouncer 1.18.0 (transaction mode, pool=25) ✅ |
| C2 | Dos configs PG compitiendo (15-alpine vs Bitnami 18.x) | 🔴 | Bitnami → `.unused`, `postgres:15-alpine` confirmado ✅ |
| C3 | Dos sistemas de migración + bypass DDL | 🔴 | Solo node-pg-migrate. auth-service v8 ✅ Nota: migración `17738000000115` agrega `provision_logs` + `custom_charts` (antes solo en Alembic muerto) |
| C4 | Sin backup | 🔴 | CronJob pg_dump diario (0 3 * * *) + PVC 10Gi ✅ |
| C5 | Sin HA | 🔴 | Pendiente Fase 3 (Patroni) |
| C6 | Sin separación roles BD | 🔴 | app_user, migration_user, readonly_user con grants ✅ |
| H1 | FK faltante: custom_charts.user_id | 🟠 | FK CASCADE + FKs provision_logs ✅ |
| H2 | vm_classes.created_by VARCHAR sin FK | 🟠 | → created_by_id INTEGER FK (ON DELETE SET NULL) ✅ |
| H3 | TIMESTAMP vs TIMESTAMPTZ | 🟠 | 23 cols migradas. stats-service v9 ✅ |
| H4 | 11 tablas SERIAL legacy | 🟠 | → GENERATED AS IDENTITY. setval corregido ✅ |
| H5 | monitoring.probes sin retención | 🟠 | BRIN + CronJob DELETE >14d + VACUUM ✅ |
| H6 | PG tuneado para HDD en SSD | 🟠 | 12 params: random_page_cost=1.1, effective_io_concurrency=200 ✅ |
| H7 | credential-manager BD incorrecta | 🟠 | DB_URL → vcenter_provisioner ✅ |
| M1 | Índices booleanos inútiles | 🟡 | Pendiente |
| M2 | Índices redundantes probes | 🟡 | Dropeados. BRIN + composite covering ✅ |
| M3 | typification_counters hotspot | 🟡 | Pendiente |
| M4 | provision_logs sin FK | 🟡 | Resuelto con H1 ✅ |
| M5 | filters JSON → JSONB | 🟡 | ALTER COLUMN TYPE ✅ |
| M6 | Nombres mixtos español/inglés | 🟡 | Pendiente (API-breaking: 99+ refs) |
| M7 | Dos tablas de auditoría | 🟡 | Pendiente Fase 3 |
| M8 | refresh_tokens PK TEXT | 🟡 | Pendiente |
| M9 | IDENTITY seq sin setval | 🟡 | Migration 0014: setval corregido ✅ |
| L1-L11 | Varios | 🟢 | Pendiente |

## Plan de Acción

| Fase | # | Acción | Estado |
|------|---|--------|--------|
| **0** | — | FK custom_charts.user_id → users(id) CASCADE | ✅ |
| | — | vm_classes.created_by → created_by_id INTEGER FK | ✅ |
| | — | credential-manager DB_URL → vcenter_provisioner | ✅ |
| | — | Eliminar runMigrations/runSeeds de db.ts | ✅ |
| | — | Eliminar create_all() de stats-service y typing-service | ✅ |
| | — | Dropear knex_migrations, knex_migrations_lock | ✅ |
| | — | CHECK constraint users.role | ✅ |
| | — | auth-service v8: waitForDb backoff + jitter | ✅ |
| **1** | — | Resolver conflicto imágenes PG | ✅ |
| | — | PgBouncer Deployment + Service (pgbouncer:6432) | ✅ |
| | — | pg_dump diario (CronJob 0 3 * * *, PVC 10Gi) | ✅ |
| | — | Roles BD + default privileges | ✅ |
| | — | Tuning PG SSD (12 params via -c args) | ✅ |
| **2** | 2.1 | SERIAL → GENERATED AS IDENTITY (11 tablas) | ✅ |
| | 2.2 | TIMESTAMP → TIMESTAMPTZ (23 cols) | ✅ |
| | 2.3 | BRIN index + retención probes | ✅ |
| | 2.4 | Optimizar índices redundantes | ✅ |
| | 2.5 | filters JSON → JSONB | ✅ |
| | 2.6 | Rediseñar refresh_tokens PK (UUID+hash) | ⏳ |
| | 2.7 | Renombrar prefijo1/prefijo2 → prefix1/prefix2 | ⏳ |
| | 2.8 | Fix IDENTITY sequences (setval) | ✅ |
| **3** | 3.1 | Streaming replica + Patroni (HA) | ⏳ |
| | 3.2 | pg_stat_statements + postgres_exporter | ⏳ |
| | 3.3 | Unificar auditoría | ⏳ |
| | 3.4 | Particionamiento monitoring.probes | ⏳ |

---

## ERD

```
┌──────────────┐        ┌──────────────────┐
│    users     │        │   vm_classes     │
│ PK id        │        │ PK id            │
│  username UQ │        │  name UQ         │
│  password_ha │        │  cpu/memory/stor │
│  role ✓CHECK │        │  created_by_id ✓ │
└──────┬───────┘        └────────┬─────────┘
       │ 1:N                     │
       ├── sessions FK CASCADE   │
       ├── refresh_tokens FK C   │
       ├── audit_logs FK         │
       ├── vm_provisions FK      │
       ├── vcenter_connections   │
       ├── custom_charts FK ✅   │
       └── typification_templates│
              │ 1                │
        typification_counters    │← M3 hotspot
        (PK,FK template_id)      │
              │ 1                │
         vm_provisions            │
         (FK template_id,        │
          FK requester_id,       │
          specs JSONB, vm_name)  │
                                 │
┌──────────────────┐             │
│ vcenter_connecti │             │
│ PK id            │             │
│  created_by FK   │─────────────┘
└────────┬─────────┘
    vcenter_credential_audit ← M7
┌──────────────────┐  ┌──────────────────┐
│ provision_logs   │  │  custom_charts   │
│  vm_class_id FK ✅│ │  user_id FK ✅    │
│  vcenter_id FK ✅ │  │  filters JSONB   │
│  status          │  └──────────────────┘
└──────────────────┘
┌──────────────────┐  ┌──────────────────┐
│ token_blacklist  │  │ sessions/refresh │
│ PK jti TEXT      │  │ FK user_id       │
└──────────────────┘  └──────────────────┘
┌──────────────────┐
│ monitoring schema│
│ probes (798k)   │
│ service_status   │
│ connectivity_mat │
└──────────────────┘
```

---

## Estabilidad K8s — Reinicios (Mayo 2026)

### Diagnóstico y Resultado

| Servicio | Reinicios | Causa raíz | Intervención | Resultado |
|----------|-----------|------------|--------------|-----------|
| backup-service | 97 | Semi-deprecado | Eliminado del cluster | ELIMINADO |
| typing-service | 16 | create_all() en lifespan | create_all/seed removidos, workers 2→1 | 0 (startup 37s) |
| auth-service | 6 | process.exit(1) ante EAI_AGAIN | waitForDb backoff+jitter, graceful | 0 |
| api-gateway | 5 | NodeNotReady + probes agresivas | — | 0 |
| provisioner-ui | 1 | NodeNotReady puntual | — | 1 (histórico) |
| postgres | — | readinessProbe timeout | timeout 3→10, pg_isready -t 10 | estable |
| stats-service | — | Liveness/readiness | Timeouts aumentados | estable |
| resto | 0 | — | — | 0 |

## Resumen

| Severidad | Total | Resueltos | Pendientes |
|---|---|---|---|
| 🔴 CRÍTICO | 6 | 5 | 1 (C5: HA) |
| 🟠 ALTO | 7 | 7 | 0 |
| 🟡 MEDIO | 9 | 4 | 5 (M1, M3, M6, M7, M8) |
| 🟢 BAJO | 11 | 0 | 11 |
| **Total** | **33** | **16** | **17** |

## Fixes Recientes (2026-05-21)

### pgBouncer: `auth_type scram-sha-256` → `md5` 
Los hashes SCRAM en `userlist.txt` tenían salts independientes (no coincidían con `pg_shadow`). Con `auth_type = scram-sha-256`, pgBouncer ignora `password=password123` del database config y usa el verifier del userlist para backend auth → `FATAL: password authentication failed`. Cambio a `md5` + regeneración de hashes MD5 permite que pgBouncer use el plaintext password para backend SCRAM fresco que sí coincide.

### Migración faltante: `17738000000115_create_stats_tables`
`provision_logs` y `custom_charts` solo existían en Alembic (`stats-service/migrations/001_provision_logs.py`), que nunca se ejecutaba en K8s. El `create_all()` fue eliminado pero la migración equivalente en node-pg-migrate nunca se escribió. Nueva migración con `CREATE TABLE IF NOT EXISTS` y tipos modernos.

### Dev overlay: `DATABASE_URL` para monitoring/stats/typing + `POSTGRES_DB` corregido
`monitoring-service-secrets`, `stats-service-secrets` y `typing-service-secrets` no tenían override de `DATABASE_URL` en dev → apuntaban a `pgbouncer:6432` (base). Agregados `DATABASE_URL` directos a `postgres:5432`. Corregido `POSTGRES_DB: antigravity` → `vcenter_provisioner` (eliminado artefacto BD fantasma).
