---
description: "Diseño UX/UI: paleta de colores, componentes, breakpoints, accesibilidad"
category: ux
priority: medium
agent_role: plan
paths: ["apps/provisioner-ui/**"]
---

# Modern UX/UI Redesign — Tipificaciones Page

Documentación del rediseño moderno de la página de tipificaciones.

> **Última actualización:** 2026-02-06 | **Estado:** ✅ Implementado
> **Tecnología:** React 18 + MUI v6 + Framer Motion + Vite 5

---

## 🎯 Principios de Diseño

- **Glassmorphism:** Fondos con gradientes lineales, blur (`backdrop-filter: blur(12px)`) y transparencia.
- **Codificación por colores:** Cada tipo de segmento/tipificación con identidad cromática inmediata.
- **"Ocultar la complejidad, exponer el control":** El usuario decide sobre negocio, no sobre vCenter.
- **Micro-interacciones ricas:** Feedback visual animado en cada acción (hover, tap, focus, transitions).

### Paleta de Colores

| Token      | Hex       | Uso                              |
|:-----------|:----------|:---------------------------------|
| Primary    | `#6366f1` | Indigo — Acento principal        |
| Secondary  | `#8b5cf6` | Purple — Acento secundario       |
| Success    | `#10b981` | Green — Acciones positivas       |
| Warning    | `#f59e0b` | Orange — Alertas                 |
| Error      | `#ef4444` | Red — Acciones negativas / Hearts|
| Background | `#0f172a` | Dark blue — Fondo profundo       |
| Chip Manual    | `#ef4444` | Rojo                            |
| Chip Auto Seq  | `#3b82f6` | Azul                            |
| Chip Fijo      | `#10b981` | Verde                           |
| Chip Default   | `#6366f1` | Gris/Indigo                     |
| Chip Secondary | `#ec4899` | Rosa                            |

---

## 📄 Páginas del Sistema

| Página          | Archivo               | Descripción                    |
|:----------------|:----------------------|:-------------------------------|
| Login           | `LoginPage.tsx`       | Autenticación JWT              |
| Dashboard       | `DashboardPage.tsx`   | Vista principal + stats        |
| Tipificaciones  | `TypificationsPage.tsx` | Gestión de máscaras TP-Haki  |
| VM Classes      | `VMClassesPage.tsx`   | Perfiles de hardware           |
| vCenters        | `VcentersPage.tsx`    | Conexiones vCenter             |
| Stats           | `StatsPage.tsx`       | Métricas y analytics           |
| Monitor         | `MonitorPage.tsx`     | Observabilidad / endpoint      |

---

## 🌳 Árbol de Componentes

**Layout:** `Header.tsx` (navegación + botón Monitor), `Sidebar.tsx` (responsive), `Layout.tsx` (contenedor).
**Monitor:** `ServiceDiagram.tsx` (diagrama C4), `ServiceCard.tsx` (estado).
**UI Base:** `Button`, `Card`, `Input`, `Select`, `Chip` (Rojo/Amarillo/Verde), `Modal`, `Table`, `Toast` (notificaciones).

---

## ✨ Componentes de Interacción

- **FAB + Speed Dial:** Botón flotante 64×64px abajo-derecha, gradiente `#6366f1→#8b5cf6`, 3 acciones al expandir.
- **Rating con Corazón Rojo:** 5 corazones, precisión 0.5, color `#ef4444`, animación suave.
- **Multiple Select con Chips:** Colores por tipo (Manual=Rojo, Auto=Azul, Fijo=Verde), borderRadius 2.
- **Slider con Labels:** Rango 0–10, labels fijos, barra `LinearProgress` con gradiente, valor numérico H4.
- **Badge de Segmentos:** Esquina superior derecha, gradiente `#6366f1→#8b5cf6`.
- **Vertical Stepper:** 4 pasos: Nombre → Segmentos → Guardar → Comenzar. Paso activo resaltado.
- **Toggle View Mode:** Grid/List via `IconButton` con tooltips.
- **Favorites System:** Toggle con corazón, persistencia en localStorage.

---

## 🎬 Animaciones (Framer Motion)

- **Container:** staggerChildren 0.1, delayChildren 0.2.
- **Items (cards):** y: 20→0, spring stiffness 100.
- **Interacciones:** `whileHover: scale(1.02)`, `whileTap: scale(0.98)`, transición 0.3s ease.

---

## 📊 Layout & Responsividad

| Breakpoint | Columnas | FAB      |
|:-----------|:---------|:---------|
| xs (<600px)    | 1        | 56×56px  |
| sm (600–960px) | 2        | 64×64px  |
| md (960–1280px)| 3        | 64×64px  |
| lg (>1280px)   | 4+       | 64×64px  |

**Glassmorphism Paper:** `background: linear-gradient(135deg, rgba(30,41,59,0.6), rgba(15,23,42,0.6))`, `border: 1px solid rgba(99,102,241,0.3)`, borderRadius 2, `backdropFilter: blur(12px)`.

---

## 🎯 Micro-interacciones

| Elemento | Hover | Tap |
|:---------|:------|:----|
| Cards    | scale 1.02, border `#8b5cf6`, translateY(-4px), shadow | scale 0.95 |
| Botones  | gradiente fondo, scale 1.05, shadow ampliada | ripple MUI |
| Chips    | scale 1.1 | — |

- **Focus states:** outline con color del tema, aria-labels, tab order lógico.

---

## 🔄 Estados de UI

- **Empty State:** Icono 64px `#6366f1` opacidad 0.5, mensaje + CTA, `minHeight: 400`.
- **Loading State:** Skeleton cards con pulse animation, misma estructura que cards reales.
- **Error State:** Alert con icono, mensaje claro, botón "Reintentar". Color `#ef4444`.

---

## 🎨 Sistema de Diseño

- **Espaciado:** Container padding 24px (md)/16px (sm), grid spacing 32px (md)/24px (sm), card padding 24px.
- **Border Radius:** Cards 3px, Chips/Buttons 2px, FAB 50%, Badges 1px.
- **Sombras:** Cards `0 4px 20px rgba(0,0,0,0.15)`, Hover `0 20px 40px rgba(0,0,0,0.3)`, FAB `0 8px 20px rgba(99,102,241,0.5)`.
- **Tipografía:** H3 gradiente `90deg, #6366f1→#8b5cf6` fontWeight 800, H4 subtítulos, H5 cards, Body1/2 texto, Caption etiquetas.

---

## 🛠️ Stack Técnico

| Tecnología      | Versión | Propósito            |
|:----------------|:--------|:---------------------|
| React           | 18.x    | Framework UI         |
| Vite            | 5.x     | Build tool           |
| MUI (Material UI)| 6.x    | Componentes base     |
| React Router    | 6.x     | Enrutamiento         |
| Framer Motion   | —       | Animaciones          |
| Axios           | —       | HTTP Client          |

---

## ♿ Accesibilidad

- Contraste mínimo 4.5:1 (AA), ARIA labels en interactivos, navegación por teclado — ⚠️ Pendiente verificar.
- Touch targets ≥ 44×44px — ✅ Mobile.

---

## 📊 Métricas de Diseño

- **Initial Load:** < 2s (con skeleton) | **Animation:** 60 FPS | **Interactions:** < 100ms | **Bundle:** Code-splitting.

---

**Autor:** Antigravity UI Team | **Versión:** 2.0 (Modern Redesign) | **© 2026 Antigravity Engineering**
