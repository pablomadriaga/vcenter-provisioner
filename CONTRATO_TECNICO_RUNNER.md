# Contrato Técnico — Test Runner MVP v1.0
## vCenter Provisioner | Fase 1 (Host Mode Only)

---

## 1. CONTRATO FORMAL

### Input
```bash
run_tests --manifest=<path_absoluto>
```
- **--manifest**: Ruta a archivo JSON (requerido, único parámetro)
- **Formato manifest**: Estructura mínima `{ "version": "1", "suites": [...] }`
- **Suite**: `{ "name": string, "path": string, "command": string }`

### Output
- **stdout**: JSON estricto (última línea)
- **stderr**: Logs humanos durante ejecución
- **Separación garantizada**: Logs ≠ JSON

### Exit Codes
| Código | Condición |
|--------|-----------|
| 0 | Todas las suites pasaron |
| 1 | Al menos una suite falló |
| 2 | Error de configuración (manifest inválido, jq no instalado) |

---

## 2. GARANTÍAS DEL FORMATO JSON

```json
{
  "version": "1",
  "timestamp": "2026-02-13T05:37:07+00:00",
  "duration_ms": 6310,
  "summary": {
    "total": 9,
    "passed": 4,
    "failed": 5
  },
  "suites": [
    {
      "name": "auth-service",
      "status": "passed",
      "duration_ms": 2831
    }
  ]
}
```

**Garantías estrictas**:
- Generado exclusivamente con `jq -n` (sin concatenación manual)
- Todas las claves entre comillas dobles
- `version` siempre string `"1"`
- `duration_ms` siempre número entero
- `status` valores enum: `"passed"` | `"failed"`
- Timestamp formato ISO 8601 (`date -Iseconds`)
- Sin campos opcionales (estructura fija)

---

## 3. SCOPE FREEZE — Qué NO HACE

**Prohibido en MVP**:
- ❌ Modo docker (no `docker exec`)
- ❌ Paralelismo (ejecución secuencial única)
- ❌ Timeout configurable (sin límite de tiempo)
- ❌ Parsing de tests individuales (solo resultado suite)
- ❌ Salida JUnit/XML (solo JSON)
- ❌ Filtros de suites (ejecuta todas)
- ❌ Schema formal (validación básica solo)
- ❌ Performance tests
- ❌ Infrastructure tests
- ❌ Feature flags

---

## 4. RIESGOS FUTUROS IDENTIFICADOS

| Riesgo | Impacto | Mitigación actual |
|--------|---------|-------------------|
| **Escalabilidad** | O(n) secuencial puede ser lento para 20+ servicios | Limitado a 9 suites |
| **Acoplamiento jq** | Dependencia externa obligatoria | Validación al inicio (exit 2) |
| **Sin timeout** | Suite bloqueada = runner colgado | Documentado como "won't fix" en MVP |
| **Hardcoded paths** | `apps/*` estructura rígida | Manifest externalizado (editable) |
| **Sin schema** | Manifest malformado = error opaco | Validaciones básicas de campos |

---

## 5. CRITERIOS PARA FASE 2

**Antes de ampliar scope, debe cumplirse**:

1. **Estabilidad**: 2 semanas sin fallos en producción
2. **Cobertura**: Manifest maneja 100% de servicios actuales
3. **Métricas**: Tiempo de ejecución ≤ 110% de pipeline.sh original
4. **Rollback**: Plan documentado para revertir a funciones nativas

**Candidatos a Fase 2** (no implementar aún):
- Modo docker (`--mode=docker`)
- Paralelismo (`--parallel=true`)
- Performance tests (integrar `perf-tests/`)
- Schema formal JSON Schema Draft-07

---

## Estado
**Versión**: 1.0  
**Fecha**: 2026-02-13  
**Estado**: MVP estable | No aprobado para Fase 2  
**Contrato válido hasta**: Revisión explícita por usuario
