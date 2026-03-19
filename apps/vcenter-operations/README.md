# vCenter Operations Service (Adapter Pattern) 🔌

Este microservicio actúa como un adaptador para abstraer la complejidad de la API SOAP/REST de vCenter (pyVmomi / vSphere API).

## 📋 Responsabilidades
- **Infrastructure Abstraction**: Provee una interfaz limpia para la creación de VMs, ocultando detalles específicos del hipervisor.
- **Task Simulation**: Simula colas de tareas y tiempos de respuesta realistas de vCenter para pruebas de carga y estrés del orquestador.
- **Protocol Translation**: Traduce peticiones REST internas a comandos nativos de infraestructura.
- **Inventory Management**: Lista VMs, datacenters, clusters y datastores.

## 🧪 Testing

### Test Coverage: 80.6% (Statements) ✅

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
- `TestGetPort_DefaultValue`: Verifica puerto por defecto (8091)
- `TestStartServer_Success`: Verifica inicialización del servidor

#### Signal Handling Tests (3 tests)
- `TestSetupSignals_CreatesChannel`: Verifica creación del channel de señales
- `TestSetupSignals_NotifiesSIGINT`: Verifica manejo de señal SIGINT
- `TestSetupSignals_NotifiesSIGTERM`: Verifica manejo de señal SIGTERM

#### Concurrency Tests (1 test)
- `TestStartServer_ConcurrentVMCreation`: Verifica creación de VMs concurrente (simula 5 requests simultáneos)

#### Integration Tests (2 tests)
- `TestMain_FullFlow`: Verifica flujo completo de main()
- `TestStartServer_ConcurrentVMCreation`: Verifica requests concurrentes a endpoint /create-vm

#### Endpoint Tests (3 tests)
- `TestHealthEndpoint_Returns200`: Verifica endpoint /health retorna 200 con JSON válido
- `TestCreateVMEndpoint_ValidRequest`: Verifica endpoint /create-vm procesa request JSON válido correctamente
- `TestCreateVMEndpoint_InvalidJSON`: Verifica endpoint /create-vm maneja JSON inválido con error 400
- `TestRootEndpoint_ReturnsServiceMessage`: Verifica endpoint / retorna mensaje de servicio

## ⚙️ Especificaciones Técnicas
- **Runtime**: Go 1.24 (Gin)
- **Mode**: Mock / Adapter.
- **SDK**: VMware govmomi para integración con vSphere

## 🧪 Estrategia de Verificación
- **Integration Tests**: Valida que las peticiones del Orchestrator sean recibidas con el esquema correcto.
- **Simulación**: Capaz de producir respuestas de error controladas (Timeout, Insufficient Resources) para probar la resiliencia del sistema superior.

## 🌐 Endpoints
- `POST /create-vm` - Crea VM (simula 2 segundos de procesamiento)
- `GET /vms` - Lista VMs del inventory
- `GET /datacenters` - Lista datacenters disponibles
- `GET /clusters` - Lista clusters disponibles
- `GET /datastores` - Lista datastores disponibles
- `GET /connection/test` - Prueba conectividad con vCenter
- `GET /health` - Health check
- `GET /` - Información del servicio

## 🚀 Variables de Entorno
```bash
PORT=8091
VCENTER_HOST=vks-nsx.cloud.playground.net
VCENTER_USER=ro-user@vsphere.local
VCENTER_PASSWORD=Wetcom01!
VCENTER_INSECURE=true
```

---
©2026 Antigravity Engineering | Infrastructure Layer
