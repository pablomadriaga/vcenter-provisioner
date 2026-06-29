---
description: "Motor de tipificación TP-Haki: API, reglas de nombrado, secuencia, DB schema"
category: architecture
priority: high
agent_role: plan, debug
paths: ["apps/typing-service/**"]
---

# vCenter Provisioner — Documentación de Tipificaciones

> **Entorno actual:** Kubernetes. Usar `kubectl exec` y `kubectl logs` en lugar de comandos Docker.

## 1. Convención de Nombrado

```
{prefijo1}-{prefijo2}-{manual_value}-{sequence}
```

| Componente | Regla | Ejemplo |
|:-----------|:------|:--------|
| **Prefijo 1** | Alfanumérico, máx 50 chars. Definido al crear la tipificación. | `SRV`, `PRD`, `TST` |
| **Prefijo 2** | Alfanumérico, máx 50 chars. Definido al crear la tipificación. | `WEB`, `DB`, `APP` |
| **Manual Value** | Alfanumérico, sin límite de longitud. Proporcionado al crear VM. | `proj1`, `appname` |
| **Sequence** | 1–4 dígitos (configurable). Auto-incremental, padded con ceros. | `001`, `0001` |

### Ejemplos
- `SRV-WEB-proj1-001` — Servidor web, proyecto 1, primera VM
- `PRD-DB-appname-0001` — Base de datos producción, primera VM
- `TST-APP-feature1-0001` — App de prueba, feature1, primera VM

---

## 2. API Endpoints

### 2.1 Crear Tipificación
```
POST /typing/templates
```
```json
{ "name": "tp-haki", "prefijo1": "SRV", "prefijo2": "WEB", "seq_digits": 3 }
```
**Validación:** `name` (1-100 chars, único), `prefijo1`/`prefijo2` (alfanumérico, 1-50), `seq_digits` (int 1-4).
**Respuesta:** `201` con `{ id, name, prefijo1, prefijo2, seq_digits, is_active: true, created_at }`

### 2.2 Listar Tipificaciones
```
GET /typing/templates
```
Retorna solo tipificaciones activas (`is_active: true`).

### 2.3 Editar Tipificación (Inmutable)
```
PUT /typing/templates/{id}
```
```json
{ "prefijo1": "SRV", "prefijo2": "DB", "seq_digits": 4, "edit_reason": "Migración a 4 dígitos (mín 10 chars)" }
```
**Comportamiento:**
- Crea una NUEVA tipificación con valores actualizados; marca la original `is_active: false`.
- Copia el contador de secuencia a la nueva.
- Requiere `edit_reason` (10-255 chars). Al menos un campo debe cambiar.

### 2.4 Previsualizar Nombre de VM
```
POST /typing/generate-name/{template_id}
Body: "proj1"  (Content-Type: text/plain)
```
```json
{ "full_name": "SRV-WEB-proj1-001", "segments": ["SRV", "WEB", "proj1", "001"], "next_seq": 1 }
```
No incrementa el contador. Solo previsualiza.

### 2.5 Guía de Uso Rápido
- **Administradores:** Crear/editar tipificaciones desde "Tipificaciones". Edición inmutable con historial.
- **Creadores de VM:** Seleccionar tipificación + ingresar `manual_value`. El contador se incrementa al crear, no al previsualizar.

---

## 3. VMs Huérfanas

Cuando una tipificación se marca `is_active: false`, las VMs creadas con la versión anterior:
- Siguen existiendo y siendo funcionales.
- Conservan su `template_id` original. Son rastreables y aparecen en estadísticas.
- Se identifican filtrando por `is_active: false`.

**Ejemplo:** `SRV-WEB-proj1-001` (3 dígitos) → editada a 4 dígitos → VMs con 3 dígitos quedan huérfanas pero operativas.

---

## 4. Schema de Base de Datos

```sql
CREATE TABLE typification_templates (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    prefijo1 VARCHAR(50) NOT NULL,
    prefijo2 VARCHAR(50) NOT NULL,
    seq_digits INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    edit_reason VARCHAR(255),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE typification_counters (
    template_id INTEGER REFERENCES typification_templates(id) PRIMARY KEY,
    current_value INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vm_provisions (
    id INTEGER PRIMARY KEY,
    vm_name VARCHAR(255) UNIQUE NOT NULL,
    template_id INTEGER REFERENCES typification_templates(id),
    requester_id INTEGER REFERENCES users(id),
    vcenter_datacenter VARCHAR(100),
    vcenter_cluster VARCHAR(100),
    vcenter_resource_pool VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    specs JSON,
    error_log TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. Lógica de Secuencia

1. Al crear VM: se consulta `typification_counters.current_value`, se incrementa en 1, se formatea con `seq_digits`.
2. Al previsualizar: se calcula `next_seq` sin incrementar el contador.
3. El contador inicia en 0 → primera VM recibe 1 (padded: `001`, `0001`).
4. Persistido en PostgreSQL. Al editar tipificación, el contador se copia a la nueva fila.

---

## 6. Troubleshooting Rápido

- **Salud del servicio:** `kubectl exec -it deploy/typing-service -- curl -s http://localhost:8000/health`
- **Tipificaciones activas:** `kubectl exec -it deploy/postgres -- psql -U antigravity vcenter_provisioner -c "SELECT * FROM typification_templates WHERE is_active = true;"`
- **Contadores:** `kubectl exec -it deploy/postgres -- psql -U antigravity vcenter_provisioner -c "SELECT * FROM typification_counters;"`
- **Logs:** `kubectl logs deploy/typing-service --tail=50` / `kubectl logs deploy/vm-orchestrator --tail=50`

---

## 7. Guía de Migración

- Analizar VMs existentes y extraer patrones de prefijos. Crear tipificaciones que mapeen esos patrones.
- Para VMs legacy: crear tipificaciones y marcarlas `is_active: false`. Actualizar scripts, docs y entrenar al equipo.

---

**© 2026 Antigravity Engineering | vCenter Provisioner Typifications v1.2**
