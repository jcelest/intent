# Logo Manipulation Guide

## Current Setup (PNG)

The logo is used in the navbar and footer via `next/image`, which provides:

- **Responsive sizing** — `sizes` and `className` ensure crisp display on mobile and desktop
- **Optimized loading** — Next.js serves appropriately sized assets
- **Consistent quality** — No pixelation when scaling within the image's resolution

## Making the Logo Easier to Manipulate

### 1. Convert to SVG (Recommended)

**Why SVG:**

| PNG | SVG |
|-----|-----|
| Fixed colors (baked in) | Colors controllable via CSS `fill` or `color` |
| Glow baked into pixels | Glow via `filter`, `drop-shadow`, or SVG `<filter>` |
| Pixelates when scaled up | Infinitely scalable — sharp at any size |
| Hard to animate | Easy to animate (hover, transitions, etc.) |

**How to convert:**

1. **Design tool:** Open the PNG in Figma, Illustrator, or Inkscape → Export as SVG
2. **Auto-trace:** Use [Vectorizer.io](https://vectorizer.io) or [SVGcode](https://svgco.de) to trace the raster image
3. **Manual:** A starter SVG is in `src/components/ui/intent-logo.svg` — refine the paths to match your logo

### 2. Use the SVG in Your Components

Once you have an SVG, you can:

**Option A: Inline SVG component**

```tsx
// src/components/ui/logo-svg.tsx
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 100" className={className}>
      <g fill="currentColor" className="text-accent">
        {/* Top symbol paths */}
      </g>
      <g fill="currentColor" className="text-white">
        {/* Bottom "I" paths */}
      </g>
    </svg>
  );
}
```

Then style with Tailwind:

```tsx
<Logo className="h-8 w-auto text-accent hover:text-cyan-300 transition-colors" />
```

**Option B: CSS variables for theming**

```tsx
<svg style={{ '--logo-accent': '#22d3ee', '--logo-text': '#ffffff' } as React.CSSProperties}>
  <path fill="var(--logo-accent)" d="..." />
  <path fill="var(--logo-text)" d="..." />
</svg>
```

### 3. Mobile = Desktop Quality

With SVG, both mobile and desktop get identical sharpness. With PNG:

- Use `next/image` (already in place) for automatic optimization
- Provide a 2x asset (`intent-logo@2x.png`) for retina displays if needed
- Keep `sizes` tuned so the browser doesn’t over-fetch

## Quick Swap: PNG → SVG

To switch the site to an SVG logo:

1. Replace the content of `src/components/ui/logo.tsx` with an inline SVG version
2. Or import the SVG as a React component (e.g. `@svgr/webpack`) and use it in `Logo`
