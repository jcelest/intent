# Intent — The AI Growth Engine (V2)

A high-conversion, dark-mode agency site with a software terminal aesthetic. Built for sub-second speed and aggressive visual impact.

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Animations:** Framer Motion
- **Backend:** FastAPI (Python) for AI Voice/Text agent orchestration

## Quick Start

### Frontend

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Backend (Test the AI)

```bash
cd api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Project Structure

```
src/
├── app/              # Next.js App Router
├── components/
│   ├── ui/           # Primitives (Button, Input, LiveTerminal)
│   └── sections/     # Major blocks (Hero, Bento, Dashboard, Test AI)
└── lib/              # Utilities
api/
├── main.py           # FastAPI orchestration layer
└── requirements.txt
```

## Design System

- **Palette:** OLED Black (#000000), Slate-950 (#020617), Cyan-400 (#22d3ee)
- **Fonts:** Outfit (display), JetBrains Mono (technical)
- **Effects:** Noise texture, bento grid, shimmer borders, cyan glow

## Environment

Copy `.env.example` to `.env.local` and configure:

- `NEXT_PUBLIC_API_URL` — FastAPI base URL (default: http://localhost:8000)
- `VAPI_API_KEY` — For production Vapi outbound calls (optional)
