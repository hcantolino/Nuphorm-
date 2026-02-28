# MedReg Platform Design Approach

## Chosen Design: Professional Medical Tech with Finbox Inspiration

### Design Movement
**Modern Financial/Medical Dashboard** — Inspired by Finbox's clean, professional interface with a focus on clarity, accessibility, and data-driven workflows. This combines the minimalist aesthetic of financial tech with the precision required in medical regulatory contexts.

### Core Principles
1. **Clarity Through Hierarchy** — Information architecture prioritizes the most critical actions (Create Regulatory Document, Data Repository) at the top, with supporting services below
2. **Dark-Mode Professional** — Deep navy/charcoal sidebar with crisp white text creates visual separation and reduces eye strain during long work sessions
3. **Functional Minimalism** — Every element serves a purpose; no decorative elements distract from the core workflow
4. **Accessibility-First** — High contrast ratios, clear focus states, and intuitive navigation patterns

### Color Philosophy
- **Sidebar Background**: Deep navy (`#1a2332` or similar) — conveys trust, professionalism, and stability
- **Text/Icons**: Crisp white (`#ffffff`) with subtle gray accents for secondary items
- **Active State**: Bright accent color (electric blue `#0693e3` or similar) — signals current location without overwhelming
- **Hover State**: Subtle background lift (lighter navy overlay) — indicates interactivity without jarring changes
- **Main Content**: Light background (`#f0f8ff` or white) — clean canvas for data and forms

### Layout Paradigm
- **Fixed Left Sidebar** — Persistent navigation anchors the interface; users always know where they are
- **Vertical Menu Items** — Icon + label pairs stacked vertically; icon on left for quick visual scanning
- **Full-Height Sidebar** — Extends from top to bottom; logo/branding at top, menu items below, optional user section at bottom
- **Content Area** — Flexible main content region that adapts to sidebar presence

### Signature Elements
1. **Icon + Label Pairing** — Each menu item combines a Lucide icon with descriptive text; icons are 20-24px, labels are 14-16px
2. **Left Border Accent** — Active menu item features a 3-4px left border in the accent color (not just background change)
3. **Subtle Elevation** — Hover state includes a very light shadow or background color shift to indicate interactivity

### Interaction Philosophy
- **Instant Feedback** — Hover effects appear immediately; active states are always visible
- **No Surprises** — Menu items navigate directly; no hidden dropdowns or complex interactions
- **Mobile Consideration** — Sidebar collapses to hamburger menu on small screens; navigation remains accessible

### Animation
- **Hover Transitions** — 150-200ms ease-in-out for background color and border changes
- **Active State** — Instant visual feedback; no delay
- **Page Transitions** — Subtle fade-in (100-150ms) when navigating between sections
- **Icon Animations** — Icons remain static; text labels may have slight opacity transitions on hover

### Typography System
- **Font Family**: System fonts or 'Segoe UI', 'Roboto', sans-serif — clean, modern, highly legible
- **Sidebar Labels**: 14px, weight 500 (medium) — clear and readable without being bold
- **Active Label**: 14px, weight 600 (semibold) — subtle emphasis for current section
- **Main Content Headings**: 24-32px, weight 700 (bold) — establishes hierarchy
- **Body Text**: 14-16px, weight 400 (regular) — comfortable reading for forms and data

---

## Implementation Notes
- Use Lucide React icons for consistency with the template
- Tailwind CSS for styling; leverage custom color tokens in `index.css`
- React Router (Wouter) for navigation
- Responsive design: sidebar visible on desktop (≥1024px), collapses to hamburger on mobile
