# Auth & Identity Service (Tier-0 Security) 🛡️

Este servicio gestiona la identidad y el acceso (IAM) dentro del ecosistema del vCenter Provisioner. Actúa como el origen de verdad para la autenticación de usuarios.

## 📋 Responsabilidades
- **Identity Management**: Registro y persistencia de usuarios operadores con hashing `bcrypt`.
- **JWT Issuance**: Generación de tokens de acceso firmados para la comunicación inter-servicios.
- **Token Verification**: Endpoint de alta performance que el Gateway valide la autenticidad de las peticiones en milisegundos.

## ⚙️ Especificaciones Técnicas
- **Runtime**: Node.js 20 (Fastify)
- **Persistence**: PostgreSQL (via Knex.js)
- **Security**:
    - `bcryptjs` para hashing de passwords (cost: 10).
    - `jsonwebtoken` para firma de tokens (HS256).
    - Stateless architecture.

## 🧪 Testing

### Test Coverage: 70.51% (Statements)

```bash
# Ejecutar todos los tests
npm test

# Ejecutar con coverage
npm run test:coverage
```

### Test Suites

#### Unit Tests (auth.test.ts) - 3 tests
- `Password Hashing Integrity`: Verifica hashing de passwords con bcrypt
- `JWT Token Generation and Verification`: Verifica generación y validación de tokens JWT
- `JWT Rejection on Invalid Secret`: Verifica rechazo de tokens con secret inválido

#### Integration Tests (integration.test.ts) - 28 tests

**Health Check:**
- `GET /health` (1 test)

**POST /register:**
- Register new user successfully (1 test)
- Reject duplicate username (1 test)
- Reject invalid password (too short) (1 test)
- Reject invalid username (too short) (1 test)
- Reject missing username (1 test)
- Reject missing password (1 test)
- Reject empty payload (1 test)
- Accept extra fields without error (1 test)

**POST /login:**
- Login with valid credentials (1 test)
- Reject invalid password (1 test)
- Reject non-existent user (1 test)
- Reject missing username (1 test)
- Reject missing password (1 test)
- Reject empty payload (1 test)
- Handle JSON parse error (1 test)

**GET/POST /verify:**
- Verify valid JWT token (1 test)
- Reject invalid token (1 test)
- Reject expired token (1 test)
- Reject missing token in Authorization header (1 test)

**Additional Tests:**
- Root endpoint (1 test)
- End-to-end login flow (3 tests)
- Token expiration (1 test)
- Concurrent login requests (1 test)
- Password hashing integration (2 tests)

## 🛡️ Auditoría Staff Grade
- **Rootless**: Imagen basada en `node:20-alpine` hardenecida.
- **Healthcheck**: `/health` integrado en el ciclo de vida de Docker.
- **Minimal Surface**: Solo expone los endpoints necesarios para el flujo de login/registro.

---
© 2026 Antigravity Engineering | Security First

