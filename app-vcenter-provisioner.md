# Sub-Project: vCenter Provisioner (Staff Grade - Redesign)

## 📋 Objetivo
Plataforma de grado Enterprise para el aprovisionamiento de infraestructura virtual en vSphere, con un motor de tipificación dinámica y una arquitectura de microservicios altamente desacoplada.

## ⚖️ Evaluación Crítica de la Propuesta

Tu propuesta de 9 servicios especializados eleva el proyecto de un "Laboratorio" a un **"Control Plane de Infraestructura"**. 

### Comparación de Visiones

| Característica | Propuesta Inicial (Mínima) | Propuesta Especializada (Staff) | Valor Agregado |
| :--- | :--- | :--- | :--- |
| **Orquestación** | Gateway maneja el flujo. | **Provisioning Orchestrator** dedicado. | Desacopla el "Intento" de la "Ejecución". Si el Gateway cae, el proceso de creación de la VM continúa (Resiliencia). |
| **Interacción vCenter** | Un adaptador único. | **Integration Service** puro. | Abstracción total. Permite cambiar de vCenter a Nutanix o Cloud sin tocar la lógica de negocio. |
| **Identidad** | Hardcoded/Simple. | **Auth & Identity Service**. | Seguridad Multi-tenant y auditoría (quién creó qué VM). |
| **Estadísticas** | Consultas directas a DB. | **Stats & Analytics Service**. | Background processing para analizar tendencias de uso y RPO/RTO sin penalizar lecturas. |

### Análisis de Riesgos y Beneficios
- **Beneficio**: Separación estricta de responsabilidades (Single Responsibility Principle). Escalabilidad independiente (puedo escalar solo el orquestador si hay miles de peticiones).
- **Riesgo**: Complejidad en la comunicación (Eventual Consistency). Requiere un Service Mesh o Sidecars (Dapr) para manejar retries y service discovery de forma elegante.

## 🏛️ Mapa de Servicios Especializados (Antigravity Standard)

| Servicio | Stack Sugerido | Responsabilidad |
| :--- | :--- | :--- |
| **API Gateway** | Node.js (Fastify) | Punto único de entrada, rate limiting y routing. |
| **Auth & Identity** | Node.js | Gestión de usuarios, sesiones y RBAC. |
| **Tipification Service** | Python (FastAPI) | Lógica de segmentos `ID1+ID2...`. Validación de reglas de nomenclatura. |
| **VM Orchestrator** | Go (Temporal/Workflow) | Máquina de estados: Clone -> Specs -> PowerOn -> IP Check. |
| **vCenter Integration** | Go (govmomi) | Comunicación de bajo nivel con el SDK de VMware. |
| **Stats & Analytics** | Python (Pandas/SQL) | Procesamiento de métricas y proyecciones de capacidad. |
| **Monitoring & Resilience**| Go | Lógica de "Self-Healing" y observabilidad del sistema Antigravity. |
| **Backup & Recovery** | Go/Python | Persistencia de estados críticos y recovery de transacciones fallidas. |
| **Frontend UI** | React (MUI) | UX Premium, Dashboard y Wizard de Aprovisionamiento. |

## 🛠️ Lógica de Tipificación (Acuerdo de Diseño)
- **ID Segmentado**: Configurable N segmentos.
- **Segmento de Cierre**: Siempre automático (Incremental basado en DB).
- **Persistencia**: PostgreSQL como fuente única de verdad para las plantillas.

## ☸️ Next Steps (Post-Acuerdo)
1. Definición de Contratos (Internal APIs) entre servicios.
2. Diseño del Schema de Base de Datos unificado.
3. Configuración del entorno Docker Compose políglota.
