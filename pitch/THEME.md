# Intent Revenue Pitch Deck — Theme Spec

Match the intentrev.net website aesthetic in PowerPoint, Google Slides, or Keynote.

## Colors (hex)

| Token | Hex | Use |
|-------|-----|-----|
| Background | `#000000` | Slide background |
| Foreground | `#F8FAFC` | Headlines, body |
| Accent | `#22D3EE` | Highlights, links, glow |
| Muted | `#64748B` | Secondary text, footers |
| Card | `#020617` | Content panels |
| Border | `#1E293B` | Panel borders |
| Gold (premium) | `#D9A941` | Core offer / package slides |
| Gold dark | `#78350F` | Gold panel gradient end |

## Fonts

| Role | Font | Weight | Notes |
|------|------|--------|-------|
| Display | [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) | 600–700 | Titles |
| Body | Space Grotesk | 400–500 | Bullets |
| Kicker / label | [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) | 500 | UPPERCASE, letter-spacing 0.2em |

Install both from Google Fonts before building the Slide Master.

## Slide Master layout

1. **Background:** solid `#000000`. Optional: faint cyan grid PNG at 6% opacity (50px grid).
2. **Kicker:** JetBrains Mono, 10–11pt, `#22D3EE`, ALL CAPS, top-left or centered above title.
3. **Title:** Space Grotesk Semibold, 36–44pt, `#F8FAFC`. Accent word in `#22D3EE`.
4. **Body:** Space Grotesk Regular, 18–22pt, `#F8FAFC` at 90% opacity.
5. **Bullets:** use `#22D3EE` circle or numbered badges on `#020617` panels.
6. **Footer:** JetBrains Mono, 9pt, `#64748B` — intentrev.net

## Panel style (content cards)

- Fill: `#020617`
- Border: 2pt `#1E293B`
- Corner radius: 12px (PowerPoint: rounded rectangle)
- Padding: 24px

## Gold panel (package / hero offer)

- Border: 2pt `#D9A941` at 45% opacity
- Fill: gradient `#92400E` → `#020617` (approximate site gold card)
- Text: `#FEF3C7` / amber-100

## Assets (from repo)

| Asset | Path |
|-------|------|
| Logo (SVG) | `public/intent-logo-i1.svg` |
| Logo (SVG) | `Intent Logo i1.svg` (source) · `pitch/assets/intent-logo.svg` (deck) |
| Favicon | `public/favicon-32.png` |
| OG / social | `public/og-image.png` |

## PowerPoint quick setup

1. Design → Slide Size → Widescreen 16:9
2. View → Slide Master → set black background
3. Add title + body placeholders with fonts above
4. Save as `Intent-Revenue-Theme.potx`
5. Paste copy from `SLIDES.md` slide by slide

## Do / Don't

- **Do:** short headlines, cyan accent on one phrase, dark panels, mono kickers
- **Don't:** white slides, stock photos, long paragraphs, em dashes in titles
- **Don't:** clip-art icons; use simple line icons or site SVGs from `public/icons/`
