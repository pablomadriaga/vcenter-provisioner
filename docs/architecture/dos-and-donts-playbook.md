---
description: "Principios de ingeniería, Do's, Don'ts, lecciones aprendidas. Aplicar en todo cambio."
category: architecture
priority: high
agent_role: plan, debug
paths: ["*.py", "*.ts", "*.go", "*.sh"]
---

# Do's y Don'ts Playbook: Ingeniería de Excelencia

> **Última actualización:** 2026-05-20
> **Propósito:** Guía de mejores prácticas, errores a evitar y principios arquitectónicos.

---

## 1. Principios Fundamentales

- **Obedecer Constraints Explícitos:** Si el usuario, la arquitectura o los estándares prohíben una acción, no reintroducirla.
- **Priorizar Diseño sobre Conveniencia:** Resolver de raíz, no con workarounds. Preguntar: ¿rompe DRY? ¿acopla al layout? ¿introduce magia invisible?
- **Mantener una Sola Fuente de Verdad:** No duplicar artefactos ni scripts. Cada recurso con origen único y versionado.
- **Desacoplar Artefactos del Layout del Repo:** Deployments y ConfigMaps no asumen rutas locales. Kustomize overlays declaran qué necesitan, no dónde está.
- **Evitar Magia Invisible:** Sin symlinks raros, mountings opacos, cajas negras. Todo reproducible con `kubectl apply -k k8s/overlays/dev/`.
- **Explicabilidad Rápida:** Cualquier desarrollador debe entender el despliegue en ≤ 5 minutos.

---

## 2. ✅ Do's

| Práctica | Detalle |
|:---------|:--------|
| **Documentar el "Por qué"** | READMEs que expliquen razón, no solo procedimiento |
| **Unit Testing Aislado** | Test de lógica core sin red ni DBs reales. Usar mocks e in-memory |
| **Hardening de Imágenes** | Imágenes rootless, usuario `clouduser`, liveness/readiness probes |
| **Atomicidad en ID Gen** | Contadores en DB, transacciones explícitas (TP-Haki) |
| **ConfigMaps/Secrets sobre Env Vars Hardcodeados** | Config vive en K8s (`configMapRef` + `secretRef`), no en código |
| **Centralización de Config** | Puertos en `k8s/base/configmap.yaml`, API URLs en `src/utils/api.ts`, scripts en `scripts/` |
| **Pipeline como Única Puerta** | `./pipeline.sh` (lint + test + build), flags: `--lint`, `--build`, `--test` |
| **Image Tagging Determinístico** | Tags basados en hash de commit (`git rev-parse --short=10 HEAD`), nunca `:latest` |
| **Validación Temprana** | `./pipeline.sh --validate` y `--lint` pre-commit |
| **Kustomize Overlays por Entorno** | `k8s/base/` (común) + `k8s/overlays/{dev,staging,prod}/`. Nunca duplicar Deployments |

---

## 3. ❌ Don'ts

| Error | Corrección |
|:------|:-----------|
| **Placeholders en Docs** | Sin `.md` con plantillas vacías. Preferible no tenerlos que información falsa |
| **Confianza Ciega en el Build** | "Compila" ≠ "Funciona". Verificar tests + healthchecks + endpoints |
| **Alucinar Versiones** | Especificar versiones exactas que coincidan con la imagen base (`FROM node:20.11.0-alpine3.19`) |
| **Copiar Archivos en Pipelines** | No `cp scripts/* apps/`. Usar ConfigMaps montados como volúmenes |
| **Omitir Dependencias** | Todo `import` debe estar declarado en `package.json`/`go.mod` |
| **Fragmentar API URLs** | Centralizar en `src/utils/api.ts`, no definir URLs por componente |
| **Ignorar Tipado de Entorno** | Declarar `env.d.ts` con `/// <reference types="vite/client" />` |
| **Acoplamiento Directo en Tests** | Unit: mocks e in-memory. Integración: contenedores. E2E: clúster K8s real |
| **Modificar Pipelines a Escondidas** | Cambios a `pipeline.sh` o CI siempre documentados y comunicados |
| **Usar `:latest` en Imágenes** | No-determinístico, impide rollbacks. Usar hash de commit |

---

## 4. Mentalidad del Ingeniero

- **Arquitectura Primero, Operación Segundo:** Pensar en relaciones entre artefactos antes que en ejecución. "¿Este cambio afecta otros servicios? ¿Introduce acoplamiento?"
- **Disciplina y Humildad:** Documentar cada decisión, planificar antes de ejecutar, elegir la solución más correcta arquitectónicamente, no la más fácil.

---

## 5. Referencia Rápida

| Qué Hacer | Comando/Ejemplo |
|:----------|:---------------|
| Pipeline completo | `./pipeline.sh` |
| Solo lint | `./pipeline.sh --lint` |
| Solo build | `./pipeline.sh --build` |
| Solo tests | `./pipeline.sh --test` |
| Deploy a dev | `./pipeline.sh --k8s-deploy-dev` |
| Deploy manual | `kubectl apply -k k8s/overlays/dev/` |
| Verificar pods | `kubectl get pods -n vcenter-provisioner-dev` |
| Verificar salud | `curl http://localhost:3000/health` |

---

## 6. Lecciones del Proyecto

**TextField Focus Issue (TypificationsPage):** `Step2Content` con componentes anidados en map, keys inestables, callbacks sin memoizar. **Solución:** `SegmentEditor.tsx` con `React.memo`, IDs únicos, `useCallback` con IDs estables. Resultado: focus mantenido, sin re-renders.

---

© 2026 Antigravity Engineering | Engineering Excellence Playbook
