# Stats & Analytics Service (Business Intelligence) 📊

Este microservicio se encarga de la recolección, agregación y exposición de métricas de negocio relacionadas con el aprovisionamiento.

## 📋 Responsabilidades
- **Telemetry Aggregation**: Pollea de forma asíncrona (background loop) el estado de los trabajos desde el Orchestrator.
- **Business Insights**: Calcula KPIs como "Total Provisions", "Success Rate" y "System Load".
- **Dashboard API**: Expone endpoints optimizados para alimentar la interfaz administrativa del Provisioner.

## ⚙️ Especificaciones Técnicas
- **Runtime**: Python 3.12 (FastAPI)
- **Background Worker**: Implementado con threading nativo para recolección no-bloqueante.
- **Data Model**: Estructuras eficientes para servir datos de series temporales simulados.

## 🧪 Estrategia de Verificación
- **Polling Logic**: El collector es resiliente y puede manejar fallos temporales de red hacia el Orchestrator.
- **Schema Validation**: Asegura que las métricas enviadas al frontend sigan el contrato esperado.

---
© 2026 Antigravity Engineering | Intelligence Layer
