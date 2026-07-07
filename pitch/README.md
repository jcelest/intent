# Intent Revenue Sales Pitch

Three formats, one message. All match the [intentrev.net](https://intentrev.net) aesthetic.

## What's in this folder

| File | Purpose |
|------|---------|
| `SLIDES.md` | Copy-paste slide content + speaker notes for PowerPoint / Google Slides |
| `THEME.md` | Colors, fonts, panel styles, asset paths |
| `index.html` + `deck.css` | Browser presentation (closest match to the website) |
| `generate-pptx.py` | Script that builds `Intent-Revenue-Sales-Pitch.pptx` |
| `Intent-Revenue-Sales-Pitch.pptx` | Generated PowerPoint (after running the script) |

## Option A: Paste into PowerPoint

1. Read `THEME.md` and set up Slide Master (black bg, Space Grotesk, JetBrains Mono kickers).
2. Open `SLIDES.md` and paste one section per slide.
3. Drop in logo from `../Intent Logo i1.svg` (or `pitch/assets/intent-logo.svg`).

## Option B: HTML deck (recommended for live pitch)

You do **not** need to run a local server. Pick whichever fits your situation:

### 1. Live URL (best for sharing and presenting anywhere)

After the site is deployed, open:

**https://intentrev.net/pitch/**

Works on any device with a browser. No install, no terminal. Bookmark it or send the link before a call.

*(Requires a deploy that includes `public/pitch/` — push and deploy like any other site update.)*

### 2. Double-click the file (no server, works offline except fonts/CDN)

1. Open File Explorer → `Desktop\Intent\pitch\`
2. **Double-click** `index.html`
3. It opens in Chrome or Edge. Use arrow keys to present.

Same files also live at `public\pitch\index.html` for deployment.

You need internet once for Google Fonts and Reveal.js (loaded from CDN). Slide content and the logo work from the file on your PC.

### 3. Local server (optional — for editing only)

```bash
npx --yes serve pitch
```

Open the localhost URL shown. Only needed if you are actively changing the deck and want live reload.

The logo sits in a **fixed top navbar** on every slide: large on slide 1, compact on slides 2–12.

**Controls:**
- Arrow keys / space: next slide
- `F`: fullscreen
- `Esc`: slide overview
- `S`: speaker notes (add in Reveal if needed)

**Export PDF:** Print → Save as PDF from the browser (fullscreen first).

## Option C: PowerPoint file

### How to open the `.pptx`

The file is a normal PowerPoint presentation:

**`pitch/Intent-Revenue-Sales-Pitch.pptx`**

**If you have Microsoft PowerPoint (most common on Windows):**
1. Open File Explorer
2. Go to `Desktop\Intent\pitch\`
3. **Double-click** `Intent-Revenue-Sales-Pitch.pptx`
4. It opens in PowerPoint. Press **F5** to start slideshow mode.

**If PowerPoint asks to repair:** click Allow / Open anyway.

**If you don't have PowerPoint:**
- **Free:** Install [LibreOffice](https://www.libreoffice.org/) → open the file in Impress
- **Online:** Upload to [Google Drive](https://drive.google.com) → Open with Google Slides
- **Online:** [office.com](https://www.office.com) with a Microsoft account → upload and open in PowerPoint for the web

**Full path on your machine:**
`C:\Users\J-SHMONEY\Desktop\Intent\pitch\Intent-Revenue-Sales-Pitch.pptx`

### Regenerate after edits

**One-time setup:**

```bash
pip install python-pptx
```

**Generate:**

```bash
python pitch/generate-pptx.py
```

Output: `pitch/Intent-Revenue-Sales-Pitch.pptx`

Re-run the script after editing slide data in `generate-pptx.py`. For best visuals, apply Space Grotesk in PowerPoint after opening (script uses Segoe UI as fallback on Windows).

## Customize

- **Add pricing:** new slide in `SLIDES.md`, `index.html`, and `SLIDES` list in `generate-pptx.py`
- **Case study slide:** duplicate slide 10 (Proof) in all three
- **Prospect name:** add a title slide variant with `[Company Name]` placeholder

## Brand quick reference

- **Name:** Intent Revenue
- **Tagline:** We Grow Revenue. By A Lot.
- **Accent:** `#22D3EE`
- **Background:** `#000000`
