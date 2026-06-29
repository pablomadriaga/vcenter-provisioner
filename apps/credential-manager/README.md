# Credential Manager Service

Servicio especializado en la gestión de conexiones con vCenter y pruebas de conectividad.

## Responsabilidad Principal

- **Gestión de conexiones vCenter**: CRUD completo (Create, Read, Update, Delete)
- **Prueba de conectividad**: Verificar que las credenciales y el servidor vCenter sean accesibles
- **Almacenamiento seguro**: Encriptación de credenciales usando un maestro key único
- **Auditoría**: Registro de todas las operaciones realizadas sobre las conexiones

## Endpoints API

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| `GET` | `/health` | Estado del servicio | Pública |
| `GET` | `/api/vcenters` | Listar todas las conexiones vCenter | JWT |
| `GET` | `/api/vcenters/:id` | Obtener detalles de una conexión | JWT |
| `POST` | `/api/vcenters` | Crear nueva conexión | JWT |
| `PUT` | `/api/vcenters/:id` | Actualizar conexión existente | JWT |
| `DELETE` | `/api/vcenters/:id` | Eliminar conexión (soft delete) | JWT |
| `POST` | `/api/vcenters/:id/test` | Probar conexión a vCenter | JWT |
| `GET` | `/api/vcenters/:id/audit` | Obtener historial de auditoría | JWT |

## Proceso de Autenticación vCenter

El servicio usa autenticación por **Basic Auth** siguiendo este flujo:

1. **Obtención de token de sesión**:
   ```bash
   POST /api/session
   Authorization: Basic <base64(usuario:password)>
   ```

2. **Prueba de conexión**:
   ```bash
   GET /api/vcenter/vm
   vmware-api-session-id: <token_obtenido>
   ```

## Parámetros de Prueba de Conexión

El endpoint `POST /api/vcenters/:id/test` acepta el siguiente cuerpo JSON:

```json
{
  "allowInsecure": false
}
```

- **`allowInsecure`** (booleano, opcional, default: `false`):
  - `true`: Omite la validación de certificados TLS (solo para entornos de prueba o redes confiables)
  - `false`: Valida los certificados TLS normalmente (recomendado para producción)

### Advertencia de Seguridad

> **⚠️ ADVERTENCIA**: La opción `allowInsecure: true` desactiva la validación de certificados TLS, haciendo la conexión vulnerable a ataques de tipo man-in-the-middle. Solo debe usarse en entornos de confianza y bajo responsabilidad del usuario. En producción, siempre use certificados TLS válidos.

## Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto donde escucha el servicio | `8090` |
| `DB_URL` | URL de conexión a PostgreSQL | `postgresql://antigravity:password123@db:5432/vcenter_provisioner` |
| `CORS_ORIGINS` | Orígenes permitidos para CORS | `http://localhost:5173` |

## Consideraciones de Seguridad

1. **Almacenamiento de credenciales**: Las credenciales de vCenter se encriptan usando un maestro key antes de guardarlas en la base de datos.
2. **Modo insecure**: El parámetro `allowInsecure` está desactivado por defecto. Para activarlo, el usuario debe marcar explícitamente el checkbox en la UI o enviar `true` en la API.
3. **Auditoría**: Cada uso del modo insecure se registra en los logs con un mensaje de advertencia.

## Dependencias

- Base de datos PostgreSQL (conexión establecida mediante `DB_URL`)
- Servicio de autenticación (para verificar JWT en requests)
- Módulo Node.js `https` para conexiones TLS

## Ejemplos de Uso

### 1. Crear una nueva conexión vCenter

```bash
curl -X POST http://localhost:8090/api/vcenters \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "vCenter Production",
    "url": "https://vcenter.example.com",
    "credential": "admin@vsphere.local:MyPassword123",
    "default_datacenter": "DC1",
    "default_cluster": "Cluster-1"
  }'
```

### 2. Probar conexión (modo seguro)

```bash
curl -X POST http://localhost:8090/api/vcenters/1/test \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"allowInsecure": false}'
```

### 3. Probar conexión (modo insecure - NO recomendado para producción)

```bash
curl -X POST http://localhost:8090/api/vcenters/1/test \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"allowInsecure": true}'
```

## Implementación Interna

El servicio consiste de:

- **`VCenterConfigService`**: Clase principal con lógica de negocio
- **Repositorios**:
  - `VCenterConnectionRepository`: Operaciones de base de datos para conexiones
  - `AuditRepository`: Registro de operaciones de auditoría
- **Cifrado**:
  - `CredentialManager`: Gestiona la encriptación/descriptación de credenciales

### Funciones clave:

- **`testConnection(id, options)`**: Probar conexión con timeout de 10 segundos
- **`getSessionToken(url, base64Auth, agent)`**: Obtener token de sesión vCenter
- **`testVCenterConnection(baseUrl, sessionToken, agent)`**: Probar conectividad con token

## Notas de Versión

- **Versión actual**: 1.0.0
- **Cambios recientes**:
  - Refactorizado a credential-manager (antes vcenter-config-service)
  - Implementación correcta del flujo de autenticación de vCenter
  - Adición de soporte para conexiones insecure

## Depuración

Para ver logs del servicio:
```bash
docker logs provisioner-credential-manager
```

Para verificar conectividad a la base de datos:
```bash
docker exec provisioner-credential-manager npm run health-check
```

## Equipo de Desarrollo

- **Responsable**: Equipo de Plataforma Virtual
- **Contacto**: infraequipo@empresa.com