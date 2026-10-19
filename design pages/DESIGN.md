---
name: AuraSync Design System
colors:
  surface: '#081425'
  surface-dim: '#081425'
  surface-bright: '#2f3a4c'
  surface-container-lowest: '#040e1f'
  surface-container-low: '#111c2d'
  surface-container: '#152031'
  surface-container-high: '#1f2a3c'
  surface-container-highest: '#2a3548'
  on-surface: '#d8e3fb'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#d8e3fb'
  inverse-on-surface: '#263143'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#c4c7c9'
  on-secondary: '#2d3133'
  secondary-container: '#464a4b'
  on-secondary-container: '#b6b9bb'
  tertiary: '#d0bcff'
  on-tertiary: '#3c0091'
  tertiary-container: '#a078ff'
  on-tertiary-container: '#340080'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#e0e3e5'
  secondary-fixed-dim: '#c4c7c9'
  on-secondary-fixed: '#191c1e'
  on-secondary-fixed-variant: '#444749'
  tertiary-fixed: '#e9ddff'
  tertiary-fixed-dim: '#d0bcff'
  on-tertiary-fixed: '#23005c'
  on-tertiary-fixed-variant: '#5516be'
  background: '#081425'
  on-background: '#d8e3fb'
  surface-variant: '#2a3548'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  container-max: 1440px
  gutter: 20px
  sidebar-width: 260px
---

## Brand & Style

The design system is engineered for a high-performance AI research environment. It balances the utilitarian precision of developer tools like Linear and Cursor with the expansive, creative fluidity of Arc and Notion. The aesthetic is **Modern SaaS / Functional Futurist**, characterized by high information density that remains legible through generous white space and mathematical alignment.

The target audience consists of researchers and academics who require a "flow state" interface. The UI should evoke a sense of **cognitive clarity, technical sophistication, and reliability**. Key visual drivers include:
- **Subtle Glassmorphism**: Used sparingly on floating panels to maintain context of the underlying research graph.
- **Micro-interactions**: High-frequency, low-latency feedback loops that make the AI feel responsive and alive.
- **Minimalism**: Removing visual noise to prioritize data visualization and long-form technical reading.

## Colors

The color strategy uses a deep navy foundation to reduce eye strain during extended research sessions. The **Primary Blue (#3B82F6)** acts as the "action" color, highlighting interactive paths and AI-generated insights. The **Accent Violet (#8B5CF6)** is reserved specifically for AI-augmented features, creating a clear visual distinction between manual inputs and machine assistance.

Surface colors utilize a tiered approach:
- **Level 0 (Background)**: The canvas layer.
- **Level 1 (Surface)**: Main content areas and sidebar containers.
- **Level 2 (Elevated)**: Modals, popovers, and active state indicators.

For the Light Mode variant, the palette inverts to a crisp slate-and-white theme (#F8FAFC Background) to maintain professional enterprise standards.

## Typography

The design system utilizes **Geist** for its primary typeface, leveraging its technical precision and optimized legibility for high-density SaaS interfaces. Its geometric construction mirrors the modern research aesthetic.

For technical metadata, citations, and AI-generated code snippets, **JetBrains Mono** is introduced. This provides a secondary visual layer that signals "raw data" or "system output," differentiating it from the "analytical" voice of the Geist-based body copy. 

**Hierarchy Rules:**
- **Tracking**: Use tighter tracking (-0.02em to -0.04em) for large headlines to maintain a "tight" editorial feel.
- **Line Height**: Generous 1.6x line-height for body text to facilitate long-form reading of research papers.
- **Labels**: Always use JetBrains Mono for status tags, version numbers, and timestamps.

## Layout & Spacing

This design system employs a **Fluid-Fixed Hybrid Grid**. The navigation and utility sidebars remain at fixed widths (260px and 64px respectively) to provide a stable anchor for the user’s mental map, while the central research canvas fluidly expands.

**Spacing Rhythm:**
- A strict **4px baseline grid** governs all spatial relationships.
- **Margins**: 24px on desktop, 16px on mobile.
- **Gutters**: 20px consistent between logical content blocks.

**Breakpoints:**
- **Mobile (<768px)**: Single column; sidebars collapse into a bottom sheet or "hamburger" drawer.
- **Tablet (768px - 1280px)**: Sidebar collapses into an icon-only rail; content centered.
- **Desktop (>1280px)**: Full multi-pane view with active "Inspector" panel on the right.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layering** supplemented by **Ambient Shadows**. Instead of heavy drop shadows, this design system uses "Ink Shadows"—highly diffused, low-opacity shadows with a subtle tint of the primary color to ground elements.

- **Non-interactive Surfaces**: Defined by a 1px border (#FFFFFF10 in dark mode) and no shadow.
- **Interactive Cards**: Lift on hover using a `0px 4px 20px rgba(0, 0, 0, 0.25)` shadow.
- **AI Overlays**: Utilize a `backdrop-filter: blur(12px)` and a semi-transparent primary-tinted background. This suggests that the AI tools are "floating" above the research data, ready to be summoned.
- **Dividers**: Subdued 1px lines using the surface border color; avoid pure black or pure white.

## Shapes

The shape language is defined by **Medium Roundedness**. A base radius of **0.5rem (8px)** is used for standard components, while larger containers and cards use **rounded-lg (16px)** to create a soft, approachable container for complex data.

**Specific Applications:**
- **Buttons/Inputs**: 8px (Soft enough to feel modern, sharp enough to feel professional).
- **Research Cards**: 16px (Creates a distinct boundary for dense information).
- **AI Floating Action Buttons**: Pill-shaped (fully rounded) to signify a different class of interaction.
- **Checkboxes**: 4px (Small radius to maintain a grid-like feel).

## Components

### Buttons
- **Primary**: Solid background (#3B82F6), white text, 8px radius. Subtle inner glow on top edge.
- **Ghost**: No background, primary color border only on hover. Used for secondary actions in toolbars.
- **AI Action**: Gradient background (Primary to Accent), white text, fully rounded.

### Cards
- **Research Card**: Surface-level background, 1px border, 16px padding. Title in Geist SemiBold, metadata in JetBrains Mono.
- **Hover State**: Border color shifts to Primary, subtle lift shadow.

### Input Fields
- **Search/AI Prompt**: Large 16px padding, 12px radius, "Search" icon prefix. Background is slightly darker than the surface to create a "well" effect.
- **Active State**: 2px Primary border with a soft blue outer glow (3px spread).

### Lists & Tables
- **Data Rows**: 48px minimum height, 1px bottom border. Zebra striping is avoided; use hover highlights instead.
- **Typography**: Inline labels use `label-md` for high scannability.

### Chips & Tags
- **Status Chips**: Low-saturation background with high-saturation text (e.g., Soft Green background with Deep Green text). 4px radius.