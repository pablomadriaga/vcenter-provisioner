---
description: "ADR: Almacenamiento híbrido Redis+PostgreSQL para monitoreo"
category: architecture
priority: medium
agent_role: reference, plan
---

# ADR-004: Sistema de Monitoreo - Persistencia Híbrida Redis + PostgreSQL

| Campo | Detalle |
|-------|----------|
| **ID** | ADR-004 |
| **Título** | Persistencia Híbrida para Sistema de Monitoreo |
| **Status** | Aprobado |
| **Decisor** | Equipo de Desarrollo |
| **Fecha** | 2026-02-06 |

---

## 1. Contexto

El sistema de monitoreo almacena resultados de probes de red: latencia, status (up/down), matriz de conectividad e historial para diff de métricas. **Requisitos no funcionales:** TTL automático para datos efímeros, persistencia histórica para diff, latencia mínima en tiempo real.

---

## 2. Opciones Evaluadas

| Opción | Descripción | Pros | Contras |
|--------|-------------|-------|---------|
| **A** | PostgreSQL existente | Sin nuevos containers, ACID | TTL no nativo, overhead |
| **B** | Redis | TTL nativo, latencia sub-ms | Nuevo container, durabilidad limitada |
| **C (Elegida)** | **Híbrida Redis + PostgreSQL** | Lo mejor de ambos mundos | Mayor complejidad inicial |

---

## 3. Decisión

**Redis** como cache de probes recientes (TTL 60s) para consultas en tiempo real. **PostgreSQL** como almacén histórico (retención 7 días) para queries analíticos y diff. El monitoring-service escribe en Redis (síncrono) y PostgreSQL (asíncrono vía polling de 60s).

**APIs:**
- `GET /api/services-status` → Redis (tiempo real)
- `GET /api/services-history` → PostgreSQL (historial)
- `GET /api/connectivity-matrix` → Redis + PostgreSQL
- `POST /api/probe-result` → Redis + async PostgreSQL

---

## 4. Schema PostgreSQL

```sql
CREATE SCHEMA monitoring;

-- Historial de todos los probes
CREATE TABLE monitoring.probes (
    id SERIAL PRIMARY KEY,
    probe_source VARCHAR(100) NOT NULL,
    probe_target VARCHAR(100) NOT NULL,
    latency_ms INTEGER,
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Estado actual de cada servicio
CREATE TABLE monitoring.service_status (
    service_name VARCHAR(100) PRIMARY KEY,
    status VARCHAR(20) NOT NULL,
    last_probe_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    consecutive_failures INTEGER DEFAULT 0,
    avg_latency_ms INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Matriz histórica de reachability
CREATE TABLE monitoring.connectivity_matrix (
    id SERIAL PRIMARY KEY,
    source_service VARCHAR(100) NOT NULL,
    target_service VARCHAR(100) NOT NULL,
    is_reachable BOOLEAN NOT NULL,
    latency_ms INTEGER,
    sample_size INTEGER DEFAULT 1,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_service, target_service, recorded_at)
);

-- Cleanup job (diario)
-- SELECT monitoring.cleanup_old_probes(retention_days := 7);
```

---

## 5. Estructuras Redis (TTL: 60s)

- `monitoring:probe:{service}` → Hash: `status`, `latency_ms`, `probe_source`, `timestamp`
- `monitoring:services` → Set: `["api-gateway", "auth-service", "orchestrator", ...]`
- `monitoring:connectivity:{source}:{target}` → Hash: `reachable`, `latency_ms`, `samples`, `timestamp`
- `monitoring:failed_probes` → Sorted Set con timestamp (TTL: 1h, para alertas)

---

## 6. Consideraciones Operacionales

**Redis:** `redis:7-alpine`, `--appendonly yes --maxmemory 64mb --maxmemory-policy allkeys-lru`.

**PostgreSQL:** Extensión `pg_cron` para cleanup: `DELETE FROM monitoring.probes WHERE created_at < NOW() - INTERVAL '7 days'` (diario a las 3am).

| Métrica de monitoreo | Umbral | Acción |
|---------|--------|--------|
| Redis memory | > 80% | Alertar |
| PostgreSQL probe queue | > 1000 pending | Alertar |
| Probe latency (Redis) | > 100ms | Investigar |
| Failed probes | > 5% | Alertar |

---

## 7. Trade-offs

| Aspecto | Decisión | Justificación |
|---------|----------|---------------|
| Latencia de probes | Redis | sub-ms para tiempo real |
| Persistencia histórica | PostgreSQL | ACID, queries complejos |
| TTL | Redis nativo | Simplifica cleanup |
| Complejidad | Aceptada | Beneficios > costo |
| Container adicional | Redis | 50MB RAM aceptable |

---

## 8. Costo

| Componente | Costo |
|------------|-------|
| Redis (64MB RAM) | ~$5/month (cloud) / local: $0 |
| PostgreSQL | Ya existe ($0 adicional) |
| Desarrollo | ~4 horas implementación |

---

## 9. Referencias

- [ADR-001: Database Choice](./ADR-001-database-choice.md)
- [Sistema de Monitoreo - Diseño](../docs/monitoring-design.md)

---

## 10. Historial de Versiones

| Versión | Fecha | Autor | Cambios |
|---------|-------|-------|---------|
| 1.0 | 2026-02-06 | Equipo Dev | Versión inicial |

---

© 2026 Antigravity Engineering | ADR Framework v1.0
