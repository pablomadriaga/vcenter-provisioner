# Docker Image Versioning Best Practices 🐳

## Overview

This document establishes the standard practices for Docker image versioning in the Antigravity vCenter Provisioner project. Following these practices ensures consistency, reproducibility, and traceability across all deployments.

---

## 📋 Table of Contents

1. [Semantic Versioning for Docker Images](#semantic-versioning-for-docker-images)
2. [When to Bump Versions](#when-to-bump-versions)
3. [Version Bumping Workflow](#version-bumping-workflow)
4. [Docker Image Naming Conventions](#docker-image-naming-conventions)
5. [Docker Compose Updates](#docker-compose-updates)
6. [Migration from Old Versions](#migration-from-old-versions)
7. [Testing and Validation](#testing-and-validation)
8. [Best Practices Checklist](#best-practices-checklist)

---

## 🎯 Semantic Versioning for Docker Images

Docker images in this project follow **Semantic Versioning (SemVer)** in the format: `MAJOR.MINOR.PATCH`

- **MAJOR (X.0.0)**: Breaking changes that require manual intervention
  - Database schema changes requiring migration
  - API contract changes
  - Configuration structure changes
  - Removal of deprecated endpoints

- **MINOR (0.X.0)**: New features compatible with existing deployments
  - New UI components or pages
  - New API endpoints (backward compatible)
  - New service functionality
  - Performance optimizations
  - New dependencies that don't break compatibility

- **PATCH (0.0.X)**: Bug fixes and minor improvements
  - Bug fixes
  - Security patches
  - UI/UX improvements (non-breaking)
  - Dependency updates (patch versions)
  - Documentation updates

### Version Format Examples

| Version | Description | Example Changes |
|---------|-------------|-----------------|
| `1.0.0` | First stable release | Initial production deployment |
| `1.1.0` | New feature | New provisioning wizard UI |
| `1.1.1` | Bug fix | Fixed typo in error message |
| `2.0.0` | Breaking change | Database schema migration v1 → v2 |
| `2.1.0` | New feature | New monitoring dashboard |
| `2.1.5` | Bug fix | Fixed memory leak in stats service |

---

## 📝 When to Bump Versions

### MAJOR Version Bump Criteria

Trigger a MAJOR version bump when:

1. **Database Schema Changes**
   - Tables are added, modified, or dropped
   - Column types are changed
   - Indexes are added/removed affecting queries
   - Required migration scripts are needed

2. **API Contract Breaking Changes**
   - Endpoint paths are changed
   - Request/response schemas are modified incompatibly
   - Authentication mechanisms are changed
   - Required parameters are added/removed

3. **Configuration Structure Changes**
   - Environment variable names are changed
   - Configuration file format is changed
   - Default values are changed in ways that affect behavior

4. **Service Removal or Major Refactoring**
   - Services are deprecated and removed
   - Major architectural changes

### MINOR Version Bump Criteria

Trigger a MINOR version bump when:

1. **New UI Features**
   - New pages or components added
   - New interaction patterns (wizard, modals, etc.)
   - New visual improvements (themes, layouts)

2. **New API Endpoints**
   - New endpoints added (without breaking existing ones)
   - New optional parameters added to existing endpoints

3. **New Service Functionality**
   - New features in existing services
   - New integrations with external systems
   - New monitoring or logging capabilities

4. **Performance Optimizations**
   - Caching improvements
   - Query optimizations
   - Resource usage improvements

5. **New Dependencies**
   - New libraries added (non-breaking)
   - Version upgrades (MINOR versions of dependencies)

### PATCH Version Bump Criteria

Trigger a PATCH version bump when:

1. **Bug Fixes**
   - Fix bugs in functionality
   - Fix edge cases
   - Fix error handling

2. **Security Patches**
   - Dependency security updates
   - Configuration security improvements

3. **UI/UX Improvements (Non-breaking)**
   - Color scheme changes
   - Typography adjustments
   - Spacing and layout tweaks
   - Icon changes

4. **Dependency Updates**
   - Patch version updates of dependencies
   - Minor dependency updates (if compatible)

5. **Documentation Updates**
   - README updates
   - API documentation improvements

---

## 🚨 CRÍTICO: Docker Compose Image Update Rule

**REGLA DE ORO: SIEMPRE reconstruir imágenes después de actualizar versiones**

```powershell
# ❌ INCORRECTO - NO reconstruye la imagen (usará caché antigua)
docker-compose up -d

# ✅ CORRECTO - RECONSTRUYE la imagen
docker-compose up -d --build provisioner-ui

# ✅ CORRECTO - SOLO provisioner-ui (evita errores de compilación de otros servicios)
docker-compose build --no-cache provisioner-ui
```

**POR QUÉ ES NECESARIO:**
- Docker usa imágenes en caché por defecto
- `docker-compose up -d` NO reconstruye automáticamente las imágenes
- El campo `image: nombre:version` en `docker-compose.yml` solo especifica la etiqueta
- **NO fuerza la reconstrucción** de la imagen Docker
- Si la imagen existe en caché local, Docker la reusará

---

### ⚠️ PROBLEMAS COMUNES Y SOLUCIONES

#### Problema 1: Build falla para servicios con errores de compilación
**Síntoma:** `docker-compose build` falla con errores de TypeScript/Go/Python
**Causa:** Hay errores de compilación en api-gateway, auth-service, etc.
**Solución:**
```powershell
# ✅ SOLO construir el servicio que necesitas
docker-compose build --no-cache provisioner-ui

# O usar el pipeline unificado:
.\pipeline.ps1 --build --force
```

#### Problema 2: `docker-compose up -d` NO reconstruye
**Síntoma:** La imagen vieja se sigue ejecutando a pesar de actualizar código
**Causa:** Docker reusa imágenes en caché automáticamente
**Solución:**
```powershell
# ✅ Siempre usar --build flag
docker-compose up -d --build provisioner-ui

# O usar pipeline:
.\pipeline.ps1 --build
```

---

### 📋 Workflow de Deployment Correcto

#### Paso 1: Actualizar Version
```powershell
# 1. package.json
"version": "0.1.1" → "0.1.2"

# 2. docker-compose.yml
image: antigravity/provisioner-ui:0.1.2
container_name: provisioner-ui-v0.1.2

# 3. Dockerfile (si aplica)
ARG VERSION=0.1.2
```

#### Paso 2: Reconstruir y Desplegar (CRÍTICO)
```powershell
# ✅ MÉTODO 1 (RECOMENDADO - Pipeline Unificado):
.\pipeline.ps1 --build --force

# ✅ MÉTODO 2 (Desde proyecto):
cd "C:\Users\Juan Pablo Madriaga\Documents\antigravity\projects\vcenter-provisioner\infra\local"
docker-compose build --no-cache provisioner-ui
docker-compose up -d --build provisioner-ui

# ❌ NUNCA:
docker-compose up -d (usará imagen en caché)
docker-compose up -d provisioner-ui (puede no reconstruir)
```

#### Paso 3: Verificar
```powershell
# Verificar versión desplegada
docker inspect antigravity/provisioner-ui:0.1.2 --format='{{.Config.Labels.version}}'

# Probar en navegador
http://localhost:5173
```

### ⚠️ CRITICAL: Docker Compose Image Update Rule

**REGLA DE ORO: SIEMPRE usar `--build` al actualizar versiones**

```powershell
# ❌ INCORRECTO - No reconstruye la imagen, usa caché
docker-compose up -d

# ✅ CORRECTO - Reconstruye la imagen con la nueva versión
docker-compose up -d --build

# ✅ CORRECTO - Reconstruye solo el servicio actualizado
docker-compose up -d --build provisioner-ui

# ✅ CORRECTO - Reconstruye sin caché (más lento pero garantiza reconstrucción)
docker-compose build --no-cache provisioner-ui
docker-compose up -d provisioner-ui
```

**POR QUÉ ES NECESARIO:**
- Docker usa imágenes en caché por defecto
- `docker-compose up -d` NO reconstruye automáticamente las imágenes
- El campo `image: nombre:version` solo especifica la etiqueta, NO fuerza la reconstrucción
- Si la imagen existe en caché, Docker la reusará aunque el código cambió

**COMO VERIFICAR LA VERSIÓN QUE SE ESTÁ EJECUTANDO:**
```powershell
# Ver labels de la imagen
docker inspect antigravity/provisioner-ui:0.1.1 --format='{{.Config.Labels.version}}'

# Ver imagen que usa el contenedor
docker inspect provisioner-ui-v0.1.1 --format='{{.Config.Image}}'

# Ver versión del package.json dentro del contenedor
docker exec provisioner-ui-v0.1.1 cat /usr/share/nginx/html/package.json | grep version
```

---

### Step 1: Determine Version Type

### Step 1: Determine Version Type

Before making changes, determine if the changes require a MAJOR, MINOR, or PATCH version bump.

**Questions to ask:**
- Does this break existing functionality? → MAJOR
- Does this add new features? → MINOR
- Does this fix bugs or improve UI? → PATCH

### Step 2: Update Package Versions

For each service that changed, update the `version` field in `package.json`:

```json
{
  "name": "provisioner-ui",
  "version": "0.1.0"
}
```

**Example: Modern UI Redesign**
- Changes: New UI components, Framer Motion animations, improved UX
- Type: **MINOR** (new features, backward compatible)
- Version change: `0.0.0` → `0.1.0`

### Step 3: Update Docker Labels

Add version labels to the Dockerfile:

```dockerfile
# Version label
ARG VERSION=0.1.0
LABEL version=${VERSION}
LABEL description="vCenter Provisioner UI - Modern UI"
LABEL org.antigravity.project="vcenter-provisioner"
LABEL org.antigravity.service="provisioner-ui"
```

### Step 4: Update Docker Compose

Update `docker-compose.yml` with the new version:

**Before:**
```yaml
provisioner-ui:
  build: ../../apps/provisioner-ui
  container_name: provisioner-ui
```

**After (Option 1 - Build with args):**
```yaml
provisioner-ui:
  build:
    context: ../../apps/provisioner-ui
    args:
      VERSION: 0.1.0
  image: antigravity/provisioner-ui:0.1.0
  container_name: provisioner-ui-v0.1.0
```

**After (Option 2 - Pre-built images - Recommended for Production):**
```yaml
provisioner-ui:
  image: ghcr.io/antigravity/provisioner-ui:0.1.0
  container_name: provisioner-ui-v0.1.0
```

### Step 5: Update Documentation

Update the following documents with the new version:

1. **README.md**: Update version in header
2. **QUICKSTART.md**: Update quick start instructions
3. **CHANGELOG.md**: Add entry for the new version
4. **docker-compose.yml**: Add comments with version info

### Step 6: Build and Test

Build and test new images:

```powershell
# Build specific service (forces rebuild)
docker-compose build --no-cache provisioner-ui

# Or build all services
docker-compose build --no-cache

# Run tests
npm run test

# Test application locally (IMPORTANT: always use --build after version update)
docker-compose up -d --build provisioner-ui
```

**⚠️ NOTA CRÍTICA:**
- **SIEMPRE** usa `--build` después de actualizar versiones
- **NUNCA** uses `docker-compose up -d` solo (sin --build) después de version updates
- Esto asegura que la imagen se reconstruya con la nueva versión

### Step 7: Tag and Push (if using registry)

If using a container registry (GitHub Container Registry, Docker Hub, etc.):

```powershell
# Tag image
docker tag provisioner-ui:latest ghcr.io/antigravity/provisioner-ui:0.1.0

# Push to registry
docker push ghcr.io/antigravity/provisioner-ui:0.1.0

# Also push as latest
docker tag ghcr.io/antigravity/provisioner-ui:0.1.0 ghcr.io/antigravity/provisioner-ui:latest
docker push ghcr.io/antigravity/provisioner-ui:latest
```

---

## 🏷️ Docker Image Naming Conventions

### Image Format

`[REGISTRY]/[ORGANIZATION]/[SERVICE]:[VERSION]`

### Examples

| Environment | Image Tag | Description |
|-------------|------------|-------------|
| Development | `antigravity/provisioner-ui:0.1.0-dev` | Development build |
| Staging | `ghcr.io/antigravity/provisioner-ui:0.1.0-staging` | Staging environment |
| Production | `ghcr.io/antigravity/provisioner-ui:0.1.0` | Production release |
| Latest | `ghcr.io/antigravity/provisioner-ui:latest` | Always points to latest stable |

### Container Naming

Container names should include the version:

```yaml
container_name: provisioner-ui-v0.1.0
```

This allows running multiple versions simultaneously for testing.

---

## 🔄 Docker Compose Updates

### Updating from Build to Image Tags

**Development (using build):**
```yaml
provisioner-ui:
  build:
    context: ../../apps/provisioner-ui
    args:
      VERSION: 0.1.0
  container_name: provisioner-ui-dev
```

**Production (using pre-built images):**
```yaml
provisioner-ui:
  image: ghcr.io/antigravity/provisioner-ui:0.1.0
  container_name: provisioner-ui-v0.1.0
  restart: always
```

### Multi-Environment Docker Compose

Use separate docker-compose files for environments:

- `docker-compose.yml`: Local development
- `docker-compose.staging.yml`: Staging environment
- `docker-compose.production.yml`: Production environment

**Example staging:**
```yaml
version: '3.8'

services:
  provisioner-ui:
    image: ghcr.io/antigravity/provisioner-ui:0.1.0-staging
    environment:
      - VITE_API_URL=https://staging-api.antigravity.local
```

**Example production:**
```yaml
version: '3.8'

services:
  provisioner-ui:
    image: ghcr.io/antigravity/provisioner-ui:0.1.0
    environment:
      - VITE_API_URL=https://api.antigravity.local
    restart: always
```

---

## 🚀 Migration from Old Versions

### Minor and Patch Upgrades

For MINOR and PATCH upgrades, the upgrade process is simple:

1. Update docker-compose.yml with new image tags
2. Stop containers: `docker-compose down`
3. Pull new images: `docker-compose pull`
4. Start containers: `docker-compose up -d`

### Major Upgrades

For MAJOR upgrades, additional steps may be required:

1. **Review Migration Guide**
   - Check CHANGELOG.md for breaking changes
   - Review migration requirements

2. **Backup Data**
   ```powershell
   # Backup PostgreSQL database
   docker exec vcenter-provisioner-db pg_dump -U antigravity vcenter_provisioner > backup.sql
   ```

3. **Run Migration Scripts**
   ```bash
   # Run database migrations (node-pg-migrate)
   ./pipeline.sh --migrate
   ```

4. **Update Configuration**
   - Update environment variables as needed
   - Update configuration files

5. **Deploy New Version**
   ```powershell
   docker-compose down
   docker-compose pull
   docker-compose up -d
   ```

6. **Validate**
   - Run health checks
   - Run integration tests
   - Verify all functionality

---

## 🧪 Testing and Validation

### Pre-Deployment Checklist

Before deploying a new Docker image version:

- [ ] Version number updated in package.json
- [ ] Dockerfile version labels added
- [ ] docker-compose.yml updated
- [ ] All tests passing (unit, integration, E2E)
- [ ] Documentation updated (README, CHANGELOG)
- [ ] Migration scripts created (if MAJOR)
- [ ] Rollback plan documented
- [ ] Staging environment tested

### Health Checks

Ensure health checks are defined for all services:

```yaml
healthcheck:
  test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost/health || exit 1"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 40s
```

### Smoke Tests

Run smoke tests after deployment:

```powershell
# Test UI is accessible
curl http://localhost:5173

# Test API Gateway
curl http://localhost:3000/health

# Test Auth Service
curl http://localhost:3001/health
```

---

## ✅ Best Practices Checklist

### Before Bumping Version

- [ ] Determine correct version type (MAJOR, MINOR, PATCH)
- [ ] Review impact on other services
- [ ] Check for breaking changes
- [ ] Update CHANGELOG.md with changes

### During Build Process

- [ ] Update version in package.json
- [ ] Add version labels to Dockerfile
- [ ] Test build locally
- [ ] Run all tests

### Before Deployment

- [ ] Update docker-compose.yml
- [ ] Update documentation
- [ ] Tag images correctly
- [ ] Test in staging environment
- [ ] Prepare rollback plan

### After Deployment

- [ ] Verify health checks
- [ ] Run smoke tests
- [ ] Monitor logs
- [ ] Document any issues
- [ ] Update deployment documentation

---

## 📊 Version History

| Version | Date | Type | Changes | Migration Required |
|---------|------|------|---------|-------------------|
| 0.1.0 | 2026-02-01 | MINOR | Modern UI redesign with Framer Motion, Vertical Stepper, Speed Dial | No |
| 0.0.0 | 2026-01-31 | INITIAL | Initial MVP release | N/A |

---

## 🔗 Related Documentation

- [QUICKSTART.md](../QUICKSTART.md) - Quick start guide
- [DOCKER-LESSONS-LEARNED.md](./DOCKER-LESSONS-LEARNED.md) - Docker best practices
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture reference
- [CHANGELOG.md](../CHANGELOG.md) - Changelog

---

## 🎓 Additional Resources

- [Semantic Versioning](https://semver.org/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Docker Compose File Reference](https://docs.docker.com/compose/compose-file/)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)

---

**Version:** 1.0.0
**Last Updated:** 2026-02-01
**Maintainer:** Antigravity Staff Engineering

---

© 2026 Antigravity Engineering | Docker Image Versioning Best Practices
