# Typing Service (ID-Generator Motor) 🚀

Este microservicio es el "corazón lógico" de la nomenclatura de VMs en el ecosistema. Implementa el motor **TP-Haki** para la generación dinámica de nombres basada en segmentos.

## 📋 Responsabilidades
- **Gobernanza de Nombres**: Valida y genera nombres únicos de VM concatenando segmentos manuales, fijos y secuenciales.
- **Validación de Reglas de Negocio**: Asegura que el último segmento sea siempre un `auto_seq` de longitud configurable.
- **Gestión de Contadores**: Mantiene un registro atómico en PostgreSQL para evitar colisiones en nombres secuenciales.

## ⚙️ Especificaciones Técnicas
- **Runtime**: Python 3.12 (FastAPI)
- **Persistence**: PostgreSQL (via SQLAlchemy)
- **Engine Logic (TP-Haki)**:
    - `manual`: El operador provee un valor de longitud fija (ej. 'SRV').
    - `fixed`: Prefijo estático definido en la plantilla (ej. '-').
    - `auto_seq`: Generador incremental con padding de ceros (ej. '001').

## 🧪 Testing

### Test Coverage: 97% (Statements)

```bash
# Ejecutar todos los tests
python -m pytest app/test_typing.py -v

# Ejecutar con coverage
python -m pytest app/test_typing.py -v --cov=app
```

### Test Suites

#### HTTP Handler Tests (10 tests)
- `test_health_check`: Verifica endpoint de health
- `test_root_endpoint`: Verifica endpoint raíz
- `test_create_template_violation`: Verifica rechazo de template sin auto_seq
- `test_create_template`: Verifica creación exitosa de template
- `test_list_templates`: Verifica listado de plantillas
- `test_generate_name_valid_template`: Verifica generación con template válido
- `test_generate_name_invalid_template_id`: Verifica rechazo de template inexistente
- `test_generate_name_missing_values`: Verifica error de valores manuales faltantes
- `test_generate_name_validation_errors`: Verifica errores de validación de longitud

#### Special Cases Tests (3 tests)
- `test_generate_name_special_characters`: Verifica manejo de caracteres especiales
- `test_generate_name_empty_values`: Verifica rechazo de valores vacíos
- `test_generate_name_too_many_values`: Verifica manejo de valores extra

#### Business Logic Tests (3 tests)
- `test_rfc1123_compliance`: Verifica cumplimiento de RFC 1123 (hostnames)
- `test_sequential_generation`: Verifica comportamiento de generación secuencial
- `test_duplicate_prevention`: Verifica identificación única de plantillas

### Coverage Report
```
Name                 Stmts   Miss  Cover   Missing
--------------------------------------------------
app\database.py         13      4    69%   14-18
app\main.py             64      3    95%   14-16
app\models.py           38      0   100%
app\schemas.py          28      0   100%
--------------------------------------------------
TOTAL                  277      7    97%
```

## 🛡️ Auditoría Tier-0
- **Rootless**: El contenedor corre bajo el usuario `appuser`.
- **Healthcheck**: Endpoint `/health` monitoreado nativamente por Docker/K8s.
- **Tracing**: Logs estructurados listos para Grafana/Loki.

---
© 2026 Antigravity Engineering | Specialized 9-Service Model

