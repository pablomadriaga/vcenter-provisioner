# VM Orchestrator (State Management Engine) ⚙️

Este microservicio gestiona el ciclo de vida asíncrono del aprovisionamiento de VMs.

## 📋 Responsabilidades
- **Async Execution**: Workers asíncronos para interactuar con la infraestructura.
- **State Machine**: Seguimiento de estados (`PENDING`, `READY`, `FAILED`).
- **Coordinación**: Orquesta llamadas entre `typing-service` y `vcenter-integration`.

## 🧪 Testing

### Test Coverage: 78.3% (Statements)

```bash
# Ejecutar todos los tests
go test ./... -v

# Ejecutar con coverage
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

### Test Suites

#### State Machine Tests (5 tests)
- `TestProvisioningWorkflow_Success`: Verifica flujo completo PENDING → INFRA_CREATING → READY
- `TestProvisioningWorkflow_Failure`: Verifica manejo de errores en aprovisionamiento
- `TestStateTransition_Isolated`: Prueba transición de estado aislada
- `TestAsyncExecution_Delayed`: Verifica ejecución asíncrona con delay
- `TestAsyncExecution_RaceCondition`: Verifica manejo de condiciones de carrera

#### Error Handling Tests (4 tests)
- `TestGenerateVMName_TypingServiceUnavailable`: Manejo de error de conexión a typing-service
- `TestGenerateVMName_InvalidTemplateID`: Manejo de template inválido
- `TestProvision_TypingServiceFailure`: Manejo de fallos en typing-service
- `TestProvision_HTTPTimeout`: Manejo de timeouts en llamadas HTTP

#### Status & Polling Tests (3 tests)
- `TestStatus_TransitionInProgress`: Verifica polling durante transición de estado
- `TestStatus_MultipleJobs`: Verifica estado de múltiples jobs concurrentes
- `TestStatus_CompletedJob`: Verifica polling de jobs completados

#### Validation Tests (3 tests)
- `TestProvision_InvalidVMDatacenter`: Validación de datacenter
- `TestProvision_InvalidVMCluster`: Validación de cluster
- `TestProvision_MissingSpecsValidation`: Validación de specs opcionales

### Additional Tests
- `TestHealthCheck`: Verifica endpoint de health
- `TestRootEndpoint`: Verifica endpoint raíz
- `TestProvision_ValidRequest`: Verifica petición válida de aprovisionamiento
- `TestProvision_InvalidJSON`: Manejo de JSON inválido
- `TestProvision_MissingRequiredFields`: Validación de campos requeridos
- `TestProvision_WithSpecs`: Verificación de specs de VM
- `TestStatus_ExistingJob`: Verificación de estado de job existente
- `TestStatus_NonExistentJob`: Manejo de job inexistente
- `TestConcurrentJobs`: Verificación de concurrencia

## Spec
- **Runtime**: Go 1.22 (Gin)
- **Tests**: `go test ./...`
- **Docker**: Hardened Tier-0 (Rootless)
- **Coverage**: 78.3% statements

