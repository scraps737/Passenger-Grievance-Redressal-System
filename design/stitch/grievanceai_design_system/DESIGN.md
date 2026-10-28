---
name: GrievanceAI Design System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#44474d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#75777e'
  outline-variant: '#c5c6ce'
  surface-tint: '#515f7a'
  primary: '#000412'
  on-primary: '#ffffff'
  primary-container: '#0f1e36'
  on-primary-container: '#7886a3'
  inverse-primary: '#b8c7e6'
  secondary: '#006591'
  on-secondary: '#ffffff'
  secondary-container: '#39b8fd'
  on-secondary-container: '#004666'
  tertiary: '#000605'
  on-tertiary: '#ffffff'
  tertiary-container: '#00231e'
  on-tertiary-container: '#009687'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d7e3ff'
  primary-fixed-dim: '#b8c7e6'
  on-primary-fixed: '#0c1b33'
  on-primary-fixed-variant: '#394761'
  secondary-fixed: '#c9e6ff'
  secondary-fixed-dim: '#89ceff'
  on-secondary-fixed: '#001e2f'
  on-secondary-fixed-variant: '#004c6e'
  tertiary-fixed: '#71f8e4'
  tertiary-fixed-dim: '#4fdbc8'
  on-tertiary-fixed: '#00201c'
  on-tertiary-fixed-variant: '#005048'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.03em
  data-mono:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.25rem
  margin: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

The design system establishes a high-trust, mission-critical operational interface for transport infrastructure authorities, operators, and passengers. Blending civic accountability with modern computational intelligence, the design ethos pairs executive enterprise clarity with decisive, real-time telemetry.

### Visual Language & Tone
- **Operational Reliability:** Architectural layout structure, crisp line-work, high data density, and clear typographic hierarchy inspire institutional dependability.
- **Cognitive Calm & High Legibility:** Neutral surfaces prevent sensory fatigue during long monitoring cycles; high-contrast foregrounds ensure absolute clarity in ambient lighting across transit hubs and monitoring centers.
- **Intelligent Telemetry:** AI summaries, sentiment scores, and automated escalation pathways are framed with precise, vibrant tech teal accents and unambiguous semantic state cues.
- **Design Style:** Corporate Modern meets Mission-Critical Utility—utilizing sharp structured borders, restrained translucent washes, and compact data-dense component grouping.

## Colors

The color palette is calibrated for high visual order, meeting rigorous WCAG AAA compliance standards for essential text and telemetry markers.

### Palette Architecture
- **Primary Navy (`#0F1E36`, `#1E293B`):** Anchors layout chrome, high-level headers, and executive navigation rails. Imparts structural weight and institutional authority.
- **Accent Teals (`#0EA5E9`, `#14B8A6`):** Reserved for algorithmic inferences, AI telemetry recommendations, active workflow transitions, and primary interactive buttons.
- **Structural Neutrals (`#F8FAFC`, `#FFFFFF`, `#E2E8F0`, `#64748B`):** Off-white base canvas reduces screen glare while bright white card containers elevate critical information. Clean slate borders delineate complex modular data views without visual clutter.
- **Status Semantics:**
  - `Alert Red (#EF4444)`: Urgent escalations, severe safety breaches, and missed SLAs.
  - `Warm Amber (#F59E0B)`: In-review states, pending passenger acknowledgments, and impending thresholds.
  - `Emerald Green (#10B981)`: Resolved grievances, cleared routes, and SLA compliance.

## Typography

Typography pairs **Plus Jakarta Sans** for prominent interface hierarchy with **Inter** for data tables, ticket transcripts, and density-driven views.

### Hierarchy & Usage
- **Display & Headlines (Plus Jakarta Sans):** Geometric balance with subtle character curves gives dashboard overviews and system headings an approachable yet authoritative tone.
- **Body & Data Tables (Inter):** Highly legible neutral grotesque engineered for maximum reading comfort across ticket threads, multi-line passenger accounts, and telemetry feeds.
- **Data & Identifiers (`data-mono`):** Ticket tracking IDs, train numbers, PNR tokens, and GPS coordinates use tabular figures for strict vertical alignment in tables and split panes.

## Layout & Spacing

The layout model uses a disciplined 12-column grid system balanced with consistent flex and multi-panel split panes for master-detail views.

### Screen Adaptations
- **Desktop (1280px+):** Fixed 260px collapsible primary navigation dock, 12-column fluid data canvas with `1.25rem` gutters, and an optional 400px context drawer for AI grievance analysis.
- **Tablet (768px - 1279px):** 8-column grid with `1rem` gutters; navigation rail condenses to an icon-only strip (72px); ticket lists and details shift to stacked or toggle views.
- **Mobile (< 768px):** 4-column layout with `1rem` outer screen margins; sticky bottom action bars for rapid dispatch and resolution triggers; data tables fold into structured card lists.

## Elevation & Depth

Visual depth is achieved through crisp borders combined with ambient, tinted drop shadows to keep critical data legible without visual distortion.

### Surface Architecture
- **Layer 0 (Canvas):** Tone `#F8FAFC` forms the baseline background for minimal glare.
- **Layer 1 (Card / Table Panels):** `#FFFFFF` surfaces bounded by a crisp 1px stroke of `#E2E8F0` and an ultra-diffused shadow (`0 1px 3px rgba(15, 30, 54, 0.04), 0 1px 2px rgba(15, 30, 54, 0.02)`).
- **Layer 2 (Floating Popovers & Filters):** Elevated panels use a 1px border of `#E2E8F0` with `0 4px 12px -2px rgba(15, 30, 54, 0.08)`.
- **Layer 3 (Modals & Escalation Overlays):** Deep focus overlays use `0 12px 32px -4px rgba(15, 30, 54, 0.16)` over a 40% `#0F1E36` backdrop blur.
- **AI Intelligence Highlights:** Automated suggestion blocks feature a subtle 1px border tinted in `#0EA5E9` (at 30% alpha) over an ultra-light cyan wash (`#F0F9FF`).

## Shapes

The system implements a structured geometry:
- **Primary Data Cards & Panels:** Standardized radius of `12px` (`0.75rem` / `rounded-lg`) creates friendly, clean enclosures that soften enterprise rigidity while preserving structural order.
- **Input Fields & Action Controls:** Built with `8px` (`0.5rem`) radii for sharp visual definition in dense operational forms.
- **Status Badges & Category Chips:** Pill-shaped (`9999px`) boundaries distinguish quick glance metrics from interactive rectangular cards.

## Components

### Buttons
- **Primary:** Deep navy background (`#0F1E36`) with white text and `8px` border radius. Transitions to `#1E293B` on hover.
- **Accent / AI Action:** Vibrant teal background (`#0EA5E9`) with crisp white text for automated resolution triggers, routing, and bot generation.
- **Secondary:** White background with a 1px `#E2E8F0` border and `#0F1E36` text. Hover shifts to `#F8FAFC`.
- **Destructive:** Bordered or solid `#EF4444` for emergency dispatches or grievance rejections.

### Status Badges (Pills)
Pill-shaped (`rounded-full`) tags built with subtle pastel backgrounds and saturated text:
- **Urgent / Escalated:** Background `#FEE2E2`, Text `#DC2626`, 1px border `#FECACA`.
- **In Review / Pending:** Background `#FEF3C7`, Text `#D97706`, 1px border `#FDE68A`.
- **Resolved:** Background `#D1FAE5`, Text `#059669`, 1px border `#A7F3D0`.
- **AI Triaged:** Background `#E0F2FE`, Text `#0284C7`, 1px border `#BAE6FD`.

### Data Cards
- Constructed with a `12px` corner radius, pure white background, and a 1px `#E2E8F0` border.
- Card headers feature metadata pills alongside mono-spaced reference keys.
- Subtle left accent border (3px) matching the grievance category or urgency state.

### Input Fields & Selects
- Height: 40px for desktop views, 44px for touch interfaces.
- Background: `#FFFFFF` bounded by `#CBD5E1`. On focus: 1px `#0EA5E9` border with a 3px outer ring tinted in `rgba(14, 165, 233, 0.15)`.

### Ticket Timeline & Grievance Thread
- Vertical continuous 2px track (`#E2E8F0`) with 12px circular state nodes.
- AI suggestion cards nested directly inline, accented with a 1px `#0EA5E9` outline and a soft `#F0F9FF` background fill.

### Checkboxes & Segmented Controls
- Checkboxes use `4px` corner radii and an active `#0EA5E9` fill with a sharp white checkmark.
- Filter tab strips use an enclosed gray track (`#F1F5F9`) with active white pill tab segments.