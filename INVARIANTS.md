# Invariantes del Proyecto - NO MODIFICAR

## ⚠️ REGLAS INQUEBRANTABLES

### 1. Estructura de Directorios
```
apps/
├── api-gateway/
├── auth-service/
├── backup-service/
├── monitoring-service/
├── provisioner-ui/
├── stats-service/
├── typing-service/
├── credential-manager/
├── vcenter-operations/
└── vm-orchestrator/

infra/local/
├── docker-compose.yml
└── init.sql

config/
├── services.json  # (reemplaza services.ps1)
└── ports.json     # (reemplaza ports.ps1)
```

### 2. Configuración de Servicios

Cada servicio DEBE tener:
```json
{
  "name": "api-gateway",
  "path": "apps/api-gateway",
  "imageName": "antigravity/api-gateway",
  "type": "node",
  "lintCmd": "npm run lint",
  "testCmd": "npm test",
  "isUtility": false
}
```

### 3. Docker Compose Names

Los nombres de contenedores DEBEN seguir este patrón:
- `provisioner-<service-name>`
- Ejemplos: `provisioner-api-gateway`, `provisioner-auth-service`

### 4. Puertos (NO CAMBIAR)

```
api-gateway:        3000
auth-service:       3001
provisioner-ui:     5173
typing-service:     8000
stats-service:      8001
backup-service:     8002
vm-orchestrator:    8080
vcenter-operations: 8081
monitoring-service: 8083
credential-manager:     8084
```

### 5. Docker Images

Todas las imágenes DEBEN usar prefijo: `antigravity/`

Formato de tag: `<service-name>:<hash-10-chars>`
Ejemplo: `antigravity/api-gateway:a1b2c3d4e5`

### 6. Archivo .env.ci

DEBE generarse automáticamente con:
```
SHARED_SCRIPTS_HASH=<hash>
API_GATEWAY_HASH=<hash>
AUTH_SERVICE_HASH=<hash>
...
```

### 7. Dependencias de Build

Orden OBLIGATORIO:
1. shared-scripts (SIEMPRE primero)
2. Todos los demás servicios (pueden ser paralelos)

### 8. Health Checks

Cada servicio DEBE exponer:
- `GET /health` → HTTP 200
- Timeout: 5 segundos

### 9. Logs

Formato: `<timestamp> <level> <message>`
Niveles: INFO, WARN, ERROR, DEBUG

### 10. Permisos de Archivos

Scripts ejecutables: `755`
Archivos de config: `644`
Directorios: `755`

---

## 🔒 RESTRICCIONES TÉCNICAS

1. **NO** modificar Dockerfiles de los servicios
2. **NO** cambiar puertos internos de contenedores
3. **NO** modificar la base de datos PostgreSQL
4. **NO** cambiar nombres de variables de entorno críticas:
   - `DATABASE_URL`
   - `REDIS_URL`
   - `JWT_SECRET`
   - `API_BASE_URL`

5. **NO** eliminar `shared-scripts` - es dependencia crítica

## ✅ PERMITIDO MODIFICAR

- Scripts de CI/CD (pipeline.ps1 → pipeline.sh)
- Utilidades de build
- Scripts de automatización
- Configuración de paths (Windows → Linux)
- Line endings (CRLF → LF)

## 📝 CONVENCIONES DE CÓDIGO (Linux)

### Bash
```bash
#!/usr/bin/env bash
set -euo pipefail

# Variables: SCREAMING_SNAKE_CASE
readonly BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Funciones: lowercase_with_underscores
function validate_prerequisites() {
    # ...
}

# No usar backticks, usar $()
files=$(ls -la)
```

### Python (si se elige)
```python
#!/usr/bin/env python3
"""Docstring obligatorio."""

import subprocess
from pathlib import Path
from typing import Dict, List

# Constants: UPPER_CASE
BASE_DIR = Path(__file__).parent

# Functions: lowercase_with_underscores
def validate_prerequisites() -> bool:
    """Docstring obligatorio."""
    pass
```

---

## 🧪 CHECKLIST DE VALIDACIÓN

Antes de considerar la migración completa:

- [ ] `./pipeline.sh --validate` funciona
- [ ] `./pipeline.sh --lint` pasa en todos los servicios
- [ ] `./pipeline.sh --build` genera imágenes correctamente
- [ ] `./pipeline.sh --up` levanta todos los servicios
- [ ] `curl http://localhost:3000/health` responde 200
- [ ] UI accesible en http://localhost:5173
- [ ] `./pipeline.sh --down` baja todos los servicios
- [ ] No hay errores en logs de contenedores

---

**Última actualización:** 2026-02-09
**Versión:** 1.0
