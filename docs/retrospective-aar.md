# Retrospective & After-Action Review (AAR) 🔄

Este documento analiza el proceso de desarrollo del vCenter Provisioner, los puntos de fricción encontrados y cómo se resolvieron para alcanzar el estándar Staff Grade.

## 1. Análisis de Objetivos vs. Resultados
- **Objetivo**: Arquitectura de 9 servicios especializada.
- **Resultado**: Sistema funcional implementado, pero con brechas iniciales en la profundidad de la documentación y la visibilidad de las pruebas.
- **Lección**: El "Músculo" (Código) sin el "Cerebro" (Docs) genera deuda técnica inmediata.

## 2. Puntos de Fricción (Issue Analysis)
- **Docker en Windows**: Se detectaron fallos de conectividad con el named pipe `dockerDesktopLinuxEngine`.  
  *   **Causa**: Desconexión del backend Linux de Docker Desktop o corrupción de sockets.
  *   **Mitigación**: Reinicio del motor de Docker y limpieza de `version` obsoletas en compose.
- **Build Failures (Go Version Mismatch)**: Se detectó que los archivos `go.mod` requerían una versión inexistente o futura (`go 1.24+`), rompiendo el build en contenedores.
  *   **Acción**: Paridad total en Dockerfile y `go.mod` usando Go 1.24.
  *   **Causa**: La generación de código por IA a veces "asume" que las librerías estándar están presentes sin declararlas en el manifiesto de paquetes.
- **Nginx Config Hardening (UI Accessibility)**: Se borró el `default.conf` pero no se inyectó una lógica de server block, dejando a Nginx inoperante.
  *   **Lección**: El hardening extremo debe ser balanceado con una configuración básica funcional.
- **Uvicorn Port Binding (Stats Service)**: Se hardcodeó el puerto 8000 en el CMD ignorando el env var `PORT`, causando el `ERR_EMPTY_RESPONSE` en el host.
  *   **Lección**: Los comandos de arranque deben ser dinámicos y respetar las variables de entorno inyectadas por el orquestador.
- **Build Failures (UI Lock File Sync)**: El comando `npm ci` falló en el contenedor debido a discrepancias entre el `package-lock.json` generado localmente (npm 11) y el motor npm del contenedor (npm 10).
  *   **Acción**: Se cambió `npm ci` por `npm install --legacy-peer-deps` en el Dockerfile para permitir una resolución dinámica de conflictos durante el build.
- **TypeScript Environment (Vite Typing)**: El build de producción del UI falló por errores de tipos en `import.meta.env`.
  *   **Causa**: Falta del archivo de definición de tipos global para Vite.
  *   **Resolución**: Creación de `src/vite-env.d.ts` con las referencias necesarias y actualización de `tsconfig.json`.
- **API Prefix Scoping**: Los componentes UI intentaban llamar a URLs absolutas o con prefijos redundantes que el Gateway ya manejaba.
  *   **Lección**: Centralizar el manejo de la URL base en un utilitario de API (`Axios instance`) y confiar en el ruteo del Gateway para el prefijado de servicios (`/typing`, `/auth`, etc.).
- **Verificación Final**: Se ejecutó exitosamente el comando `docker compose build --no-cache` para los 9 servicios simultáneamente y se verificó el login vía CLI.

## 3. Conclusión de la Retrospectiva
La arquitectura es excelente, pero el proceso de entrega debe ser más holístico, tratando a la documentación y las pruebas como ciudadanos de primera clase desde el minuto cero.

---
© 2026 Antigravity Engineering | Specialized 9-Service Model
