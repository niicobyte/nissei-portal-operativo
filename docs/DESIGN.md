---
name: NISSEI Portal Operativo
colors:
  surface: '#fbf9f9'
  surface-dim: '#dbdad9'
  surface-bright: '#fbf9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f3'
  surface-container: '#efeded'
  surface-container-high: '#e9e8e7'
  surface-container-highest: '#e3e2e2'
  on-surface: '#1b1c1c'
  on-surface-variant: '#444748'
  inverse-surface: '#303031'
  inverse-on-surface: '#f2f0f0'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5e5e5e'
  primary: '#5c5c5c'
  on-primary: '#ffffff'
  primary-container: '#747474'
  on-primary-container: '#fefcfc'
  inverse-primary: '#c7c6c6'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e3e2e2'
  on-secondary-container: '#646464'
  tertiary: '#5c5c5c'
  on-tertiary: '#ffffff'
  tertiary-container: '#747474'
  on-tertiary-container: '#fefcfc'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e3e2e2'
  primary-fixed-dim: '#c7c6c6'
  on-primary-fixed: '#1b1c1c'
  on-primary-fixed-variant: '#464747'
  secondary-fixed: '#e3e2e2'
  secondary-fixed-dim: '#c7c6c6'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#464747'
  tertiary-fixed: '#e3e2e2'
  tertiary-fixed-dim: '#c7c6c6'
  on-tertiary-fixed: '#1b1c1c'
  on-tertiary-fixed-variant: '#464747'
  background: '#fbf9f9'
  on-background: '#1b1c1c'
  surface-variant: '#e3e2e2'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Roboto Flex
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Roboto Flex
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Roboto Flex
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.5rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes a high-performance, clean operational environment tailored for NISSEI Paraguay's technical service workshop and front-desk reception in Ciudad del Este. The aesthetic balances industrial utilitarianism with a sharp, minimalist monochrome developer/diagnostic console vibe.

The target audience encompasses technical workshop specialists performing board-level repairs, intake receptionists logging customer devices under rapid turnover, and post-sale service supervisors monitoring throughput metrics. 

### Visual Archetype & Principles
- **Industrial Precision:** Strict data density, zero ornamental distraction, and explicit visual boundaries that prevent clerical input error during high-pressure intake.
- **Monochrome Diagnostic:** Grounded in clean neutral light tones, utilizing disciplined monochrome hierarchy for high-legibility tracking and digital updates.
- **Utilitarian Clarity:** Prioritizes vertical rhythm, immediate scanning velocity, unmistakable operational states (Diagnóstico, Espera de Repuesto, En Banco, Listo para Entrega), and rapid WhatsApp notification dispatch previews.

## Colors

The palette is engineered specifically for extended screentime in bright repair bay environments, reducing ocular fatigue while maintaining instant status discrimination through clean monochrome contrast.

### Color Roles & Surface Mapping
- **Primary (`#777777` - Neutral Operational Gray):** Reserved for core structural actions, priority triage flags, intake commit triggers, and primary brand identity marks.
- **Secondary (`#777777` - Diagnostic Neutral):** Applied to telemetry indicators, active diagnostic readouts, QR/Barcode scanners, and technical schematics toggles.
- **Tertiary (`#777777` - Workshop Slate):** Designates awaiting spare parts, pending customer budget approval, and intermediate testing holds.
- **Success (`#10B981` - Emerald Functional):** Ready for pickup, QA test passed, payment cleared.
- **Neutral Stack (Monochrome Spectrum):**
  - **Canvas Base (`#F8FAFC`):** Clean light background for maximal screen contrast.
  - **Surface Level 1 (`#F1F5F9`):** Navigation rails, data-grid row backplates, section containers.
  - **Surface Level 2 (`#E2E8F0`):** Interactive inputs, active row hovers, drawer panels, modal dialogs.
  - **Surface Level 3 / Accent Slate (`#CBD5E1`):** Chip backgrounds, card headers, segmented controls.
  - **Border Base (`#94A3B8`):** Crisp structural boundaries and cell dividers.
  - **Border Active (`#475569`):** Focused inputs, selected items, active tabs.
- **Typography Neutrals:**
  - **Text Primary (`#0F172A`):** Essential data values, customer names, serial numbers, primary titles.
  - **Text Secondary (`#475569`):** Column headers, hardware specs, timestamps, helper descriptions.
  - **Text Muted (`#64748B`):** Inactive placeholders, disabled states, structural iconography.

## Typography

The typographic hierarchy implements three coordinated typefaces tailored for intense data processing and technical workshop tracking.

1. **Headlines (`Space Grotesk`):** Delivers a technical, sharp, and structured identity for workstation views, ticket IDs, dashboard KPIs, and intake stage summaries.
2. **Body Text (`Geist`):** Delivers uncompromised legibility for diagnostic notes, customer communications, repair checklists, and service history logs.
3. **Monospaced Data & Labels (`Roboto Flex`):** Applied across all hardware serials (IMEI, SN, MAC), order numbers (`OT-#89421`), timestamps, currency figures (PYG / USD), and badge micro-labels, providing clean variable-width clarity and structural alignment.

## Layout & Spacing

This design system uses a high-density, viewport-optimized layout with a 12-column responsive fluid grid designed to maximize screen real estate on desktop monitors, tablet inspection pads, and mobile receipt scanning terminals.

### Layout Mechanics
- **Desktop (1280px+):** Fixed collapsible 240px operational navigation sidebar on the left, primary data canvas spanning the remaining width. Multi-pane split screen (60% data grid / 40% active ticket drawer or WhatsApp preview pane).
- **Tablet (768px - 1279px):** Icon-only collapsed sidebar (64px), single or split-column responsive view with flyout bottom sheets for detailed device inspection.
- **Mobile (<768px):** Single-column stacked layout, bottom tab bar for core workflows (Ingreso, En Taller, Entregas), top search & scan bar.

### Spacing Principles
- Spacing follows a compact 4px baseline rhythm (`space-xs` = 4px, `space-sm` = 8px, `space-md` = 12px, `space-lg` = 20px, `space-xl` = 32px).
- Internal component paddings stay compressed (inputs and table cells rely on `space-sm` to `space-md`) to ensure technicians view maximum operational context without excessive vertical scrolling.

## Elevation & Depth

To sustain a robust industrial software environment, elevation is expressed through structured tonal layering and crisp perimeter borders rather than soft organic drop shadows.

### Depth Hierarchy
- **Level 0 (Base Canvas - `#F8FAFC`):** The structural viewport foundation behind tables, split panels, and main grids.
- **Level 1 (Subordinate Containers - `#F1F5F9`):** Bounded by a 1px border of `#94A3B8`. Applied to table bodies, card groups, and section backplanes.
- **Level 2 (Active Cards & Floating Menus - `#E2E8F0`):** Bounded by a 1px border of `#475569`. Accompanied by a technical shadow: `0 4px 16px -2px rgba(0, 0, 0, 0.1)`.
- **Level 3 (Modals, Overlays, WhatsApp Emulators - `#CBD5E1`):** Bordered with a 1px tint-adjusted perimeter (`rgba(119, 119, 119, 0.3)` for active tech views or `#475569` for neutral). Shadow: `0 12px 32px -4px rgba(0, 0, 0, 0.15)`.

### Lighting & Borders
Never use blurry diffuse colored halos. Focus states employ an interior or exterior 1px crisp outline in `#777777` with zero offset blur.

## Shapes

The design system enforces a disciplined `Soft (Level 1)` corner geometry.

- **Base Components (Inputs, Buttons, Cells, Badges):** `4px` (`0.25rem`) border radius. This subtle curvature maintains structural sharpness while removing jagged harshness on high-DPI displays.
- **Container Surfaces (Cards, Tables, Panels):** `8px` (`0.5rem`) outer border radius.
- **Dialogs & Overlay Trays:** `12px` (`0.75rem`) max border radius.
- **Status Indicator Dots & Avatars:** Fully circular (`rounded-full`) to immediately distinguish them from structural data modules.

## Components

### High-Density Operational Data Tables
- **Container:** Light neutral backplate (`#F1F5F9`) with 1px border (`#94A3B8`).
- **Headers:** 36px height, uppercase `label-md` in `Roboto Flex` (`#475569`), subtle bottom separator line.
- **Rows:** 44px fixed height for high density (collapsible to 36px in compact view mode). Hover state changes background to `#E2E8F0` with an instant 100ms transition. Active/Selected row features a 2px left border accent in `#777777`.
- **Monospaced Columns:** Serial Numbers, OT numbers, and monetary figures must be strictly styled with `Roboto Flex`.

### Status Badges
- **Structure:** 20px height, 4px corner radius, inline flex with an optional 6px pulsing dot for ongoing processes.
- **Typography:** `label-sm` (`Roboto Flex`), uppercase tracking.
- **Variants:**
  - *Ingreso / Diagnostic:* Background `rgba(119, 119, 119, 0.12)`, border `rgba(119, 119, 119, 0.3)`, text `#777777`.
  - *En Banco (Work in Progress):* Background `rgba(119, 119, 119, 0.12)`, border `rgba(119, 119, 119, 0.3)`, text `#777777`.
  - *Bloqueado / Garantía Rechazada:* Background `rgba(119, 119, 119, 0.12)`, border `rgba(119, 119, 119, 0.3)`, text `#777777`.
  - *Listo / Entregado:* Background `rgba(16, 185, 129, 0.12)`, border `rgba(16, 185, 129, 0.3)`, text `#10B981`.

### Buttons
- **Primary Operational Button:** Solid `#777777` background, `#FFFFFF` text (`Space Grotesk`, 600 weight), 38px height, 4px border radius. Hover: `#666666`. Active click: scaled down by 0.98.
- **Secondary Diagnostic Button:** Transparent background, 1px border `#777777`, text `#777777`. Hover: background `rgba(119, 119, 119, 0.1)`.
- **Ghost Utility Button:** Transparent background, text `#475569`, border `#94A3B8`. Hover: `#E2E8F0` background and `#0F172A` text.

### Form Inputs & Barcode Target Fields
- **Container:** `#F1F5F9` fill, 1px border `#94A3B8`, 38px height, text in `#0F172A` (`Geist` or `Roboto Flex` depending on data type).
- **Focus State:** Border changes to `#777777` with a 1px inward box-shadow for sharp edge fidelity.
- **Scanner Active Mode:** Fields bound to barcode/QR guns feature an animated electric gray pulsing corner bracket to cue the operator that input focus is captured.

### Checkboxes & Segmented Controls
- **Checkboxes:** 18x18px square with 3px border radius. Inactive: `#F1F5F9` with 1px `#475569` border. Checked: `#777777` background with `#FFFFFF` checkmark icon.
- **Segmented Filter Bars:** `#F1F5F9` container with 4px inner pads; active segment pill highlighted in `#CBD5E1` with `#0F172A` label.

### WhatsApp Notification Preview Card
- **Emulation Shell:** Distinct container simulating the customer's WhatsApp chat bubble to verify notification clarity before dispatch.
- **Colors:** Message bubble in `#E2E8F0` mounted on a neutral card frame (`#F1F5F9`).
- **Dynamic Tags:** Order status, technician name, and quote totals highlighted inside monospace code tags (`[OT-89421]`, `[USD 140.00]`).
- **Dispatch Action:** Direct split-button allowing immediate API dispatch or one-click copy to clipboard.