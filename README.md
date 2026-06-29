# vCenter VM Provisioner: Central Documentation Hub 🗺️

Bienvenido al centro de documentación técnica del **vCenter VM Provisioner**. Este ecosistema está diseñado bajo estándares Staff-Grade para el control total de infraestructura virtualizada.

**🚀 CI/CD Local Disponible:** Pipeline completo con un solo comando. Ver [CI-CD-LOCAL](#-cicd-local) abajo.

---

## 🚀 CI/CD Local: Comenzar en 5 Minutos

> **Pragmatismo Staff-Grade | Onboarding sin fricción**

Este proyecto incluye un **pipeline CI/CD local** diseñado para equipos con alta rotación donde el tiempo de onboarding debe ser mínimo, sin sacrificar calidad.

> **⚠️ NOTA:** `start.ps1` está deprecado. Usa `pipeline.ps1` para todas las operaciones.

### Comandos Esenciales (Post-Clonación)

```powershell
# 1. Clonar y entrar al proyecto
git clone <repo-url>
cd vcenter-provisioner

# 2. CI completo (lint + test + build)
.\pipeline.ps1

# 3. Levantar servicios (unificado en pipeline.ps1)
.\pipeline.ps1 --up

# 4. Verificar funcionamiento
curl http://localhost:3000/health

# 5. Listo: http://localhost:5173
```

**Tiempo total estimado: 5-10 minutos desde clonación hasta sistema funcionando.**

### Comandos Adicionales

```powershell
# Ver estado de servicios
.\pipeline.ps1 --status

# Bajar servicios
.\pipeline.ps1 --down

# Forzar rebuild (skip cache)
.\pipeline.ps1 --build --force

# Tests en Docker (determinismo)
.\pipeline.ps1 --docker
```

### ¿Por qué CI/CD Local?

- ✅ **Sin Kubernetes** (kind, minikube, k3d)
- ✅ **Sin registries remotos** (DockerHub, ECR, GCR)
- ✅ **Sin herramientas adicionales** (sin abstracción innecesaria)
- ✅ **Docker-first**: Pipeline determinista en contenedores
- ✅ **Tests híbridos**: Host para velocidad, Docker para determinismo
- ✅ **Imágenes con tags hash**: `servicio:<hash>` (sin dependencias externas)

### Documentación CI/CD

- **[docs/CI-CD-LOCAL.md](./docs/CI-CD-LOCAL.md)** - Guía completa del pipeline CI/CD local
- **[QUICKSTART.md](./QUICKSTART.md)** - Primeros pasos rápidos

---

## 📦 Current Version

**Version:** 0.2.0
**Release Date:** 2026-02-06
**Status:** ✅ Stable

**Latest Changes:** Sistema de monitoreo nativo con probes distribuidos. Ver [CHANGELOG.md](./CHANGELOG.md) para cambios detallados.

### 🚨 CRÍTICO: Actualizaciones de Versión - SOLUCIÓN DEFINITIVA

**¿Sientes que a pesar de actualizar la versión en `package.json` y `docker-compose.yml`, los cambios NO se aplican?**

**Causa Raíz:**
```powershell
# ❌ ESTE COMANDO NO RECONSTRUYE LA IMAGEN
docker-compose up -d

# Docker usa el caché de imágenes y NO reconstruye
# El contenedor sigue ejecutándose la VERSIÓN ANTIGUA
```

**Solución DEFINITIVA:**

**OPCIÓN 1: Pipeline con force rebuild (RECOMENDADO)**
```powershell
# ✅ Un solo comando
.\pipeline.ps1 --build --force
.\pipeline.ps1 --up
```

**OPCIÓN 2: docker-compose con --no-cache**
```powershell
# Desde el directorio del proyecto
cd infra/local

# SIEMPRE usar --build y --no-cache (CRÍTICO)
docker-compose up -d --build --no-cache
```

**OPCIÓN 3: Proceso manual completo**
```powershell
# 1. Detener contenedor viejo
docker-compose stop provisioner-ui
docker-compose rm provisioner-ui

# 2. Eliminar imagen vieja (opcional pero recomendado)
docker rmi antigravity/provisioner-ui:versión-vieja

# 3. Reconstruir imagen (SIN caché para garantir cambios)
docker-compose build --no-cache provisioner-ui

# 4. Levantar nuevo contenedor
docker-compose up -d --build provisioner-ui
```

---

**Proceso de Verificación:**
```powershell
# 1. Verificar versión de la imagen
docker inspect antigravity/provisioner-ui:versión-desplegada --format='{{.Config.Labels.version}}'

# 2. Verificar versión desplegada en contenedor
docker inspect provisioner-ui-v0.1.2 --format='{{.Config.Image}}'

# 3. Verificar versión en package.json
cat apps/provisioner-ui/package.json | grep version
```

---

### ❌ NUNCA HAGAS ESTO DESPUÉS DE ACTUALIZAR VERSIÓN

```powershell
# ❌ INCORRECTO - NO reconstruye la imagen
docker-compose up -d

# ❌ INCORRECTO - Puede usar caché
docker-compose up -d --build

# ❌ INCORRECTO - No elimina imagen vieja
docker-compose stop provisioner-ui
docker-compose rm provisioner-ui
docker-compose up -d
```

---

### 📚 Referencias de Aprendizaje

**Documentos clave:**
- **[CHANGELOG.md](./CHANGELOG.md)** - Historial de versiones con guías de migración
- **[docs/CI-CD-LOCAL.md](./docs/CI-CD-LOCAL.md)** - Documentación del pipeline unificado
- **[docs/dos-and-donts-playbook.md](./docs/dos-and-donts-playbook.md)** - Guía de comandos
- **[QUICKSTART.md](./QUICKSTART.md)** - Guía rápida actualizada

**Skills a consultar:**
- **creador-de-habilidades**: Para entender templates y patrones
- **documentation-quality-engineer**: Para documentación estructurada
- **qa-testing-engineer**: Para validar despliegues

---

## 🏗 Arquitectura de 9 Servicios Especializados

| Servicio | Lenguaje | Responsabilidad Principal | Puerto |
| :--- | :--- | :--- | :--- |
| **API Gateway** | Node/Fastify | Punto de entrada, Proxy y verificación de JWT | 3000 |
| **Auth Service** | Node/Fastify | Gestión de identidad y persistencia de usuarios | 3001 |
| **Typing Service** | Python/FastAPI | Motor TP-Haki (Lógica de nomenclatura dinámica) | 8000 |
| **VM Orchestrator** | Go/Gin | Máquina de estados y ejecución asíncrona | 8080 |
| **vCenter Adapter** | Go/Gin | Interacción con la API de vSphere (MOCKED) | 8081 |
| **Stats Service** | Python/FastAPI | Métricas de negocio (VMs aprovisionadas, éxito/fallo, latency) | 8001 |
| **Monitoring** | Go/Gin | Salud de componentes (conectividad, CPU, memoria, probes) | 8082 |
| **Backup Service** | Python | Gestión de políticas de respaldo post-creación | 8002 |
| **Provisioner UI** | React/Vite | Interfaz Staff Grade con Wizard interactivo | 5173 |

---

## 🔍 Observabilidad: Dos Perspectivas Complementarias

El sistema implementa **dos servicios especializados en métricas** con responsabilidades claramente diferenciadas:

### 📊 Stats Service - Métricas de Negocio
> *"¿Qué está haciendo la aplicación?"*

| Métrica | Descripción |
|---------|-------------|
| **Total de VMs aprovisionadas** | Contador acumulado de VMs creadas |
| **Tasa de éxito/fallo** | Porcentaje de operaciones exitosas |
| **Latencia de operaciones** | Tiempo promedio de aprovisionamiento |
| **KPI de negocio** | Dashboard para admins con métricas operacionales |

**Propósito**: Alimentar decisiones de negocio, reportes ejecutivos y optimización de procesos.

### 👁️ Monitoring Service - Salud de Infraestructura
> *"¿Cómo están los componentes del sistema?"*

| Métrica | Descripción |
|---------|-------------|
| **Conectividad entre servicios** | ¿Quién puede comunicarse con quién? |
| **Health checks** | Deep health checks de cada servicio |
| **Prometheus/OpenMetrics** | Formato estándar para Grafana |
| **Probes distribuidos** | Monitoreo activo desde cada servicio |

**Propósito**: Operacional, asegura la disponibilidad y permite diagnosticar problemas de infraestructura.

---

## 📡 Sistema de Monitoreo Nativo

El sistema incluye **observabilidad nativa** con probes distribuidos entre servicios.

### Arquitectura de Monitoreo

```
┌─────────────────────────────────────────────────────────────────┐
│                    SISTEMA DE MONITOREO                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐     ┌─────────────────────────────┐   │
│  │ probe-scheduler.sh   │     │   monitoring-service        │   │
│  │ (en cada servicio)   │────▶│   (Puerto 8082)            │   │
│  │                     │     │   - Redis (cache TTL 60s)   │   │
│  │ • Modo full/sample  │     │   - PostgreSQL (histórico) │   │
│  │ • Intervalo configurable│   │   - API REST               │   │
│  │ • Envía a monitoring │     └─────────────────────────────┘   │
│  └─────────────────────┘                   │                    │
│                                          ▼                    │
│                              ┌─────────────────────────────┐   │
│                              │   Provisioner UI            │   │
│                              │   /monitor (5173)           │   │
│                              │   • Diagrama de servicios  │   │
│                              │   • Cards de estado        │   │
│                              │   • Polling cada 60s       │   │
│                              └─────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Configuración de Probes por Servicio

| Servicio | Intervalo | Modo | Targets |
|----------|-----------|------|---------|
| **api-gateway** | 5s | full | auth-service, typing-service, vm-orchestrator, vcenter-operations, stats-service, backup-service, monitoring-service |
| **auth-service** | 5s | full | api-gateway, typing-service, vm-orchestrator, vcenter-operations, stats-service, backup-service, monitoring-service |
| **vm-orchestrator** | 5s | full | typing-service, vcenter-operations, stats-service, monitoring-service |
| **typing-service** | 20s | sample (3) | api-gateway, vm-orchestrator, monitoring-service |
| **vcenter-operations** | 20s | sample (3) | vm-orchestrator, stats-service, monitoring-service |
| **stats-service** | 20s | sample (3) | api-gateway, vm-orchestrator, monitoring-service |
| **backup-service** | 20s | sample (3) | vm-orchestrator, monitoring-service |
| **provisioner-ui** | 20s | sample (3) | api-gateway, auth-service, monitoring-service |
| **monitoring-service** | 1s | full | api-gateway, auth-service, typing-service, vm-orchestrator, vcenter-operations, stats-service, backup-service, provisioner-ui |

### Variables de Entorno para Probes

```yaml
PROBE_INTERVAL=5        # Intervalo entre probes (segundos)
PROBE_MODE=full         # 'full' (todos) o 'sample' (aleatorios)
PROBE_SAMPLE_COUNT=3    # N servicios a probe en modo sample
PROBE_TARGETS=api-gateway,auth-service  # Targets específicos (opcional)
MONITORING_URL=http://monitoring-service:8082
```

### Acceso al Monitor

1. **UI de Monitoreo:** http://localhost:5173/monitor
2. **API de Estado:** http://localhost:8082/api/services-status
3. **API de Conectividad:** http://localhost:8082/api/connectivity-matrix

### Verificación del Sistema de Monitoreo

```powershell
# Ver procesos de probe en un servicio
docker exec provisioner-api-gateway ps aux

# Ver logs del probe scheduler
docker logs provisioner-api-gateway --tail=20

# Ver estado de servicios desde monitoring
curl http://localhost:8082/api/services-status
```

---

## 🗂️ Índice de Documentación Jerárquica

### 📖 Guías Rápidas
1.  **[QUICKSTART.md](./QUICKSTART.md)** - ⭐ COMENZAR AQUÍ ⭐
    - Cómo levantar el sistema con Docker en tu máquina (más importante)
    - URLs de acceso
    - Solución de problemas comunes con Docker en Windows
    - Scripts de testing automatizados

### 🚀 CI/CD & Desarrollo
2.  **[CI-CD-LOCAL](./docs/CI-CD-LOCAL.md)** - Pipeline CI/CD local completo
     - Onboarding en 5 minutos sin fricción
     - Script unificado `.\pipeline.ps1` para todas las operaciones
     - Tests híbridos: Host (velocidad) + Docker (determinismo)
     - Imágenes locales sin registries externos
     - **⚠️ NOTA:** `start.ps1` está deprecado

### 🧪 Testing & QA
4.  **[Test Report](./docs/test-report.md)** - Reporte completo de todas las pruebas
5.  **[Testing Plan](./docs/testing-plan.md)** - Estrategia de testing (Week 1-4)
6.  **[Integration Tests](./docs/integration-tests.md)** - Tests de integración (14 tests)
7.  **[E2E & Performance Tests](./docs/e2e-performance-tests.md)** - E2E (34 tests) + Performance (3 suites)
8.  **[Security & Accessibility Tests](./docs/security-accessibility-tests.md)** - Security (29 tests) + Accessibility (27 tests)
9.  **[Docker Troubleshooting](./docs/TROUBLESHOOTING-DOCKER.md)** - Solución de problemas con Docker en Windows

### 🏗 Arquitectura
10. **[Architecture Reference](./docs/ARCHITECTURE.md)** - Arquitectura completa: servicios, diagramas, flujos y contratos de infraestructura
11. **[Monitoring System](./docs/MONITORING-SYSTEM-DESIGN.md)** - Sistema de monitoreo nativo con probes distribuidos
12. **[Database Schema](./docs/db-schema.md)** - Esquema PostgreSQL
13. **[TYPIFICATIONS.md](./docs/TYPIFICATIONS.md)** - Documentación del motor TP-Haki
14. **[Docker Versioning Best Practices](./docs/DOCKER-VERSIONING-BEST-PRACTICES.md)** - Guía de versionamiento de imágenes Docker (Semantic Versioning)

### 🗄️ Base de Datos
14. **[Database Schema](./docs/db-schema.md)** - Esquema PostgreSQL

### 🎨 UX & Producto
15. **[UX Specification](./docs/ux-specification.md)** - Diseño visual, accesibilidad WCAG 2.1 AA
16. **[Business Discovery](./docs/business-discovery.md)** - Definiciones estratégicas y roadmap

### 🔐 Seguridad
17. **[Review Briefing](./docs/review-briefing.md)** - Estado actual y seguridad avanzada
18. **[Dos and Don'ts Playbook](./docs/dos-and-donts-playbook.md)** - Lecciones aprendidas

### 🔄 Retrospectiva
19. **[Retrospective AAR](./docs/retrospective-aar.md)** - Análisis de puntos de fricción y soluciones

---

## 📜 Glosario de Términos

- **Tipificación**: Máscara de nomenclatura segmentada que garantiza la unicidad y el orden organizacional.
- **VM Class**: Perfil de recursos predefinido (Small, Medium, Large) con reglas de afinidad.
- **Orchestrator Saga**: Flujo de transacciones distribuidas para garantizar la consistencia entre vCenter y la base de datos.
- **Target-Zero**: Estándar de Antigravity que busca cero configuración manual post-despliegue.

---

## 🛠️ Historial de Cambios (Changelog)

Para el historial completo de cambios con versiones semánticas (MAJOR.MINOR.PATCH), consulta el [CHANGELOG.md](./CHANGELOG.md).

### Resumen de Versiones Recientes

| Versión | Fecha | Tipo | Descripción |
|---------|-------|------|-------------|
| **0.1.2** | 2026-02-01 | PATCH | PERMANENT fix: TextField focus issue using React.memo component separation |
| **0.1.1** | 2026-02-01 | PATCH | Bug fixes: TextField focus, Slider drag, Auto-Sequential length control |
| **0.1.0** | 2026-02-01 | MINOR | Modern UI redesign: Framer Motion, Vertical Stepper, Speed Dial, improved UX |
| **0.0.0** | 2026-01-31 | INITIAL | MVP inicial de arquitectura de 9 servicios |

### Versiones Previas (Antes de SemVer)

- **v1.0 (2026-01)**: Lanzamiento inicial de la arquitectura de 9 servicios
- **v1.1 (2026-01)**: Unificación de documentación estratégica. Integración de patrones dirigidos por eventos (Kafka) y estándares de accesibilidad WCAG 2.1 AA.

---

## 🔗 Referencias Técnicas

- [VMware govmomi SDK](https://github.com/vmware/govmomi)
- [Prometheus Healthcheck Best Practices](https://prometheus.io/docs/guides/multi-target-exporter/)
- [WCAG 2.1 AA Standards](https://www.w3.org/WAI/standards-guidelines/wcag/)

---

## 🧪 Scripts de Pruebas Automatizadas

| Script | Descripción |
|--------|-------------|
| `.\pipeline.ps1 --lint` | Lint de todos los servicios |
| `.\pipeline.ps1 --test` | Tests unitarios de todos los servicios |
| `.\pipeline.ps1 --docker` | Tests en Docker (determinismo) |
| `.\pipeline.ps1 --all --docker` | Tests completos + cleanup |

### Ejecutar Pipeline de Tests

```powershell
# En el directorio raíz del proyecto:
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner"

# Solo lint (rápido)
.\pipeline.ps1 --lint

# Tests en host (rápido, puede fallar sin herramientas)
.\pipeline.ps1 --test

# Tests en Docker (determinismo, requiere servicios)
.\pipeline.ps1 --docker

# Pipeline completo
.\pipeline.ps1 --all --docker
```

### Gestión de Servicios para Tests

```powershell
# Levantar servicios para tests de integración
.\pipeline.ps1 --up

# Ver estado
.\pipeline.ps1 --status

# Bajar servicios después de tests
.\pipeline.ps1 --down
```

---

## 🚀 Comenzar Rápido

### 1. Levantar el sistema con Pipeline Unificado (⭐ IMPORTANTE)

```powershell
# Navegar al directorio del proyecto
cd "C:\Users\Juan Pablo Madriaga\Documents\projects\vcenter-provisioner"

# Build + Levantar servicios (unificado)
.\pipeline.ps1 --build --force  # Primera vez o después de cambios
.\pipeline.ps1 --up             # Levantar servicios
```

### 2. Verificar que los servicios están saludables

```powershell
# Verificar health checks
curl http://localhost:3000/health    # API Gateway
curl http://localhost:3001/health    # Auth Service
curl http://localhost:8000/health    # Typing Service
curl http://localhost:8080/health    # VM Orchestrator
```

### 3. Abrir la UI en el navegador

```
http://localhost:5173
```

### 4. Login con usuario de prueba

```
Usuario: admin
Contraseña: password123
```

### 5. Comandos de Gestión de Servicios

```powershell
# Ver estado
.\pipeline.ps1 --status

# Bajar servicios
.\pipeline.ps1 --down

# Rebuild completo
.\pipeline.ps1 --build --force
```

---

## 📊 Métricas del Proyecto

| Métrica | Valor | Estado |
|--------|-------|--------|
| Total de Servicios | 9 | ✅ |
| Total de Tests | 237 | ✅ |
| Coverage Promedio | 82.4% | ✅ (target: 70%) |
| Services con 70%+ Coverage | 7/7 | ✅ |
| Flujos de Integración Cubiertos | 100% | ✅ |
| Flujos de E2E Cubiertos | 100% | ✅ |
| WCAG 2.1 AA Compliance | 27 tests | ✅ |

---

## 🆘 Soporte y Documentación

### Documentación Técnica
- Para detalles de arquitectura, ver los documentos en `docs/`
- Para detalles de configuración, ver `QUICKSTART.md`
- Para problemas con Docker, ver `docs/TROUBLESHOOTING-DOCKER.md`

### Scripts de Testing
- Todos los scripts están en el directorio raíz
- Ver el Test Report para detalles de todas las pruebas ejecutadas

---

**Versión:** 2.0.0
**Estado:** ✅ Unificado (start.ps1 deprecado)
**Fecha:** 2026-02-07
**Autor:** vCenter Provisioner Team

---

© 2026 vCenter Provisioner Project
