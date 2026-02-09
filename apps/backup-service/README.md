# Backup Service (Post-Provisioning Policy) 💾

Este microservicio gestiona las políticas de respaldo y protección de datos para las VMs recién creadas.

## 📋 Responsabilidades
- **Policy Enforcement**: Aplica configuraciones de respaldo programadas (Daily, Weekly) sobre las VMs en vCenter.
- **RPO/RTO Management**: Asegura que cada VM creada cumpla con los SLAs de recuperación definidos por el negocio.
- **Retention Control**: Gestiona el ciclo de vida de los snapshots y backups para optimizar el almacenamiento.

## ⚙️ Especificaciones Técnicas
- **Runtime**: Python 3.12
- **Integration**: Interactúa con el Orchestrator para recibir disparadores post-aprovisionamiento.
- **Resilience**: Diseñado para reintentar operaciones de respaldo en caso de congestión en la red de almacenamiento.

## 🧪 Estrategia de Verificación
- **Policy Validation**: Asegura que los metadatos de respaldo sean asociados correctamente a la identidad de la VM (TP-Haki ID).
- **Audit Logs**: Genera registros trazables de cumplimiento de respaldo.

---
© 2026 Antigravity Engineering | Data Protection Layer
