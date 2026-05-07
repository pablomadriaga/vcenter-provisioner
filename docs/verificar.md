# Networking App: Docker → Kubernetes
*Versión hiper-concisa, enfoque en topología K8s, API Gateway y observabilidad con Coroot*

---

## Contexto
Migración de entorno de desarrollo local (Docker) a cluster Kubernetes `vcenter-provisioner-dev`. Este documento contrasta explícitamente ambas topologías y detalla el funcionamiento interno del API Gateway y uso de Coroot para métricas de red.

---

## 1. Networking Origen (Docker Local)
Red dedicada `vcenter-provisioner`, servicios exponen puertos directamente al host:
| Servicio | Puerto Interno | Puerto Host | Nota |
|----------|---------------|-------------|------|
| API Gateway | 3000 | 3000 | Punto de entrada único |
| Auth Service | 3001 | 3001 | Validación JWT |
| Monitoring | 8083 | 8083 | Health checks/Prometheus |
| Provisioner UI | 5173 | 5173 | Vite dev server |
| Credential Manager | 8090 | 8090 | Gestión de conexiones |

Flujo básico: `Usuario → UI:5173 → API Gateway:3000 → Servicios Backend`

---

## 2. Networking Destino (Kubernetes)
Cluster `vcenter-provisioner-dev`, servicios tipo ClusterIP (no expuestos al host), ingress vía Contour HTTPProxy.
### 2.1 Cambios Clave vs Docker
| Servicio | Puerto Docker | Puerto K8s | Nota |
|----------|---------------|------------|------|
| Monitoring | 8083 | 8082 | Alineado a MONITORING-DESIGN.md |
| Provisioner UI | 5173 | 80 | Nginx en K8s vs Vite local |

### 2.2 Services Core (kubectl get svc)
| Servicio | Cluster-IP | Puerto |
|----------|------------|--------|
| api-gateway | 192.101.6.61 | 3000/TCP |
| auth-service | 192.101.49.107 | 3001/TCP |
| monitoring-service | 192.101.41.61 | 8082/TCP |
| provisioner-ui | 192.101.123.159 | 80/TCP |

### 2.3 Acceso Externo (Contour HTTPProxy)
- FQDN: `vc-ui.playground.net`
- TLS: `vc-ui-tls` (cert-manager, vcenter-ca-issuer)
- VIP: `10.12.4.169`
- Rutas:
  | Prefijo | Backend | Puerto | Nota |
  |---------|---------|--------|------|
  | `/auth` | api-gateway | 3000 | Autenticación |
  | `/api` | api-gateway | 3000 | Rewrite `/api` → `/` |
  | `/` | provisioner-ui | 80 | Frontend estático |

---

## 3. API Gateway Internals
Fastify + `@fastify/http-proxy`, único punto de entrada para tráfico externo.
### 3.1 Configuración de Proxy
```typescript
server.register(proxy, {
  upstream: AUTH_SERVICE_URL, // http://auth-service:3001
  prefix: '/auth',
  rewritePrefix: '/', // Elimina prefijo /auth del request
  config: { proxyTimeout: 30000 }
});
```
### 3.2 Cadena de Request Ejemplo (`/auth/login`)
`Navegador → Contour (vc-ui.playground.net/auth/login) → API Gateway:3000 (strip /auth) → auth-service:3001 POST /login`

---

## 4. Coroot: Observabilidad de Red
Acceso a métricas de disponibilidad, latencia y tráfico vía API Prometheus-compatible.
### 4.1 Acceso
- UI: https://coroot.playground.net
- API: https://coroot.playground.net/api/v1/query
- API Key: `QL3EVln8MWmo3IvhOUsE9NGSP7e30VR5` (rotar periódicamente)

### 4.2 Queries de Red Útiles
```bash
# Disponibilidad de servicios (up=1 = healthy)
curl -sk -H "X-API-Key: <API_KEY>" "https://coroot.playground.net/api/v1/query?query=up"

# Latencia de api-gateway
curl -sk -H "X-API-Key: <API_KEY>" "https://coroot.playground.net/api/v1/query?query=http_request_duration_seconds_sum{service=\"api-gateway\"}"

# Requests totales por servicio
curl -sk -H "X-API-Key: <API_KEY>" "https://coroot.playground.net/api/v1/query?query=http_requests_total"
```

---

*Documento actualizado con topología K8s real, sin contenido de errores. Basado en kubectl, configuración Contour y API de Coroot.*
