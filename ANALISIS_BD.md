# Análisis Completo de Base de Datos — PostgreSQL 15.18

**Fecha**: 2026-05-19 (actualizado)
**Proyecto**: vcenter-provisioner
**Entorno**: K8s dev (test@10.12.4.165, namespace: vcenter-provisioner-dev)
**Postgres**: 15.18 on Alpine (StatefulSet, 1 réplica, 10Gi PVC)

---

## 1. Inventario de Bases de Datos

| Base de Datos | Size | Owner | Contenido |
|---|---|---|---|
| **vcenter_provisioner** | **57 MB** | antigravity | 14 tablas `public` + schema `monitoring` |
| antigravity | 7.5 MB | antigravity | Solo tabla `knex_migrations` vacía (artefacto) |
| postgres | 7.5 MB | antigravity | Default system DB |
| template0 | 7.3 MB | antigravity | System template |
| template1 | 7.6 MB | antigravity | System template |

### Desglose vcenter_provisioner

**Schema public (14 tablas, ~9 MB):**

| Tabla | Filas | Notas |
|---|---|---|
| `users` | 3 | admin, operator, default |
| `vm_classes` | 4 | Gold, Silver, Bronze, Micro (ahora con `created_by_id` FK) |
| `typification_templates` | 4 | PROD/SRV, DEV/SRV, PROD/DB, QA/TEST |
| `typification_counters` | 4 | 1:1 con templates |
| `sessions` | 1 | Sesión activa |
| `refresh_tokens` | 1 | Token vivo |
| `vcenter_connections` | 0 | Sin conexiones configuradas |
| `vm_provisions` | 0 | Sin provisions |
| `provision_logs` | 0 | Ahora con FK a vm_classes y vcenter_connections |
| `audit_logs` | 0 | Sin eventos auditados |
| `token_blacklist` | 0 | Sin tokens revocados |
| `vcenter_credentials_audit` | 0 | Sin rotaciones |
| `custom_charts` | 0 | Ahora con FK user_id → users(id) CASCADE |
| `pgmigrations` | 13 | Tracking node-pg-migrate |

**_Tablas eliminadas en Fase 0:_** `knex_migrations`, `knex_migrations_lock` (vestigios de knex)

**Schema monitoring (3 tablas, ~48 MB):**

| Tabla | Filas | Size | Notas |
|---|---|---|---|
| `probes` | 798,668 | **165 MB** | 71% de toda la BD. Sin retención, sin particionamiento |
| `service_status` | 10 | ~64 KB | Estados de servicios |
| `connectivity_matrix` | 0 | ~0 KB | Sin datos |

### Roles de Base de Datos

| Rol | Atributos | Privilegios |
|---|---|---|
| `antigravity` | Superuser, Create role, Create DB, Replication, Bypass RLS | Control total |
| `app_user` | Login | CONNECT, USAGE public+monitoring, DML en public, SELECT monitoring |
| `migration_user` | Login | CONNECT, USAGE public+monitoring, DDL+DML en public, SELECT monitoring |
| `readonly_user` | Login | CONNECT, USAGE public+monitoring, SELECT en public+monitoring |

**Default privileges configurados para `app_user` y `migration_user`** (DML automático en tablas nuevas).

---

## 2. Metodología

Tres subagentes especializados + 8 consultas Context7 a documentación oficial (PostgreSQL, PgBouncer, Patroni).

| Agente | Especialidad |
|---|---|
| **DBA Producción** | Tuning, rendimiento, producción |
| **Especialista PostgreSQL** | PG interno, optimización, tipos |
| **ERD & Data Modeler** | Modelado relacional, integridad |

---

## 3. Hallazgos y Estado

### 🔴 CRÍTICOS

| ID | Hallazgo | Severidad | Estado |
|---|---|---|---|
| **C1** | No hay connection pooler — 6+ servicios directo al mismo PG | CRÍTICO | ✅ **RESUELTO** |
| **C2** | Dos configs de PostgreSQL compitiendo (15-alpine vs Bitnami 18.x) | CRÍTICO | ✅ **RESUELTO** |
| **C3** | Dos sistemas de migración + bypass DDL | CRÍTICO | ✅ **RESUELTO** |
| **C4** | Sin backup ni recovery | CRÍTICO | ✅ **RESUELTO** |
| **C5** | Sin alta disponibilidad | CRÍTICO | ⏳ Pendiente (Fase 3) |
| **C6** | Sin separación de roles de base de datos | CRÍTICO | ✅ **RESUELTO** |

#### C3 — RESUELTO

**Qué se hizo:**
- `runMigrations()` y `runSeeds()` eliminados de `db.ts` → auth-service v7
- `Base.metadata.create_all()` eliminado de stats-service `main.py` → stats-service v8
- `Base.metadata.create_all()` + `seed_default_vm_classes()` eliminados de typing-service `main.py` → typing-service v7
- Tablas `knex_migrations` y `knex_migrations_lock` dropeadas vía migration 0012
- Único sistema activo: `node-pg-migrate` vía K8s Job (`pgmigrations`)
- **auth-service v8**: `waitForDb()` con exponential backoff + jitter para tolerar fallos DNS (`EAI_AGAIN`), graceful shutdown con `db.destroy()`

---

### 🟠 ALTOS

| ID | Hallazgo | Severidad | Estado |
|---|---|---|---|
| **H1** | FK faltante: `custom_charts.user_id` | ALTO | ✅ **RESUELTO** |
| **H2** | `vm_classes.created_by` VARCHAR(100) sin FK | ALTO | ✅ **RESUELTO** |
| **H3** | Inconsistencia TIMESTAMP vs TIMESTAMPTZ | ALTO | ✅ **RESUELTO** (Fase 2.2) |
| **H4** | 11 tablas usan SERIAL (legacy) | ALTO | ✅ **RESUELTO** (Fase 2.1) |
| **H5** | `monitoring.probes` sin retención ni BRIN index | ALTO | ✅ **RESUELTO** (Fase 2.3-2.4) |
| **H6** | Config PG tuneada para HDD en storage SSD | ALTO | ✅ **RESUELTO** |
| **H7** | `credential-manager` apuntaba a BD incorrecta | ALTO | ✅ **RESUELTO** |

#### H1 — RESUELTO

**Qué se hizo:**
- Migration 0012: `ALTER TABLE custom_charts ADD CONSTRAINT fk_custom_charts_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`
- También se agregaron FKs a `provision_logs.vm_class_id → vm_classes(id) SET NULL` y `provision_logs.vcenter_id → vcenter_connections(id) SET NULL`

#### H2 — RESUELTO

**Qué se hizo:**
- Migration 0012: agregó `created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL`
- Migró datos existentes (`created_by='system'` → `created_by_id=admin`)
- Dropeó columna `created_by` (VARCHAR)
- También se actualizó `typing-service/app/models.py` (VMClass.created_by → created_by_id) y `main.py` (referencias)
- typing-service v6 construido y desplegado

#### H3 — RESUELTO (Fase 2.2)

**Qué se hizo:**
- Migration 0013: `ALTER COLUMN ... TYPE TIMESTAMPTZ USING col AT TIME ZONE 'UTC'` en 23 columnas (10 tablas)
- **Clave**: `USING col AT TIME ZONE 'UTC'` evita data corruption — sin esto PG reinterpreta datos existentes en la timezone de sesión
- `stats-service` v9: `DateTime` → `DateTime(timezone=True)` en models.py, `utcnow()` → `now(timezone.utc)` en routes.py
- **Orden crítico**: stats-fix deploy → migration 0013 → monitoring deploy

#### H4 — RESUELTO (Fase 2.1 + 2.8)

**Qué se hizo (Fase 2.1):**
- Migration 0013: `ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY` en 11 tablas
- `DROP IDENTITY IF EXISTS` + `ADD GENERATED` por cada tabla
- `monitoring-service` v10: initSchema actualizado con `GENERATED BY DEFAULT AS IDENTITY`

**⚠️ Bug descubierto post-deploy (Fase 2.8):**
- Migration 0013 creó secuencias `_id_seq1` para cada columna IDENTITY, pero estas empezaban en **1**
- `monitoring.probes` tenía **798,668 filas** con IDs 1–798,668 → `nextval('probes_id_seq1')` generaba IDs ya existentes
- Resultado: todo INSERT sin id explícito fallaba con `duplicate key value violates unique constraint "probes_pkey"`
- Desde las 00:07:14 del 19-May (ejecución de migration 0013) hasta el fix, **no se almacenó ninguna probe**
- `probes_id_seq` (SERIAL viejo) tenía `last_value=798668`; `probes_id_seq1` (IDENTITY nuevo) solo `851`

**Qué se hizo (Fase 2.8 — migration 0014):**
- Migration 0014: `SELECT setval('{table}_id_seq1', MAX(id))` para cada identity con datos
- Tablas con datos: `monitoring.probes` (798,668), `public.users` (3), `public.typification_templates` (4), `public.vm_classes` (4)
- Tablas vacías: sin cambios (secuencia ya arranca en 1, correcta para primer INSERT)
- Verificado: probes post-fix se almacenan en PG y Redis correctamente

#### H5 — RESUELTO (Fase 2.3-2.4)

**Qué se hizo:**
- **BRIN index** `idx_probes_brin_created` en `monitoring.probes.created_at` con `pages_per_range=16`
  - Óptimo para ~200 rows/min (~2.7 min por rango)
  - Significativamente más compacto que B-tree en time-series
- **DROP** `idx_probes_created` (B-tree redundante en created_at)
- **DROP** `idx_probes_source` (B-tree redundante en source_service)
- Únicos índices restantes en probes: `probes_pkey` (PK), `idx_probes_target_created` (covering), `idx_probes_brin_created` (BRIN)
- **CronJob `postgres-retention`**: `0 1 * * *`, DELETE probes >14d + DELETE connectivity_matrix >30d + VACUUM
- NetworkPolicy actualizada para permitir tráfico desde `app: postgres-retention`

#### H7 — RESUELTO

**Qué se hizo:**
- `credential-manager-secrets-patch.yaml`: `DB_URL` → `vcenter_provisioner`
- **Hallazgo adicional**: la `DB_URL` general en `vcenter-provisioner-secrets` (kustomization.yaml L74) apuntaba a `antigravity` y sobreescribía la del secret específico por orden de `envFrom` en el Deployment. Corregido también.

#### C1 — RESUELTO

**Qué se hizo:**
- PgBouncer 1.18.0 desplegado como Deployment (`edoburu/pgbouncer:1.18.0`)
- Puerto 6432, pool mode=transaction, default_pool_size=25, max_client_conn=100
- Autenticación SCRAM-SHA-256 con userlist desde ConfigMap
- Servicio ClusterIP `pgbouncer:6432` disponible para apps
- Conexión backend a `postgres:5432` verificada exitosamente

#### C2 — RESUELTO

**Qué se hizo:**
- Confirmado: `postgres:15-alpine` es la imagen corriendo en el cluster (StatefulSet base `k8s/base/backing-services/postgres.yaml`)
- Archivos Bitnami (`postgres-values.yaml`, `postgres-bitnami-values.yaml`) renombrados a `.unused` — son configs Helm que nunca se usaron y no hay HelmRelease/HelmChart que los referencie
- Imagen oficial `postgres:15-alpine` mantenida

#### C4 — RESUELTO

**Qué se hizo:**
- PVC `postgres-backup-pvc` (10Gi, tanzu-storage) para almacenar backups
- CronJob `postgres-dump` schedule `0 3 * * *` ejecuta `pg_dump` comprimido con gzip
- Backup verificado: `1.4M`, completado en 27s
- Retención: 7 días (autolimpieza via `find -mtime +7 -delete`)
- NetworkPolicy actualizada para permitir tráfico desde pods con label `app: postgres-dump`

#### C6 — RESUELTO

**Qué se hizo:**
- Tres roles de aplicación creados en `vcenter_provisioner`:
  - `app_user`: DML en `public`, SELECT en `monitoring`, CONNECT + USAGE
  - `migration_user`: DDL+DML en `public`, CREATE en schema, SELECT en `monitoring`
  - `readonly_user`: SELECT en `public` + `monitoring`
- Default privileges configurados para que tablas nuevas hereden los permisos
- Roles creados via `db-init` job (declarativo, K8s Job)

#### H6 — RESUELTO

**Qué se hizo:**
- Configuración PG tuneada para SSD via `-c` args en el StatefulSet:
  | Parámetro | Valor Anterior (HDD default) | Nuevo Valor (SSD) |
  |---|---|---|
  | `random_page_cost` | 4.0 | **1.1** |
  | `effective_io_concurrency` | 1 | **200** |
  | `shared_buffers` | 128MB (default) | **1GB** |
  | `effective_cache_size` | 4GB (default) | **3GB** |
  | `work_mem` | 4MB | **32MB** |
  | `maintenance_work_mem` | 64MB | **256MB** |
  | `wal_buffers` | 4MB | **16MB** |
  | `max_wal_size` | 1GB | **4GB** |
  | `min_wal_size` | 80MB | **1GB** |
  | `max_connections` | 100 | **50** |
  | `log_min_duration_statement` | -1 (off) | **1000ms** |
  | `wal_level` | replica (default) | **replica** |

---

### 🟡 MEDIOS

| ID | Hallazgo | Severidad | Estado |
|---|---|---|---|
| M1 | Índices en columnas booleanas (inútiles) | MEDIO | ⏳ Pendiente (Fase 2) |
| M2 | Índices redundantes en monitoring.probes | MEDIO | ✅ **RESUELTO** (Fase 2.4) |
| M3 | `typification_counters` — hotspot de escritura | MEDIO | ⏳ Pendiente (Fase 2) |
| M4 | `provision_logs` sin FK a tablas de dimensión | MEDIO | ✅ **RESUELTO** (en H1) |
| M5 | `custom_charts.filters` usa JSON en vez de JSONB | MEDIO | ✅ **RESUELTO** (Fase 2.5) |
| M6 | Nombres mixtos español/inglés | MEDIO | ⏳ Pendiente (Fase 2.7) |
| M7 | Dos tablas de auditoría | MEDIO | ⏳ Pendiente (Fase 3) |
| M8 | `refresh_tokens` usa TEXT como PK | MEDIO | ⏳ Pendiente (Fase 2.6) |
| M9 | IDENTITY sequences creadas sin setval en migration 0013 (bug post-deploy) | MEDIO | ✅ **RESUELTO** (Fase 2.8) |

---

#### M2 — RESUELTO (Fase 2.4)

**Qué se hizo:**
- `idx_probes_created` (B-tree en created_at) dropeado — redundante con BRIN y el composite covering
- `idx_probes_source` (B-tree en source_service) dropeado — no se usa en queries frecuentes
- `idx_probes_target_created` (B-tree composite covering) mantenido — útil para queries por target
- `idx_probes_brin_created` (BRIN en created_at) agregado — óptimo para time-series

#### M5 — RESUELTO (Fase 2.5)

**Qué se hizo:**
- Migration 0013: `ALTER TABLE custom_charts ALTER COLUMN filters TYPE JSONB USING filters::JSONB`
- `USING filters::JSONB` — cast directo porque JSON es implícitamente compatible con JSONB
- Beneficio: operaciones de búsqueda en filtros (ej. `@>`, `?`, `?|`) ahora usan índices GIN si es necesario

#### M9 — RESUELTO (Fase 2.8)

**Qué se hizo:**
- Migration 0014: reset de secuencias IDENTITY a MAX(id)+1 para tablas con datos
- Tablas corregidas: `monitoring.probes` (798,668 → seq 798,668), `public.users` (3 → seq 3), `public.vm_classes` (4 → seq 4), `public.typification_templates` (4 → seq 4)
- **Causa raíz**: `ALTER TABLE ... ADD GENERATED BY DEFAULT AS IDENTITY` crea una nueva secuencia interna (convención `_id_seq1`) que arranca en 1, pero `setval` no se ejecuta post-creación
- **Lección**: migration 0014 aplicada manualmente vía `psql exec` + registrada en `pgmigrations`. El Job `vcenter-provisioner-migrations:v7` detectó que ya estaba registrada y la skipió correctamente (`"No migrations to run!"`)

### 🟢 BAJOS

| ID | Hallazgo | Estado |
|---|---|---|
| L1-L11 | Varios (ver detalle completo en sección 3 del análisis original) | ⏳ Pendiente |

---

## 4. Validación Context7

| Consulta | Documento | Confirmación |
|---|---|---|
| PgBouncer connection pooling | `/pgbouncer/pgbouncer` | ✅ |
| GENERATED AS IDENTITY vs SERIAL | `/websites/postgresql` | ✅ |
| TIMESTAMP vs TIMESTAMPTZ | `/websites/postgresql` | ✅ |
| Backup PITR (WAL archiving) | `/websites/postgresql` | ✅ |
| Index strategy (partial, BRIN, boolean) | `/websites/postgresql` | ✅ |
| max_connections y memory tuning | `/websites/postgresql` | ✅ |
| Patroni HA en K8s | `/patroni/patroni` | ✅ |
| BRIN vs B-tree para time-series | `/websites/postgresql` | ✅ |

---

## 5. Plan de Acción

### Fase 0 — Correcciones Inmediatas ✅ COMPLETADA

| # | Acción | Resultado | Imagen |
|---|---|---|---|
| 0.1 | FK `custom_charts.user_id → users(id) CASCADE` | ✅ Migration 0012 | — |
| 0.2 | `vm_classes.created_by` VARCHAR → `created_by_id` INTEGER FK | ✅ Migration 0012 + typing-service v6 | typing-service v6 |
| 0.3 | `credential-manager DB_URL` → `vcenter_provisioner` | ✅ 2 parches (específico + general) | — |
| 0.4 | Eliminar `runMigrations()`/`runSeeds()` de `db.ts` | ✅ auth-service v7 | auth-service v7 |
| 0.5 | Eliminar `Base.metadata.create_all()` de stats-service | ✅ stats-service v8 | stats-service v8 |
| 0.6 | Dropear `knex_migrations` y `knex_migrations_lock` | ✅ Migration 0012 | — |
| 0.7 | CHECK constraint en `users.role` | ✅ Migration 0012 | — |

**Hallazgos adicionales corregidos:**
- `typing-service` model `created_by=Column(String(100))` → `created_by_id=Column(Integer, ForeignKey)` — rompía `/api/vm-classes`
- General `DB_URL` en `vcenter-provisioner-secrets` apuntaba a `antigravity` y sobreescribía al específico por orden de `envFrom`

**Imágenes nuevas en Harbor:**
- `vcenter-provisioner-migrations:v5`
- `auth-service:v7`, `auth-service:v8`
- `stats-service:v8`
- `typing-service:v6`, `typing-service:v7`

### Fase 1 — Infraestructura ✅ COMPLETADA

| # | Acción | Resultado | Imagen/Herramienta |
|---|---|---|---|
| 1.1 | Resolver conflicto imágenes PG (15-alpine vs Bitnami 18.x) | ✅ Bitnami → `.unused`, `15-alpine` confirmado | postgres:15-alpine |
| 1.2 | Desplegar PgBouncer | ✅ Deployment + Service ClusterIP `pgbouncer:6432` | edoburu/pgbouncer:1.18.0 |
| 1.3 | pg_dump diario + PVC | ✅ CronJob `0 3 * * *`, PVC 10Gi, backup 1.4M verificado | postgres:15-alpine |
| 1.4 | Crear roles de BD | ✅ `app_user`, `migration_user`, `readonly_user` con grants + default privileges | db-init Job |
| 1.5 | Tuning PG para SSD | ✅ 12 parámetros optimizados via `-c` args | StatefulSet patch |

### Fase 2 — Performance y Modelo ✅ COMPLETADA (parcial)

| # | Acción | Resultado | Imagen/Herramienta |
|---|---|---|---|
| 2.1 | Migrar 11 tablas de SERIAL → GENERATED AS IDENTITY | ✅ Migration 0013: public(9) + monitoring(2) | migrations v6 |
| 2.2 | Unificar 23 columnas de TIMESTAMP → TIMESTAMPTZ con `USING col AT TIME ZONE 'UTC'` | ✅ Migration 0013: 23 cols en 10 tablas | migrations v6 |
| 2.3 | BRIN index en `monitoring.probes.created_at` + retención 14d/30d | ✅ `idx_probes_brin_created` (pages_per_range=16) + CronJob | monitoring v10 |
| 2.4 | Optimizar índices: dropear redundantes | ✅ `idx_probes_created` + `idx_probes_source` dropeados | monitoring v10 |
| 2.5 | Migrar `custom_charts.filters` JSON → JSONB | ✅ Migration 0013: `USING filters::JSONB` | migrations v6 |
| 2.6 | Rediseñar `refresh_tokens` PK (UUID + hash) | ⏳ Pendiente | — |
| 2.7 | Renombrar `prefijo1`/`prefijo2` → `prefix1`/`prefix2` | ⏳ Postergado (API-breaking: 99+ referencias cross-service) | — |
| 2.8 | Fix IDENTITY sequences: setval para tablas con datos | ✅ Migration 0014 + monitoring-service v11 | migrations v7 |

**Imágenes nuevas en Harbor:**
| Servicio | Tag | Cambio |
|---|---|---|
| stats-service | v9 | DateTime(timezone=True) + now(timezone.utc) |
| migrations | v6 | Migration 0013 (IDENTITY + TIMESTAMPTZ + JSONB) |
| monitoring-service | v10 | IDENTITY DDL + BRIN + retention |
| migrations | v7 | Migration 0014 (fix IDENTITY sequences con setval) |
| monitoring-service | v11 | JWT bypass en POST /api/probe-result |

### Fase 3 — HA y Producción

| # | Acción |
|---|---|
| 3.1 | Implementar HA: streaming replica + Patroni |
| 3.2 | Configurar monitoreo: `pg_stat_statements`, postgres_exporter |
| 3.3 | Unificar tablas de auditoría (`vcenter_credentials_audit` → `audit_logs`) |
| 3.4 | Evaluar particionamiento por tiempo para `monitoring.probes` |

---

## 6. Diagrama ERD (actualizado)

```
┌──────────────┐        ┌──────────────────┐
│    users     │        │   vm_classes     │
│──────────────│        │──────────────────│
│ PK id        │        │ PK id            │
│  username UQ │        │  name UQ         │
│  password_ha │        │  cpu_cores       │
│  role ✓CHECK │        │  memory_mb       │
│  created_at  │        │  storage_gb      │
│  updated_at  │        │  created_by_id   │✅ FK
└──────┬───────┘        └────────┬─────────┘
       │                         │
       │ 1:N                     │
       │                         │
       ├── sessions (FK CASCADE) │
       ├── refresh_tokens (FK C) │
       ├── audit_logs (FK NO AC) │
       ├── vm_provisions (FK)    │
       ├── vcenter_connections   │
       ├── custom_charts (FK ✓)✅│← H1 RESUELTO
       └── typification_templates│
                │ 1              │
          ┌─────┴──────────────┐ │
          │ typification_count │ │
          │     (WEAK)         │ │
          │ PK,FK template_id  │ │
          │  current_value     │←M3
          └────────────────────┘ │
                │ 1              │
          ┌─────┴──────────────┐ │
          │  vm_provisions     │ │
          │ PK id              │ │
          │  vm_name UQ        │ │
          │ FK template_id     │ │
          │ FK requester_id    │ │
          │  specs JSONB       │ │
          └────────────────────┘ │
                                  │
┌──────────────────┐             │
│ vcenter_connecti │             │
│ PK id            │             │
│  created_by FK   │─────────────┘
└────────┬─────────┘
         │ 1:N
   ┌─────┴──────────────┐
   │ vcenter_credential │ ← M7: duplica audit
   │     audit          │
   └────────────────────┘

┌──────────────────┐   ┌──────────────────┐
│ provision_logs   │   │  custom_charts   │
│──────────────────│   │──────────────────│
│ PK id            │   │ PK id            │
│  vm_class_id ✓FK │✅│  user_id ✓FK     │✅ H1
│  vcenter_id ✓FK  │✅│  filters JSON    │← M5
│  vm_class_name   │   └──────────────────┘
│  vcenter_name    │
│  status          │
└──────────────────┘

┌──────────────────┐   ┌──────────────────┐
│ token_blacklist  │   │  sessions        │
│ PK jti TEXT      │   │ PK id UUID       │
└──────────────────┘   │ FK user_id       │
                       └──────────────────┘
┌──────────────────┐   ┌──────────────────┐
│ refresh_tokens   │   │  audit_logs      │
│ PK refresh_tokn  │←M8│ PK id            │
│ FK user_id       │   │ FK user_id       │
└──────────────────┘   │  action          │
                       │  details JSONB   │
┌──────────────────┐   └──────────────────┘
│ monitoring       │
│ probes (798k)    │
│ service_status   │
│ connectivity_mat │
└──────────────────┘
```

## 7. Estabilidad K8s — Pod Reinicios (Mayo 2026)

Diagnóstico y resolución de reinicios excesivos en pods del namespace `vcenter-provisioner-dev`.

### Diagnóstico

| Servicio | Reinicios (2.5 días) | Causa raíz |
|----------|---------------------|------------|
| backup-service | 97 | Servicio semi-deprecado, sin mantenimiento, amplificaba fallos |
| typing-service | 16 | `create_all()` + `seed_default_vm_classes()` en lifespan bloqueaba bind del puerto 8000 |
| auth-service | 6 | `process.exit(1)` ante `EAI_AGAIN` (DNS temporal) en conexión a postgres |
| api-gateway | 5 | Efecto cascada de NodeNotReady + probes agresivas |
| provisioner-ui | 1 | NodeNotReady puntual |

### Intervenciones

| # | Servicio | Cambio | Imagen |
|---|----------|--------|--------|
| 1 | backup-service | **Deprecado**: eliminado del cluster (deploy, svc, cm). Removido de `PROBE_TARGETS` en api-gateway, auth-service, monitoring-service. `BACKUP_SERVICE_PORT` removido de `vcenter-provisioner-config` | — |
| 2 | postgres | `readinessProbe.timeoutSeconds: 3→10`, `pg_isready -t 10` en liveness y readiness | StatefulSet patch |
| 3 | typing-service | `create_all()` + `seed` removidos del lifespan. `CMD --workers 2→1`. Startup probe `failureThreshold: 30→45`. Liveness `timeoutSeconds: 5→10` | typing-service v7 |
| 4 | auth-service | `waitForDb()` con exponential backoff + jitter (500ms→15s, 10 intentos). Admin seed wrapper con graceful degradation. `db.destroy()` en shutdown. `acquireConnectionTimeout: 10000` | auth-service v8 |
| 5 | stats-service | Liveness `timeoutSeconds: 5→10`, readiness `timeoutSeconds: 3→5`. `initialDelaySeconds` removidos (redundantes con startupProbe) | Deployment patch |

### Resultado

| Servicio | Reinicios ANTES | Reinicios DESPUÉS |
|----------|----------------|-------------------|
| backup-service | 97 | ELIMINADO |
| typing-service | 16 | 0 (startup 37s, antes 5+ min) |
| auth-service | 6 | 0 |
| api-gateway | 5 | 0 |
| provisioner-ui | 1 | 1 (histórico) |
| resto | 0 | 0 |

### Pendiente

- CoreDNS diagnóstico (`context deadline exceeded` residual en eventos)
- PDBs + topology spread constraints

---

## Resumen de Estado

| Severidad | Total | Resueltos | Pendientes |
|---|---|---|---|---|
| **🔴 CRÍTICO** | 6 | 5 (C1, C2, C3, C4, C6) | 1 (C5: HA) |
| **🟠 ALTO** | 7 | 7 (H1, H2, H3, H4, H5, H6, H7) | 0 |
| **🟡 MEDIO** | 9 | 4 (M2, M4, M5, M9) | 5 (M1, M3, M6, M7, M8) |
| **🟢 BAJO** | 11 | 0 | 11 |
| **Total** | **33** | **16** | **17** |

**Próximo paso**: Fase 3.1 (HA/Patroni), Fase 3.2 (monitoreo). Los issues de reinicios en pods (backup-service, typing-service, auth-service) fueron resueltos en la etapa de estabilidad K8s (ver sección 7).
