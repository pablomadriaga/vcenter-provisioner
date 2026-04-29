# Kubernetes Migration Plan (Alineado a 12-Factor)
> Estados: [PENDING], [IN PROGRESS], [COMPLETED], [BLOCKED]

---

## Pre-Migración
### 1. Commit de estado actual [COMPLETED]
- Snapshot de todo el proyecto antes de iniciar migración
- Commit: `chore: snapshot current state before k8s migration`

### 2. Creación de branch `k8s` [COMPLETED]
- Branch aislado para todo el trabajo de migración
- Comando: `git checkout -b k8s`

---

## Fase 1: Remediación de Gaps 12-Factor
### 3. Factor III (Config): Eliminar secrets hardcodeados [COMPLETED]
- Auditar `docker-compose.yml` y archivos `.env` por credenciales en texto plano
- Mover todos los valores sensibles a variables de entorno/Secrets de K8s
- Crear `.env.example` sin valores reales
- Servicios a ajustar: `auth-service`, `typing-service`, `vcenter-operations`, `credential-manager`, `monitoring-service`, Postgres, Redis

### 4. Factor VI (Procesos): Garantizar stateless [COMPLETED]
- Eliminar volumen local `./mocks` de `vcenter-operations`: incrustar mocks en imagen de contenedor o usar ConfigMap
- Verificar que ningún servicio almacene estado en memoria/archivos locales (sesiones en Redis)
- Actualizar `vcenter-operations/Dockerfile` para incluir mocks si es necesario

### 5. Factor V (Build/Release/Run): Configurar registro de contenedores [PENDING]
- Elegir registro (Docker Hub, ECR, GCR)
- Actualizar `pipeline.sh` para pushear imágenes con tags semánticos: `antigravity/<servicio>:vX.Y.Z`
- Probar push/pull de imágenes al registro

### 6. Factor IX (Desechabilidad): Verificar graceful shutdown [PENDING]
- Confirmar que todos los servicios manejen `SIGTERM` correctamente
- Agregar handlers de cierre graceful si faltan (Node.js, Python, Go)
- Probar con `docker stop` para confirmar que no se caen requests

---

## Fase 2: Diseño de Recursos Kubernetes
### 7. Namespace [COMPLETED]
- Crear namespace `vcenter-provisioner`
- Manifest: `k8s/base/namespace.yaml`

### 8. Secrets [COMPLETED]
- Lista de secrets requeridos (`vcenter-provisioner-secrets`):
  - `POSTGRES_USER`
  - `POSTGRES_PASSWORD`
  - `INTERNAL_API_TOKEN`
- Usar `kubectl create secret` o Sealed Secrets (para GitOps)
- No commitear valores reales a git

### 9. ConfigMaps [COMPLETED]
- ConfigMap global `vcenter-provisioner-config` (valores no sensibles):
  - `PORT` por servicio
  - URLs de servicios (`AUTH_SERVICE_URL`, `TYPING_SERVICE_URL`)
  - Intervalos de probes (`PROBE_INTERVAL`)
- Manifests: `k8s/base/configmaps/`

### 10. PersistentVolumeClaims (PVCs) [COMPLETED]
| Recurso | Tamaño | Modo Acceso | StorageClass |
|---------|--------|-------------|--------------|
| Postgres | 10Gi | ReadWriteOnce | default |
| Redis | 2Gi | ReadWriteOnce | default |
- Manifests: `k8s/base/pvcs/`

### 11. Réplicas y Resource Requests/Limits [COMPLETED]
| Servicio | Réplicas | CPU Request | CPU Limit | Memory Request | Memory Limit |
|---------|----------|-------------|-----------|----------------|--------------|
| postgres (StatefulSet) | 1 | 500m | 1 | 512Mi | 1Gi |
| redis (StatefulSet) | 1 | 100m | 500m | 128Mi | 512Mi |
| auth-service | 2 | 100m | 300m | 128Mi | 256Mi |
| typing-service | 2 | 100m | 300m | 128Mi | 256Mi |
| credential-manager | 2 | 100m | 300m | 128Mi | 256Mi |
| vcenter-operations | 2 | 100m | 300m | 128Mi | 256Mi |
| vm-orchestrator | 2 | 100m | 300m | 128Mi | 256Mi |
| stats-service | 2 | 100m | 300m | 128Mi | 256Mi |
| monitoring-service | 2 | 100m | 300m | 128Mi | 256Mi |
| api-gateway | 2 | 100m | 300m | 128Mi | 256Mi |
| provisioner-ui | 2 | 50m | 200m | 64Mi | 128Mi |
| backup-service | 1 | 50m | 200m | 64Mi | 128Mi |

### 12. Probes (Liveness/Readiness) [COMPLETED]
- Alineados a healthchecks de docker-compose existentes:
  - Path: `/health`
  - Port: Puerto del servicio
  - Initial delay: 5s
  - Period: 10s
  - Timeout: 5s
  - Failure threshold: 3
- Ejemplo para `api-gateway`:
  ```yaml
  livenessProbe:
    httpGet:
      path: /health
      port: 3000
    initialDelaySeconds: 5
    periodSeconds: 10
    timeoutSeconds: 5
    failureThreshold: 3
  readinessProbe:
    httpGet:
      path: /health
      port: 3000
    initialDelaySeconds: 3
    periodSeconds: 5
    timeoutSeconds: 3
    failureThreshold: 2
  ```
- Aplica a todos los microservicios, Postgres y Redis

---

## Fase 3: Manifiestos Kubernetes
### 13. Backing Services (StatefulSets) [COMPLETED]
- Postgres 15: StatefulSet, PVC, Service (ClusterIP)
- Redis 7: StatefulSet, PVC, Service (ClusterIP)
- Usar Helm charts oficiales (Bitnami) o manifiestos custom
- Manifests: `k8s/base/backing-services/`

### 14. Core Microservicios (Deployments) [COMPLETED]
- Actualizar `apps/*/k8s/deployment.yaml` existentes para incluir:
  - Imagen de registro (no local)
  - Referencias a ConfigMap/Secret
  - Requests/limits
  - Probes
  - Réplicas
- Orden de despliegue (por dependencias):
  1. auth-service
  2. typing-service
  3. credential-manager
  4. vcenter-operations
  5. vm-orchestrator
  6. stats-service
  7. monitoring-service
  8. api-gateway
  9. provisioner-ui
  10. backup-service

### 15. Services (ClusterIP) [COMPLETED]
- Crear Services ClusterIP para todos los deployments
- Actualizar `apps/*/k8s/service.yaml` existentes
- Manifests: `k8s/base/services/`

### 16. Ingress [COMPLETED]
- Instalar Nginx Ingress Controller
- Regla de Ingress:
  - `/*` → `provisioner-ui:80`
  - `/api/*` → `api-gateway:3000`
- Manifests: `k8s/base/ingress/`

### 17. Cert-Manager [COMPLETED]
- Instalar cert-manager via Helm
- Crear ClusterIssuer para Let's Encrypt (staging/prod)
- Actualizar Ingress para usar TLS con anotaciones de cert-manager
- Timing: Después de Ingress funcional, antes de despliegue a producción

### 18. HPA (Autoescalado) [COMPLETED]
- Instalar metrics-server
- Crear HPA para servicios sin estado (api-gateway, auth-service, etc.)
- Ejemplo: HPA para api-gateway (target CPU 70%)
- Manifests: `k8s/base/hpa/`

### 19. Job de Migraciones (Factor XII) [COMPLETED]
- Convertir servicio `migrations` de docker-compose a K8s Job
- Idempotente, `restartPolicy: OnFailure`
- Manifest: `k8s/base/jobs/migrations.yaml`

---

## Fase 4: Paridad Dev/Prod (Factor X)
### 20. Kustomize Overlays [COMPLETED]
```
k8s/
├── base/          # Manifiestos comunes
├── overlays/
    ├── dev/       # Dev (1 réplica, sin TLS)
    ├── staging/   # Staging (réplicas medias, test data)
    └── prod/      # Prod (HPA, TLS, réplicas altas)
```

---

## Fase 5: CI/CD
### 21. Actualizar pipeline.sh para K8s [PENDING]
- Agregar comandos:
  - `./pipeline.sh --k8s-deploy` (despliegue a dev)
  - `./pipeline.sh --k8s-prod` (despliegue a prod)
- Pasos: push de imágenes, apply de manifiestos, verificación

### 22. Testing en K8s [PENDING]
- Ejecutar tests híbridos en entorno dev de K8s
- Verificar salud de todos los servicios
- Probar failover, escalado, graceful shutdown

---

## Fase 6: Producción
### 23. Despliegue a Producción [PENDING]
- Aplicar overlay de prod: `kubectl apply -k k8s/overlays/prod`
- Verificar pods: `kubectl get pods -n vcenter-provisioner`
- Probar acceso externo vía Ingress
- Monitorear con monitoring-service

### 24. Limpieza de Docker Compose [PENDING]
- Deprecar `docker-compose.yml` después de validar K8s
- Actualizar documentación a K8s

---

## Leyenda de Estados
- [PENDING]: No iniciado
- [IN PROGRESS]: En progreso
- [COMPLETED]: Completado
- [BLOCKED]: Bloqueado por dependencia
