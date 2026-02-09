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

El sistema de monitoreo requiere almacenar resultados de probes de red:
- **Latencia** de cada servicio
- **Status** (up/down) por servicio
- **Matriz de conectividad** (quién puede reach a quién)
- **Historial** para diff de métricas

**Requisitos no funcionales:**
- TTL automático para datos efímeros
- Persistencia histórica para diff
- Latencia mínima para probes en tiempo real

---

## 2. Opciones Evaluadas

| Opción | Descripción | Pros | Contras |
|--------|-------------|-------|---------|
| **A** | PostgreSQL existente | Sin nuevos containers, ACID | TTL no nativo, overhead |
| **B** | Redis | TTL nativo, latencia sub-ms | Nuevo container, durabilidad limitada |
| **C (Elegida)** | **Híbrida Redis + PostgreSQL** | Lo mejor de ambos mundos | Mayor complejidad inicial |

---

## 3. Arquitectura Híbrida

```
┌─────────────────────────────────────────────────────────────────┐
│                    SISTEMA DE MONITOREO                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PROBES (5s, 20s intervals)                                   │
│       │                                                        │
│       ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ REDIS (Cache de probes recientes)                         │  │
│  │                                                         │  │
│  │ Estructuras:                                             │  │
│  │ - `monitoring:probe:{service}` → Hash con métricas     │  │
│  │ - `monitoring:services` → Set de servicios             │  │
│  │ - `monitoring:connectivity` → Matriz de reachability   │  │
│  │                                                         │  │
│  │ TTL: 60 segundos para probes recientes                  │  │
│  │ Expiry: Automatico via Redis TTL                        │  │
│  └─────────────────────────────────────────────────────────┘  │
│       │                                                        │
│       │  60s polling                                          │
│       ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ POSTGRESQL (Persistencia histórica)                      │  │
│  │                                                         │  │
│  │ Tablas:                                                 │  │
│  │ - `monitoring.probes` → Historial de probes           │  │
│  │ - `monitoring.service_status` → Estado actual         │  │
│  │ - `monitoring.connectivity_matrix` → Matriz histórica  │  │
│  │                                                         │  │
│  │ Retention: 7 días (configurable)                       │  │
│  └─────────────────────────────────────────────────────────┘  │
│       │                                                        │
│       ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ MONITORING-SERVICE API                                    │  │
│  │                                                         │  │
│  │ GET /api/services-status → Redis (tiempo real)         │  │
│  │ GET /api/services-history → PostgreSQL (historial)      │  │
│  │ GET /api/connectivity-matrix → Redis (cache + PG)       │  │
│  │ POST /api/probe-result → Redis + Async PG              │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Schema PostgreSQL

```sql
-- Schema: monitoring
CREATE SCHEMA monitoring;

-- Tabla: probes (historial de todos los probes)
CREATE TABLE monitoring.probes (
    id SERIAL PRIMARY KEY,
    probe_source VARCHAR(100) NOT NULL,      -- Servicio que hizo el probe
    probe_target VARCHAR(100) NOT NULL,      -- Servicio probado
    latency_ms INTEGER,                       -- Latencia en milisegundos
    status VARCHAR(20) NOT NULL,             -- 'up', 'down', 'timeout'
    error_message TEXT,                       -- Mensaje de error si aplica
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_probes_source ON monitoring.probes(probe_source, created_at);
CREATE INDEX idx_probes_target ON monitoring.probes(probe_target, created_at);
CREATE INDEX idx_probes_created ON monitoring.probes(created_at);
CREATE INDEX idx_probes_status ON monitoring.probes(status, created_at);

-- Tabla: service_status (estado actual de cada servicio)
CREATE TABLE monitoring.service_status (
    service_name VARCHAR(100) PRIMARY KEY,
    status VARCHAR(20) NOT NULL,              -- 'up', 'down', 'degraded'
    last_probe_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    consecutive_failures INTEGER DEFAULT 0,
    avg_latency_ms INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: connectivity_matrix (matriz histórica de reachability)
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

CREATE INDEX idx_connectivity_source ON monitoring.connectivity_matrix(source_service, recorded_at);
CREATE INDEX idx_connectivity_target ON monitoring.connectivity_matrix(target_service, recorded_at);

-- Cleanup job (ejecutar diariamente)
-- SELECT monitoring.cleanup_old_probes(retention_days := 7);
```

---

## 5. Estructuras Redis

```
# Probe reciente de un servicio (TTL: 60s)
monitoring:probe:{service}
    → Hash {
        "status": "up|down|timeout",
        "latency_ms": "45",
        "probe_source": "api-gateway",
        "timestamp": "2026-02-06T10:30:00Z"
    }
    → TTL: 60 segundos

# Lista de servicios monitoreados
monitoring:services
    → Set ["api-gateway", "auth-service", "orchestrator", ...]

# Matriz de conectividad (TTL: 60s)
monitoring:connectivity:{source}:{target}
    → Hash {
        "reachable": "true|false",
        "latency_ms": "32",
        "samples": "5",
        "timestamp": "2026-02-06T10:30:00Z"
    }
    → TTL: 60 segundos

# Sorted set de probes fallidos (para alertas)
monitoring:failed_probes
    → Sorted Set {
        "api-gateway:auth-service:2026-02-06T10:30:00Z" → timestamp
    }
    → TTL: 1 hora
```

---

## 6. Flujo de Datos

### 6.1 Probe Result (API)

```
POST /api/probe-result
{
    "source": "api-gateway",
    "target": "auth-service",
    "latency_ms": 32,
    "status": "up"
}

→ Redis: SET monitoring:probe:auth-service
→ Async: INSERT INTO monitoring.probes
→ Update: monitoring.service_status
```

### 6.2 Lectura de Estado (UI)

```
GET /api/services-status

→ Redis: GET monitoring:probe:{service} para cada servicio
→ Response: [{name, status, latency_ms, last_updated}]
```

### 6.3 Lectura de Historial

```
GET /api/services-history?service=auth-service&since=1h

→ PostgreSQL: SELECT * FROM monitoring.probes
             WHERE target = 'auth-service'
             AND created_at > NOW() - INTERVAL '1 hour'
→ Response: [{timestamp, source, latency, status}]
```

---

## 7. Consideraciones Operacionales

### 7.1 Redis Configuration

```yaml
redis:
  image: redis:7-alpine
  command: redis-server --appendonly yes --maxmemory 64mb --maxmemory-policy allkeys-lru
  volumes:
    - redis_data:/data
```

### 7.2 PostgreSQL Configuration

```sql
-- Extension para TTL (opcional)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Cleanup job (diario a las 3am)
SELECT cron.schedule('cleanup-old-probes', '0 3 * * *',
    'DELETE FROM monitoring.probes WHERE created_at < NOW() - INTERVAL ''7 days''');
```

### 7.3 Monitoreo

| Métrica | Umbral | Acción |
|---------|--------|--------|
| Redis memory | > 80% | Alertar |
| PostgreSQL probe queue | > 1000 pending | Alertar |
| Probe latency (Redis) | > 100ms | Investigar |
| Failed probes | > 5% | Alertar |

---

## 8. Trade-offs

| Aspecto | Decisión | Justificación |
|---------|----------|---------------|
| Latencia de probes | Redis | sub-ms para tiempo real |
| Persistencia histórica | PostgreSQL | ACID, queries complejos |
| TTL | Redis nativo | Simplifica cleanup |
| Complejidad | Aceptada | Beneficios > costo |
| Container adicional | Redis | 50MB RAM es acceptable |

---

## 9. Costo

| Componente | Costo |
|------------|-------|
| Redis (64MB RAM) | ~$5/month (cloud) / local: 0 |
| PostgreSQL | Ya existe (0 adicional) |
| Development | ~4 horas implementación |

---

## 10. Referencias

- [ADR-001: Database Choice](./ADR-001-database-choice.md)
- [Workflow 03: Database Choice](../.agents/skills/architecture-decision-engineer/workflows/03-database-choice.md)
- [ Sistema de Monitoreo - Diseño ](../docs/monitoring-design.md)

---

## 11. Historial de Versiones

| Versión | Fecha | Autor | Cambios |
|---------|-------|-------|---------|
| 1.0 | 2026-02-06 | Equipo Dev | Versión inicial |

---

© 2026 Antigravity Engineering | ADR Framework v1.0
