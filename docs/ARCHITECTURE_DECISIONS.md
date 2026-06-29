# Decisiones Arquitectónicas 📋

> "El código siempre tiene razón. Si la documentación contradice el código, cuestionar la documentación."

## Philosophy

Este documento consolida decisiones arquitectónicas que el código demuestra, no prescribe. Las prácticas aquí definidas emergen del comportamiento real del sistema.

---

## Contratos Implícitos (Del Código, No Prescripción)

### Contratos de Build

| Decisión | Contrato | Verificación |
|----------|----------|--------------|
| `pipeline.ps1 --build` unificado | Build y runtime son fases separadas | `pipeline.ps1 --up` falla si build no ejecutó |
| Tags `service:<hash10>` | No existen tags mutables (`latest`, `dev`) | Tags mutables no existen en el sistema |
| `.env.ci` generado por build | Hash no se infiere ni reutiliza | Si falta `.env.ci`, `pipeline.ps1 --build` lo genera |

### Contratos de Determinismo

| Decisión | Contrato |
|----------|----------|
| `Get-DirectoryHash` usa `Resolve-Path` | Paths absolutos no afectan hash |
| Exclusión explícita | `node_modules/`, `__pycache__/`, `.git/` no son contenido efectivo |
| Orden lexicográfico | Hash no depende de orden de iteración |

### Contratos de Runtime

| Decisión | Contrato |
|----------|----------|
| `pipeline.ps1 --up` valida `docker images -q <tag>` | Solo consume imágenes existentes |
| `docker compose up -d` sin `--build` | Docker Compose nunca ejecuta build |
| `--env-file .env.ci` en compose | Orquestación consume hashes declarados |

### Contratos de Eliminación de Inferencias

| Decisión | Contrato |
|----------|----------|
| Mapeo declarativo `Service → Path + Tag` | No existe transformación `KEY_HASH → service` |
| Sin `--replace`, `-replace` | Nombres no se derivan, se declaran |
| Contrato cerrado en código | El sistema no "adivina" intenciones |

---

## Decisiones de Infraestructura

### Docker Compose es el Target de Producción

```
┌─────────────────────────────────────────────────────────┐
│                    PRODUCCIÓN                            │
│                                                         │
│   Docker Compose (infra/local/docker-compose.yml)  ✅    │
│   Sin Kubernetes (por decisión explícita)           ❌    │
│   Sin registries externos (imágenes con tags hash)          ✅    │
│   Sin abstracción adicional                         ✅    │
└─────────────────────────────────────────────────────────┘
```

**No implementaremos:**
- ❌ Kubernetes manifests
- ❌ Dapr sidecars
- ❌ HPA (Horizontal Pod Autoscaler)
- ❌ Service Mesh
- ❌ Registries externos (DockerHub, ECR, GCR)

**Sí, el sistema es:**
- ✅ Docker-first desde desarrollo hasta producción
- ✅ Imágenes con tags hash sin dependencias externas
- ✅ Tests híbridos: Host (velocidad) + Docker (determinismo)
- ✅ CI/CD local determinista

### Ports de Servicios

| Servicio | Puerto | Notas |
|----------|--------|-------|
| API Gateway | 3000 | Entry point, proxy, JWT verification |
| Auth Service | 3001 | Gestión de identidad |
| Typing Service | 8000 | Motor TP-Haki |
| VM Orchestrator | 8080 | Máquina de estados |
| vCenter Operations | 8091 | API vSphere (MOCKED → READ-ONLY) |
| Stats Service | 8001 | Métricas |
| Monitoring | 8082 | Sentinel de salud |
| Credential Manager | 8090 | Gestión de credenciales vCenter |
| Backup Service | 8002 | Políticas de respaldo |
| Provisioner UI | 5173 | React frontend |

---

## Decisiones de Testing

### Pirámide de Testing

```
Unit (70%):        Tests rápidos en host        ████████████
Integration (20%): Tests de contratos APIs      ██
E2E (10%):         Playwright completos        ███
```

### Principio de Determinismo

1. **Tests en host** para velocidad durante desarrollo
2. **Tests en Docker** para validación final (determinismo)
3. **Coverage mínimo 80%** en lógica de negocio
4. **Fail-fast** en CI/CD

---

## Decisiones de Datos

### PostgreSQL Only

```
✅ PostgreSQL en docker-compose
✅ SQLite PROHIBIDO (Anti-SQLite rule)
✅ DATABASE_URL via environment
```

### Secrets Management

| Estado | Decisión |
|--------|----------|
| **Actual** | Variables de entorno (MVP) |
| **Planeado** | HashiCorp Vault (roadmap, sin fecha) |
| **Nunca** | Secrets en código o scripts |

**Nota:** La migración a Vault está pendiente. No hay fecha hardcodeada.

---

## Decisiones de Integración vCenter

### Estado Actual: MOCKED

| Aspecto | Decisión |
|---------|----------|
| **Modo actual** | Mock (simula respuesta de vSphere) |
| **Objetivo** | Read-only contra vCenter real |
| **Deadline** | Por definir (no hay fecha) |

### Camino a Read-Only

```
FASE 1 (Pendiente): Read-only
├── GET VMs del inventory real
├── GET templates disponibles
└── GET datastores disponibles

FASE 2 (Futuro): Write operations
├── POST crear VM
├── DELETE eliminar VM
└── UPDATE modificar VM
```

**Esta decisión está pendiente hasta que:**
1. Credenciales de vCenter estén disponibles
2. Ambiente de desarrollo esté configurado
3. Tests de integración se ejecuten contra vCenter real

---

## Decisiones de Documentación

### Regla de Oro

> **"Documentación que crece = diseño que falla"**

### Documentos Consolidados

| Este documento | Reemplaza a |
|----------------|-------------|
| `ARCHITECTURE_DECISIONS.md` | `CONTRACT_DIFFERENCES.md`, `DOCKER-LESSONS-LEARNED.md` |
| `CHANGELOG.md` | `FIX-REPORT-*.md` |

### Documentos Eliminados

- ❌ `CONTRACT_DIFFERENCES.md` (contenido fusionado aquí)
- ❌ `DOCKER-LESSONS-LEARNED.md` (contenido fusionado aquí)
- ❌ `FIX-REPORT-*.md` (contenido en CHANGELOG.md)

### Referencias CI/CD

| Documento | Propósito |
|-----------|-----------|
| [docs/CI-CD-LOCAL.md](./CI-CD-LOCAL.md) | Guía completa del pipeline CI/CD |
| [docs/CONTRACT.md](./CONTRACT.md) | Contratos del sistema |

---

## Decisiones de Ruby/Python/Go/Node

### Polyglot Rationale

| Lenguaje | Servicio | Razón |
|----------|----------|-------|
| **React** | Provisioner UI | I/O intensivo, renderizado dinámico |
| **Node.js** | API Gateway, Auth | Proxy, JWT, velocidad de desarrollo |
| **Python** | Typing, Stats, Backup | ML readiness, productividad |
| **Go** | Orchestrator, vCenter Adapter | Concurrencia, SDK nativo govmomi |

### No Hay "Best Language"

Cada lenguaje optimiza para su dominio específico.

---

## Invariantes del Sistema

| Invariante | Significado |
|------------|-------------|
| PostgreSQL only | No SQLite, no MongoDB |
| CI/CD local antes de commit | Pipeline local es gate |
| Tests host + docker | Validación híbrida |
| No `:latest` tag | Usar `:hash` determinístico |
| `--build` obligatorio | docker-compose up requiere rebuild |

---

## ADR-005: Renombramiento de vCenter Services

**Status:** Aceptado  
**Fecha:** 2026-03-19  
**Decisor:** vCenter Provisioner Team

### Context

Los nombres actuales no reflejan claramente las responsabilidades de los servicios:

- `vcenter-config-service` → gestión de credenciales y conexiones → **credential-manager**
- `vcenter-integration` → operaciones de infraestructura → **vcenter-operations**

### Decisiones

1. **Renombrar directorios:**
   - `apps/vcenter-config-service/` → `apps/credential-manager/`
   - `apps/vcenter-integration/` → `apps/vcenter-operations/`

2. **Renombrar servicios Docker Compose:**
   - `vcenter-config` → `credential-manager`
   - `vcenter-integration` → `vcenter-operations`

3. **Cambiar puertos a valores libres:**
   - `credential-manager`: 8090 (取代 8082)
   - `vcenter-operations`: 8091 (取代 8081)

4. **Renombrar imágenes Docker:**
   - `antigravity/vcenter-config` → `antigravity/credential-manager`
   - `antigravity/vcenter-integration` → `antigravity/vcenter-operations`

5. **Renombrar container names:**
   - `provisioner-vcenter-config` → `provisioner-credential-manager`
   - `provisioner-vcenter-integration` → `provisioner-vcenter-operations`

6. **Mantener lenguajes actuales:**
   - `credential-manager`: TypeScript (Excelente para CRUD, Knex, pg)
   - `vcenter-operations`: Go (SDK govmomi nativo)

7. **Backwards Compatibility:**
   Variables deprecated (aliases por 1 versión):
   - `VCENTER_CONFIG_URL` → `CREDENTIAL_MANAGER_URL`
   - `VCENTER_INTEGRATION_URL` → `VCENTER_OPERATIONS_URL`

### Consecuencias

**Positivo:**
- Claridad en responsabilidades de servicios
- Puertos libres (8081, 8082) disponibles para otros usos
- Nombres más descriptivos para debugging y operaciones

**Negativo:**
- Breaking change en nombres de containers (requiere cleanup)
- Scripts que referencien nombres antiguos fallarán

### Backwards Compatibility Implementada

```typescript
// credential-manager (TypeScript)
export const CREDENTIAL_MANAGER_URL = process.env.CREDENTIAL_MANAGER_URL 
    || process.env.VCENTER_CONFIG_URL  // Alias deprecated
    || 'http://credential-manager:8090';
```

```go
// vcenter-operations (Go)
var VCenterOperationsURL = os.Getenv("VCENTER_OPERATIONS_URL")
if VCenterOperationsURL == "" {
    VCenterOperationsURL = os.Getenv("VCENTER_INTEGRATION_URL")  // Alias deprecated
}
if VCenterOperationsURL == "" {
    VCenterOperationsURL = "http://vcenter-operations:8091"
}
```

---

**Última actualización:** 2026-03-19
**Estado:** Implementado

---

© 2026 Antigravity Engineering
