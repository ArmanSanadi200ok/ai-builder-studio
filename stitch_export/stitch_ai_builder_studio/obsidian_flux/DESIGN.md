---
name: Obsidian Flux
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c7c4d8'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#918fa1'
  outline-variant: '#464555'
  surface-tint: '#c3c0ff'
  primary: '#c3c0ff'
  on-primary: '#1d00a5'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#4d44e3'
  secondary: '#89ceff'
  on-secondary: '#00344d'
  secondary-container: '#00a2e6'
  on-secondary-container: '#00344e'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#006e4b'
  on-tertiary-container: '#67f4b7'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#c9e6ff'
  secondary-fixed-dim: '#89ceff'
  on-secondary-fixed: '#001e2f'
  on-secondary-fixed-variant: '#004c6e'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  container-max: 1440px
  gutter: 16px
---

## Brand & Style

The design system is engineered for high-performance AI development environments. It targets a technical audience that demands precision, speed, and visual clarity during long-duration deep work sessions. 

The aesthetic is a fusion of **Modern Minimalism** and **Refined Utility**. It prioritizes a "dark-first" architecture to reduce eye strain, utilizing high-contrast accents against deep charcoal foundations. The visual language avoids decorative flourishes, opting instead for functional glassmorphism and structural integrity. The result is a UI that feels like a professional-grade instrument: silent, powerful, and impeccably organized.

## Colors

The palette is anchored in a layered grayscale to establish depth without relying on traditional drop shadows. 

- **Foundation:** The base layer is a pure deep charcoal (#0A0A0A), providing maximum contrast for text.
- **Surfaces:** UI containers and panels use a slate-gray (#161616) to create a distinct hierarchy of information.
- **Accents:** A vibrant Indigo-to-Electric-Blue primary color is used sparingly for interactive states and focus indicators.
- **Status:** Functional colors (Emerald for success/active, Amber for warnings) follow standard developer mental models but are adjusted for high vibrancy against the dark backdrop.
- **Borders:** All structural boundaries are defined by a consistent 1px solid #262626 border.

## Typography

This design system utilizes **Geist** for its systematic, neutral, and technical character. It is optimized for legibility in dense data environments.

- **Scale:** A tight typographic scale is maintained to maximize screen real estate. 
- **Monospace:** **JetBrains Mono** is reserved for code snippets, JSON outputs, and technical metadata to ensure character distinction (e.g., distinguishing '0' from 'O').
- **Hierarchy:** Use weight (Medium to Bold) rather than size to denote importance, keeping the interface compact.
- **Anti-Aliasing:** Ensure `-webkit-font-smoothing: antialiased` is applied for crisp rendering on dark backgrounds.

## Layout & Spacing

The layout operates on a strict **8px linear grid** to ensure mathematical alignment across all components.

- **Grid System:** Use a 12-column fluid grid for primary dashboard views. For internal IDE-like views (e.g., node editors), use a flexible pane system with draggable dividers.
- **Padding:** Maintain a minimum 16px (md) internal padding for cards and modals to prevent content crowding.
- **Density:** Provide "Comfortable" and "Compact" modes. Compact mode reduces vertical spacing in lists and tables to 4px (xs).
- **Responsiveness:** Desktop is the primary target. On mobile, sidebars collapse into a drawer, and multi-column code editors stack vertically.

## Elevation & Depth

In this dark-themed system, depth is communicated through **Tonal Elevation** and **Translucency** rather than heavy shadows.

- **Level 0 (Base):** #0A0A0A — The workspace background.
- **Level 1 (Surface):** #161616 — Cards, sidebars, and navigation bars.
- **Level 2 (Overlay):** #1C1C1C — Modals, popovers, and tooltips.
- **Glassmorphism:** Use a 12px backdrop-blur on Level 2 elements with a semi-transparent background (`rgba(22, 22, 22, 0.8)`) to maintain context of the underlying workspace.
- **Inner Glow:** Interactive elements (buttons) feature a subtle 1px top-border highlight (white at 5% opacity) to simulate light hitting the edge.

## Shapes

The shape language is controlled and geometric. 

- **Standard Elements:** Buttons, inputs, and cards use an 8px radius (`rounded-md`).
- **Large Containers:** Modals and main dashboard panels use a 12px radius (`rounded-lg`).
- **Indicators:** Status dots and small badges utilize a fully rounded (pill) shape to contrast against the otherwise rectilinear UI.

## Components

- **Buttons:** 
  - *Primary:* Indigo background, white text, subtle inner top-stroke.
  - *Secondary:* Transparent background, #262626 border, slate-gray hover state.
- **Input Fields:** 
  - Darker than the surface (#0A0A0A), 1px solid border. Focus state triggers a 1px Indigo border and a 0px 0px 0px 2px Indigo/20% outer ring.
- **Cards:** 
  - Level 1 surface, 1px border. No shadows. Use a subtle hover state that lightens the border to #404040.
- **Chips/Badges:** 
  - Low-profile, dark-filled with colored text (e.g., dark emerald background with emerald text) for status indicators.
- **Node Editor Elements:**
  - Nodes should use the Level 2 surface with a thicker 2px Indigo left-border to indicate selection. Connection lines (edges) should be #404040 with animated "flow" gradients when data is active.
- **Data Tables:**
  - Minimalist; remove vertical borders. Use #161616 for header backgrounds and 1px #262626 horizontal separators.