---
name: Kinetic Precision (F1 Pitwall Theme)
colors:
  surface: '#09090d'
  surface-dim: '#040406'
  surface-bright: '#0c0c12'
  surface-container-lowest: '#040406'
  surface-container-low: '#09090d'
  surface-container: '#0d0d14'
  surface-container-high: '#14141f'
  surface-container-highest: '#1e1e2e'
  on-surface: '#ffffff'
  on-surface-variant: '#f0f0f5'
  inverse-surface: '#ffffff'
  inverse-on-surface: '#040406'
  outline: '#14141f'
  outline-variant: '#1e1e2e'
  surface-tint: '#e10600'
  primary: '#e10600'
  on-primary: '#ffffff'
  primary-container: '#e1060018'
  on-primary-container: '#e10600'
  inverse-primary: '#e10600'
  secondary: '#888899'
  on-secondary: '#ffffff'
  secondary-container: '#0d0d14'
  on-secondary-container: '#888899'
  tertiary: '#29b6f6'
  on-tertiary: '#ffffff'
  tertiary-container: '#09090d'
  on-tertiary-container: '#29b6f6'
  error: '#ff1744'
  on-error: '#ffffff'
  error-container: '#1a0404'
  on-error-container: '#ff4444'
  primary-fixed: '#2a0a0a'
  primary-fixed-dim: '#e10600'
  on-primary-fixed: '#ffffff'
  on-primary-fixed-variant: '#e10600'
  secondary-fixed: '#0d0d14'
  secondary-fixed-dim: '#888899'
  on-secondary-fixed: '#ffffff'
  on-secondary-fixed-variant: '#888899'
  tertiary-fixed: '#09090d'
  tertiary-fixed-dim: '#29b6f6'
  on-tertiary-fixed: '#ffffff'
  on-tertiary-fixed-variant: '#29b6f6'
  background: '#040406'
  on-background: '#f5f5f7'
  surface-variant: '#0d0d14'
typography:
  display-lg:
    fontFamily: monospace
    fontSize: 42px
    fontWeight: '900'
    lineHeight: '1.15'
    letterSpacing: 2px
  headline-md:
    fontFamily: monospace
    fontSize: 24px
    fontWeight: '900'
    lineHeight: 32px
    letterSpacing: 1px
  headline-sm:
    fontFamily: monospace
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
  body-lg:
    fontFamily: monospace
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-md:
    fontFamily: monospace
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  data-mono:
    fontFamily: monospace
    fontSize: 11px
    fontWeight: 'bold'
    lineHeight: 16px
  label-caps:
    fontFamily: monospace
    fontSize: 11px
    fontWeight: 'bold'
    lineHeight: 16px
    letterSpacing: 3px
  display-lg-mobile:
    fontFamily: monospace
    fontSize: 28px
    fontWeight: '900'
    lineHeight: '1.2'
spacing:
  navbar-height: 48px
  edge-margin: 24px
  gutter: 1px
  container-padding: 16px
  stack-gap: 8px
  baseline-grid: 2px
---

## Brand & Style

The design system is engineered for the high-stakes, data-heavy environment of Formula 1 analytics. The brand personality is clinical, urgent, and hyper-technical, catering to an audience that demands split-second readability and deep-data density. 

The aesthetic is **Industrial Minimalism** with an **Expressive** edge. It draws from the functional beauty of pit wall telemetry screens and carbon-fiber aerospace components. The interface avoids decorative flourishes, favoring a "form follows function" ethos where every pixel serves a data point. The emotional response is one of total control and professional-grade insight, utilizing high-contrast accents against a light-absorbing backdrop to focus the user's attention on live performance metrics.

## Colors

The palette is anchored in a "Deep Space" dark mode to maximize contrast and reduce eye strain during long-duration sessions. 

- **Primary (F1 Brand Red):** `#e10600`. Reserved strictly for branding, critical alerts, live indicators, and active states. It acts as a visual "siren" within the UI.
- **Secondary (Slate/Muted Gray):** `#888899`. Used for structural elements, secondary UI text, team names, and inactive statuses.
- **Tertiary (Aero Cyan):** `#29b6f6`. Utilized for highlights, data visualizations (such as downforce readouts), and auxiliary information streams.
- **Neutral (Terminal Gray):** `#f5f5f7` & `#ffffff`. Provides a clean, highly legible neutral tone for primary typography and symbols.
- **Functional States:** Use F1 Red (`#e10600` / `#ff1744`) for errors/danger/live flags, Live Green (`#00e676`) for active and track-clear sessions, and Warning Yellow (`#ffea00`) for RPM lines, medium compounds, and delta metrics.

## Typography

This design system utilizes a unified typography strategy centered around monospaced fonts to balance technical precision with readability.

**Monospace** is the workhorse of the system, used for all numerical data, telemetry logs, timers, body texts, and UI labels. The monospaced nature ensures that fluctuating data points (like lap times and telemetry) do not cause horizontal layout shifts.

Key Rules:
- All labels must be in `label-caps` (Monospace, Uppercase) to maintain an industrial, gated aesthetic.
- Numbers should always use tabular lining to align columns in data grids.

## Layout & Spacing

The layout philosophy is based on a **Modular Grid System**. Content is housed within rigid containers separated by 1px "technical gaps" (gutters) rather than traditional wide margins, maximizing the density of information.

- **Navigation:** A sticky 48px top bar provides constant access to global race status, countdowns, and session selection.
- **Grid:** A fluid grid is used for desktop, collapsing to 1 column for mobile. 
- **Density:** The system uses a tight 2px baseline grid. Padding within data cells is kept at a minimum (8px or 12px) to ensure as much telemetry as possible is visible above the fold.
- **Breakpoints:** Mobile (<768px), Tablet (768px - 1279px), Desktop (1280px+). On mobile, horizontal scrolling lists are used to maintain data integrity.

## Elevation & Depth

In this design system, depth is achieved through **Tonal Layering** and **Sharp Outlines** rather than shadows. Shadows are strictly prohibited to maintain the flat, industrial look of a technical instrument.

- **Level 0 (Floor):** `#040406` - The base light-absorbing background surface.
- **Level 1 (Sub-Slabs):** `#09090d` - Dark baseline operational card background areas.
- **Level 2 (Containers):** `#0d0d14` - Standard information container frame surfaces.
- **Level 3 (Focused Active States):** `#14141f` - Row items selection and hover states.
- **Accents:** Inner dividers are strictly bound to `#14141f` or `#1e1e2e`.

The result is a "carved" aesthetic where elements appear as etched panels on a dashboard.

## Shapes

The shape language is **Clean and Industrial**. To reflect the precision of a Formula 1 car, border radii are kept minimal (4px for buttons/readouts, 6px for cards and containers).

This applies to:
- Buttons
- Data input fields
- Cards and containers
- Selection chips
- Navigation items

The sharp, slightly rounded corners reinforce the industrial, no-nonsense brand narrative and allow containers to sit flush against one another in a dense grid.

## Components

### Buttons
- **Primary:** Background `#e10600`, text `#ffffff`, 4px radius. Heavy, impactful.
- **Secondary/Ghost:** 1px border using `#888899`, background `transparent`. Text uses secondary color.
- **State:** On hover, primary buttons shift in intensity; secondary buttons fill with a low-opacity surface-variant.

### Data Grids
- The core of the platform. Headers use `label-caps` with a structural surface background. Rows alternate between surface levels for high-speed tracking.
- Borders between cells are 1px.

### Countdown Pills
- Square containers. Timers utilize Monospace in primary (`#e10600`) or secondary (`#888899`) colors.

### Sticky NavBar
- 48px height, solid structural surface (`#09090d`) with a 1px bottom border of `#14141f`.

### Inputs & Selectors
- Flat surfaces with 1px borders. Focus state is indicated by the border changing to F1 Red. No shadows or glows.

### Status Indicators
- Small 8px square "LED" indicators. Green (`#00e676`) for "Track Clear / Active", F1 Red (`#e10600`) for "Red Flag / Live Alert", and Warning Yellow (`#ffea00`) for "Paused".
