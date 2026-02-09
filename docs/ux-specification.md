# UX Specification: High-Efficiency VM Provisioner 🎨

> **Última actualización:** 2026-02-06
> **Estado:** Parcialmente Implementado

## 1. Estrategia de Reducción de Carga Cognitiva

La interfaz se diseña bajo el principio de "Ocultar la complejidad, exponer el control". El usuario no debe enfrentarse a la complejidad de vCenter, sino a decisiones de negocio claras.

---

## 2. Componentes de Interacción

### ✅ Implementados

| Componente | Estado | Ubicación |
|:-----------|:------:|:----------|
| **Wizard Adaptativo** | ✅ | `Layout/` - Horizontal desktop, sidebar navigation |
| **Dashboard** | ✅ | `DashboardPage.tsx` |
| **Gestión de Tipificaciones** | ✅ | `TypificationsPage.tsx` |
| **VM Classes** | ✅ | `VMClassesPage.tsx` |
| **Stats/Analytics** | ✅ | `StatsPage.tsx` |
| **vCenter Management** | ✅ | `VcentersPage.tsx` |
| **Monitoring Dashboard** | ✅ | `MonitorPage.tsx` - Nueva página /monitor |
| **Codificación por Colores** | ✅ | `UI/Components.tsx` - Variantes de chips |

### ❌ Pendientes

| Componente | Descripción | Prioridad |
|:-----------|:------------|:----------|
| **Speed Dial (FAB)** | Botón flotante con acciones rápidas | Media |
| **Rating de Corazón** | Sistema de satisfacción post-provision (#FF1744) | Baja |
| **IndexedDB Drafts** | Guardado automático offline | Baja |
| **Drag-and-drop** | Priorización de despliegues | Media |

---

## 3. Flujo de Experiencia Actual

```
┌─────────────────────────────────────────────────────────────────┐
│                      FLUJO IMPLEMENTADO                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. LoginPage.tsx          → Autenticación JWT                   │
│     └── Login con persistencia de sesión                        │
│                                                                  │
│  2. DashboardPage.tsx      → Vista principal                     │
│     └── Stats + navegación rápida                               │
│                                                                  │
│  3. Páginas de Gestión:                                          │
│     ├── TypificationsPage.tsx  → Crear/editar máscaras          │
│     ├── VMClassesPage.tsx     → Perfiles de hardware            │
│     ├── VcentersPage.tsx     → Conexiones vCenter               │
│     └── StatsPage.tsx        → Métricas y analytics            │
│                                                                  │
│  4. MonitorPage.tsx        → Observabilidad (NUEVO)             │
│     └── ServiceDiagram + ServiceCard                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Componentes UI Implementados

### Layout
```
src/components/Layout/
├── Header.tsx          → Navegación + botón Monitor
├── Sidebar.tsx         → Sidebar responsive
└── Layout.tsx          → Contenedor principal
```

### Monitor (NUEVO)
```
src/components/Monitor/
├── ServiceDiagram.tsx  → Diagrama C4 visual
├── ServiceCard.tsx     → Cards de estado
└── index.ts
```

### UI Base
```
src/components/UI/
├── Button.tsx
├── Card.tsx
├── Input.tsx
├── Select.tsx
├── Chip.tsx            → Colores: Rojo/Amarillo/Verde
├── Modal.tsx
├── Table.tsx
└── Toast.tsx          → Notificaciones
```

---

## 5. Páginas del Sistema

| Página | Archivo | Descripción |
|:-------|:--------|:------------|
| **Login** | `LoginPage.tsx` | Autenticación JWT |
| **Dashboard** | `DashboardPage.tsx` | Vista principal |
| **Tipificaciones** | `TypificationsPage.tsx` | Gestión de máscaras TP-Haki |
| **VM Classes** | `VMClassesPage.tsx` | Perfiles de hardware |
| **vCenters** | `VcentersPage.tsx` | Conexiones vCenter |
| **Stats** | `StatsPage.tsx` | Métricas |
| **Monitor** | `MonitorPage.tsx` | Observabilidad |
| **Monitor** | `MonitorPage.tsx` | /monitor endpoint |

---

## 6. Stack Técnico

| Tecnología | Versión | Propósito |
|:----------|:--------|:----------|
| **React** | 18.x | Framework UI |
| **Vite** | 5.x | Build tool |
| **MUI (Material UI)** | 6.x | Componentes base |
| **React Router** | 6.x | Enrutamiento |
| **Framer Motion** | - | Animaciones |
| **Axios** | - | HTTP Client |

---

## 7. Accesibilidad

| Requisito | Estado |
|:----------|:------:|
| Contraste mínimo 4.5:1 | ⚠️ Pendiente verificar |
| ARIA labels | ⚠️ Pendiente verificar |
| Navegación por teclado | ⚠️ Pendiente verificar |

---

## 8. Documentación Relacionada

| Documento | Propósito |
|:---------|:----------|
| [MODERN-UX-REDESIGN.md](./MODERN-UX-REDESIGN.md) | Rediseño de UI completo |
| [REACT-FIELD-BEST-PRACTICES.md](./REACT-FIELD-BEST-PRACTICES.md) | Mejores prácticas React |

---

© 2026 Antigravity Engineering | UX Reference
