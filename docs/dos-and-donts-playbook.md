# Do's and Don'ts Playbook: Engineering Excellence 🛡️

> **Última actualización:** 2026-02-06
> **Propósito:** Guía de mejores prácticas, errores a evitar y principios arquitectónicos para el desarrollo del vCenter Provisioner.

---

## 1. Principios Fundamentales

Estos principios guían toda decisión técnica y de diseño en el proyecto.

### 1.1 Obedecer Constraints Explícitos

Si el usuario, la arquitectura o los estándares prohíben una acción, jamás reintroducirla, aunque parezca más simple o cómoda.

**Ejemplo:** Si el usuario prohíbe copiar archivos en pipelines → no copiar nunca.

### 1.2 Priorizar Diseño sobre Conveniencia

Resolver problemas de raíz, no con workarounds temporales.

Antes de implementar, siempre preguntar:
- ¿Esto rompe DRY (Don't Repeat Yourself)?
- ¿Esto acopla artefactos al layout del repo?
- ¿Esto introduce magia invisible?

### 1.3 Mantener una Sola Fuente de Verdad

No duplicar artefactos ni scripts. Cada recurso debe tener un origen único y versionado claro.

**Ejemplo correcto:**
```dockerfile
COPY --from=scripts /probe-scheduler.sh /probe-scheduler.sh
```

### 1.4 Desacoplar Artefactos del Layout del Repo

Dockerfiles, scripts y configuraciones no deben asumir rutas locales arbitrarias.

- Los Dockerfiles declaran qué necesitan, no dónde está.
- Los scripts viven en un único lugar (`scripts/`).
- El build funciona sin conocimiento implícito del layout.

### 1.5 Evitar Magia Invisible

Nada de:
- Symlinks raros
- Mountings opacos
- Scripts pipeline ad-hoc que no sean explicables
- Cajas negras irreproducibles

**Todo debe ser reproducible con:**
```bash
docker build -f Dockerfile .
docker compose up -d
```

### 1.6 Explicabilidad Rápida

Cualquier desarrollador (o agente IA) debe entender la construcción de la imagen en **≤ 5 minutos**.

---

## 2. ✅ Do's (Lo que SIEMPRE debemos hacer)

### 2.1 Documentación de Dominio
Escribir READMEs que expliquen el **"Por qué"** y no solo el **"Cómo"**.

### 2.2 Unit Testing Aislado
Asegurar que cada servicio pueda probar su lógica core **sin depender de la red o DBs reales**.
- Usar mocks e implementaciones in-memory.
- Tests híbridos: Host (velocidad) + Docker (determinismo).

### 2.3 Hardening Tier-0
- Usar siempre imágenes **rootless**.
- Healthchecks nativos en cada Dockerfile.
- Usuario no-root (`clouduser`) en todos los contenedores.

### 2.4 Atomicidad en ID Gen
Garantizar transiciones seguras en motores de secuencia (TP-Haki).
- Contadores en base de datos.
- Transacciones explícitas.

### 2.5 Dockerfiles Bien Diseñados

**Patrón correcto (multi-stage con scripts compartidos):**
```dockerfile
# Build stage
FROM node:20-alpine AS builder
COPY package*.json ./
RUN npm ci --quiet

# Scripts stage
FROM antigravity/shared-scripts:AB37FFE208 AS scripts

# Runtime stage
COPY --from=scripts /probe-scheduler.sh /probe-scheduler.sh
COPY --from=builder --chown=clouduser /app/dist ./dist
```

**Beneficios:**
- DRY: Scripts en un solo lugar
- Desacoplado: No asume rutas del repo
- Reproducible: Funciona en cualquier máquina

### 2.6 Centralización de Configuración

| Aspecto | Cómo |
|:--------|:-----|
| **Puertos** | `config/ports.ps1` (una fuente de verdad) |
| **Servicios** | `config/services.ps1` |
| **API URLs** | `src/utils/api.ts` (no fragmentar) |
| **Scripts** | `scripts/` (una ubicación) |

### 2.7 Pipeline Como Única Puerta

Todo pasa por `pipeline.ps1`:
```powershell
.\pipeline.ps1              # Lint + Test + Build
.\pipeline.ps1 --lint       # Solo lint
.\pipeline.ps1 --build      # Solo build
.\pipeline.ps1 --docker     # Tests en Docker (determinismo)
```

### 2.8 Tags Hash Determinísticos

Usar `servicio:<hash10caracteres>` en lugar de `:latest` o versiones semánticas.

**Ejemplo:**
```dockerfile
image: antigravity/api-gateway:a1b2c3d4e5
```

### 2.9 Validación Temprana

Detectar problemas lo antes posible:
```powershell
.\pipeline.ps1 --validate   # Prerrequisitos
.\pipeline.ps1 --lint       # Feedback inmediato
```

---

## 3. ❌ Don'ts (Lo que NUNCA debemos repetir)

### 3.1 Placeholders en Docs
Dejar archivos `.md` con plantillas genéricas vacías.

> Es preferible **no tenerlos** que tener información falsa o desactualizada.

### 3.2 Confianza Ciega en el Build
"Compila" ≠ "Funciona".

- Verificar que los tests pasen.
- Validar healthchecks de todos los servicios.
- Probar endpoints críticos post-build.

### 3.3 Alucinar Versiones
Especificar versiones de lenguajes que no coinciden con la imagen base del Dockerfile.

**Verificar siempre:**
```dockerfile
FROM node:20.11.0-alpine3.19  # Version exacta
```

### 3.4 Copiar Archivos en Pipelines
No copiar archivos desde pipelines arbitrariamente hacia los Dockerfiles.

**Incorrecto:**
```powershell
# En pipeline.ps1 - EVITAR
Copy-Item "scripts/*" -Destination "apps/api-gateway/scripts/"
```

**Correcto:**
```dockerfile
# En Dockerfile
COPY --from=scripts /probe-scheduler.sh /probe-scheduler.sh
```

### 3.5 Omitir Manifiestos
Usar `import` en el código sin declarar la librería en `package.json`.

### 3.6 Abuso de `npm ci`
Forzar `npm ci` cuando el lock file tiene versiones radicalmente distintas a la imagen base.

**Solución:**
```dockerfile
# Si hay alta volatilidad: usar npm install
RUN npm install --legacy-peer-deps --no-audit --no-fund
```

### 3.7 Fragmentación de API URLs
Definir URLs base por componente de forma manual.

**Solución:**
```typescript
// src/utils/api.ts - CENTRALIZADO
export const API_URLS = {
  gateway: process.env.VITE_API_URL || 'http://localhost:3000',
  typing: process.env.VITE_TYPING_URL || 'http://localhost:8000',
  // Una sola fuente de verdad
}
```

### 3.8 Ignorar Tipado de Entorno
Dejar que TypeScript maneje `import.meta.env` sin definiciones de Vite.

**Solución:**
```typescript
// env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_TYPING_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

### 3.9 Acoplamiento Directo en Tests
Intentar correr unit tests que requieran un cluster de K8s o Docker activo para verificar lógica de negocio pura.

**Solución:**
- Tests unitarios: mocks e in-memory
- Tests integración: Docker (determinismo)
- Tests E2E: Compose completo

### 3.10 Modificar Pipelines a Escondidas
Cambiar `pipeline.ps1` o scripts de CI sin documentar ni comunicar.

---

## 4. Mentalidad del Ingeniero

### 4.1 Arquitextura Primero, Operación Segundo

Pensar en **relaciones entre artefactos** antes de resolver la ejecución.

**Pregunta antes de implementar:**
> "Este cambio, ¿afecta otros servicios? ¿Introduce acoplamiento?"

### 4.2 Disciplina y Humildad

- Documentar cada decisión de diseño.
- Planificar antes de ejecutar.
- Pedir feedback antes de asumir que está bien.

### 4.3 Colaborativo

Validar ideas antes de implementarlas:

> "¿Esto cumple con los principios y constraints del proyecto?"

### 4.4 Principio sobre Comodidad

Elegir la solución **más correcta arquitectónicamente**, no la más fácil técnicamente.

**Ejemplo:**
- Difícil: Refactorizar 9 Dockerfiles para usar shared-scripts
- Fácil: Copiar scripts en cada Dockerfile

**Resultado correcto:** Aunque took más tiempo, ahora DRY y desacoplado.

---

## 5. Lo que Resolvimos con Esta Mentalidad

### Problema Original
Dockerfiles acoplados al layout, scripts duplicados, magia invisible.

### Solución Aplicada

| Aspecto | Antes (MAL) | Después (BIEN) |
|:--------|:------------|:---------------|
| **Scripts** | Copiados en cada Dockerfile | `shared-scripts:AB37FFE208` |
| **Tags** | `:latest` o manual | Hash determinístico |
| **Pipeline** | Scripts ad-hoc | `pipeline.ps1` unificado |
| **Docs** | Placeholders vacíos | Información real y actualizada |
| **Artefactos** | Acoplados al repo | Desacoplados, multi-stage |

### Beneficios

| Principio | Cumplimiento |
|:----------|:------------:|
| DRY | ✅ Scripts en un solo lugar |
| Desacoplamiento | ✅ Dockerfiles no asumen rutas |
| Reproducibilidad | ✅ Tags hash determinísticos |
| Explicabilidad | ✅ ≤ 5 minutos para entender |
| Sin magia | ✅ Solo Docker estándar |

---

## 6. Referencia Rápida

| Qué Hacer | Comando/Ejemplo |
|:----------|:---------------|
| Pipeline completo | `.\pipeline.ps1` |
| Solo lint | `.\pipeline.ps1 --lint` |
| Solo build | `.\pipeline.ps1 --build` |
| Tests en Docker | `.\pipeline.ps1 --docker` |
| Levantar servicios | `.\pipeline.ps1 --up` |
| Bajar servicios | `.\pipeline.ps1 --down` |
| Ver estado | `.\pipeline.ps1 --status` |
| Verificar salud | `curl http://localhost:3000/health` |

> **Nota:** `start.ps1` está deprecado. Usa `pipeline.ps1 --up` en su lugar.

---

© 2026 Antigravity Engineering | Engineering Excellence Playbook
