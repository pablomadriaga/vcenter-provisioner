# Monitoring Sentinel (Observability Hub) 👁️

Este microservicio actúa como el guardián de la salud sistémica, proporcionando visibilidad "Staff Grade" sobre el estado de cada componente.

## 📋 Responsabilidades
- **Health Aggregation**: Realiza chequeos profundos (Deep Health Checks) de todos los servicios descendientes.
- **Metrics Exposure**: Expone métricas en formato Prometheus/OpenMetrics para ser consumidas por Grafana.
- **Alerting Ready**: Diseñado para integrarse con AlertManager para notificaciones críticas.

## ⚙️ Especificaciones Técnicas
- **Runtime**: Go 1.22 (Gin)
- **Scraping**: Provee un endpoint `/metrics` con telemetría de ejemplo.
- **Stability**: Es el servicio con menor número de dependencias para asegurar operación incluso en condiciones de fallo parcial.

## 🧪 Testing

### Test Coverage: 76.0% (Statements) ✅

```bash
# Ejecutar todos los tests
go test ./... -v

# Ejecutar con coverage
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

### Test Suites

#### Server Setup Tests (3 tests)
- `TestGetPort_FromEnvVariable`: Verifica obtención de puerto desde variable de entorno
- `TestGetPort_DefaultValue`: Verifica puerto por defecto (8082)
- `TestStartServer_Success`: Verifica inicialización del servidor

#### Signal Handling Tests (3 tests)
- `TestSetupSignals_CreatesChannel`: Verifica creación del channel de señales
- `TestSetupSignals_NotifiesSIGINT`: Verifica manejo de señal SIGINT
- `TestSetupSignals_NotifiesSIGTERM`: Verifica manejo de señal SIGTERM

#### Concurrency Tests (1 test)
- `TestStartServer_ConcurrentRequests`: Verifica requests concurrentes

#### Integration Tests (2 tests)
- `TestMain_FullFlow`: Verifica flujo completo de main()
- `TestMain_GracefulExit`: Verifica cierre graceful con señal

#### Endpoint Tests (3 tests)
- `TestHealthEndpoint_ResponseStructure`: Verifica estructura de respuesta de /health
- `TestMetricsEndpoint_Format`: Verifica formato Prometheus de /metrics
- `TestRootEndpoint_ResponseStructure`: Verifica estructura de respuesta de /

## 🧪 Estrategia de Verificación
- **Liveness/Readiness**: Sirve como el benchmark de salud para todo el ecosistema Docker Compose/K8s.
- **Formatting**: Mantiene estricto cumplimiento con el protocolo OpenMetrics.

## 📦 N/A
Este servicio es un microservicio Go puro, sin dependencias de NPM.

## 🌐 Endpoints
- `GET /health` - Health check con estado de todos los servicios
- `GET /metrics` - Métricas en formato Prometheus/OpenMetrics
- `GET /` - Información del servicio

## 🚀 Variables de Entorno
```bash
PORT=8082
```

---
© 2026 Antigravity Engineering | Observability Layer
