---
description: "Requisitos estratégicos: SLA, multi-tenancy, IPAM, naming conventions"
category: project
priority: medium
agent_role: plan
---

# Business Discovery: Strategic Insights & Roadmap 🕵️

Este documento unifica las interrogantes estratégicas y definiciones de negocio necesarias para escalar el provisionador hacia un entorno de producción Tier-0.

## 1. Naming Conventions (Tipificaciones)
El motor de tipificación es el corazón del orden sistémico. Se establecen los siguientes lineamientos:
*   **Formato Recomendado**: `[Location]-[Env]-[App/Service]-[Role]-[Sequential]` (ej: `BUE-PRD-SRV-APP-001`).
*   **Restricciones de Hostname**: Límite estricto de 15 a 63 caracteres según estándares RFC y NetBIOS.
*   **Integración DNS**: ¿Automatizaremos la creación de registros A y PTR en AD/DNS para garantizar FQDN inmediatos?
*   **Jerarquía de Clientes**: ¿Debemos forzar prefijos obligatorios basados en el Tenant/Departamento?

## 2. Definiciones de Infraestructura y SLA
*   **Provisión en Tiempo Real**: El objetivo enterprise típico es `< 10s` para aceptar la solicitud, `< 15 min` para VM Ready (clonación + personalización) y `< 30 min` para operatividad total (post-checks).
*   **IPAM Integration**: Integración mandatoria vía API (Infoblox/NetBox) para pre-asignación de IP antes de la clonación, evitando conflictos de DHCP y permitiendo el etiquetado de redes (Tenant, Env).
*   **Capacidad Concurrente**: Gestión de colas de prioridad (Priority Queues) para procesos de creación por lotes (batch) evitando saturación del vCenter.

## 3. Modelo de Servicio y Escala
*   **Multi-Tenancy**: Estrategia de aislamiento mediante carpetas (Folders) de vCenter y Resource Pools combinados con roles RBAC de aplicación, evitando la complejidad de múltiples vCenters.
*   **VM Classes & Perfiles**: Soporte dinámico para perfiles de hardware:
    - **GPU Clusters**: Para cargas de ML.
    - **Tiered Storage**: Selección inteligente entre SSD (All-Flash) vs HDD (Standard).
    - **Affinity Rules**: Reglas de anti-afinidad automáticas para evitar que VMs de la misma aplicación residan en el mismo Host físico.
*   **Extensibilidad Cross-Cloud**: Diseño de adaptadores "Plug-and-Play" para Nutanix, Hyper-V, AWS EC2 y Azure, permitiendo una nube híbrida real.

## 4. KPIs y Analytics Avanzados
*   **Costo Estimado**: Cálculo en tiempo real del costo de la VM basado en recursos asignados (CPU/RAM/Storage).
*   **Detección de Anomalías**: Uso de ML en el Stats Service para predecir cuándo se agotarán los pools de nombres o los recursos físicos de un Datacenter.
*   **Compliance de Auditoría**: Exportación automática de logs inmutables para auditorías SOX/ISO 27001, incluyendo claims de JWT y marcas de tiempo de cada acción.

---
© 2026 Antigravity Engineering | Strategy & Discovery
