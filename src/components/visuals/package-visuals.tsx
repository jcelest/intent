import { cn } from "@/lib/utils";

type VisualProps = {
  className?: string;
  tone?: "cyan" | "gold" | "diamond";
};

function palette(tone: VisualProps["tone"] = "cyan") {
  if (tone === "gold") {
    return {
      line: "#fbbf24",
      glow: "#f59e0b",
      dim: "rgba(251, 191, 36, 0.25)",
      fill: "rgba(251, 191, 36, 0.12)",
    };
  }
  if (tone === "diamond") {
    return {
      line: "#f8fafc",
      glow: "#e2e8f0",
      dim: "rgba(255, 255, 255, 0.28)",
      fill: "rgba(255, 255, 255, 0.12)",
    };
  }
  return {
    line: "#22d3ee",
    glow: "#67e8f9",
    dim: "rgba(34, 211, 238, 0.25)",
    fill: "rgba(34, 211, 238, 0.12)",
  };
}

export function PackageHeroVisual({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 720 280"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full h-auto", className)}
      aria-hidden
    >
      <defs>
        <radialGradient id="hero-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hero-line" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <circle cx="360" cy="140" r="120" fill="url(#hero-glow)" />
      <ellipse cx="360" cy="140" rx="210" ry="78" stroke="#22d3ee" strokeOpacity="0.35" strokeWidth="1.5" />
      <ellipse cx="360" cy="140" rx="210" ry="78" stroke="#22d3ee" strokeOpacity="0.2" strokeWidth="1.5" transform="rotate(60 360 140)" />
      <ellipse cx="360" cy="140" rx="210" ry="78" stroke="#f59e0b" strokeOpacity="0.25" strokeWidth="1.5" transform="rotate(-60 360 140)" />
      <circle cx="360" cy="140" r="28" stroke="url(#hero-line)" strokeWidth="2.5" />
      <path
        d="M360 118v18l8 12"
        stroke="#22d3ee"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="168" cy="86" r="8" fill="#22d3ee" />
      <circle cx="552" cy="86" r="8" fill="#f59e0b" />
      <circle cx="150" cy="188" r="6" fill="#22d3ee" fillOpacity="0.7" />
      <circle cx="570" cy="196" r="6" fill="#f59e0b" fillOpacity="0.7" />
      <path d="M176 90c40 8 70 22 120 38" stroke="#22d3ee" strokeOpacity="0.5" />
      <path d="M544 90c-40 8-70 22-120 38" stroke="#f59e0b" strokeOpacity="0.5" />
      <rect x="86" y="118" width="64" height="92" rx="10" stroke="#22d3ee" strokeOpacity="0.7" />
      <rect x="94" y="128" width="48" height="28" rx="4" fill="#22d3ee" fillOpacity="0.15" />
      <path d="M102 168h32M102 178h22" stroke="#22d3ee" strokeOpacity="0.7" />
      <rect x="568" y="112" width="86" height="58" rx="8" stroke="#f59e0b" strokeOpacity="0.7" />
      <path d="M582 150v-18l12 10 12-16v24" stroke="#f59e0b" strokeWidth="2" strokeLinejoin="round" />
      <path d="M248 236h224" stroke="#22d3ee" strokeOpacity="0.25" />
      <text x="360" y="258" textAnchor="middle" fill="#64748b" fontSize="11" fontFamily="ui-monospace, monospace">
        REVENUE SYSTEM
      </text>
    </svg>
  );
}

export function RevenueStreamsVisual({ className, tone = "gold" }: VisualProps) {
  const c = palette(tone);
  return (
    <svg viewBox="0 0 320 120" className={cn("w-full h-auto", className)} aria-hidden fill="none">
      <path d="M20 60h70" stroke={c.line} strokeWidth="2" />
      <circle cx="20" cy="60" r="5" fill={c.line} />
      <path d="M90 60c18-28 38-28 56-28h40" stroke={c.line} strokeWidth="2" />
      <path d="M90 60c18 0 38 0 56 0h40" stroke={c.glow} strokeWidth="2" />
      <path d="M90 60c18 28 38 28 56 28h40" stroke={c.line} strokeOpacity="0.6" strokeWidth="2" />
      <rect x="186" y="18" width="52" height="22" rx="6" stroke={c.line} />
      <rect x="186" y="49" width="52" height="22" rx="6" stroke={c.glow} />
      <rect x="186" y="80" width="52" height="22" rx="6" stroke={c.line} strokeOpacity="0.7" />
      <path d="M238 29h28c12 0 18 8 18 16v30c0 8-6 16-18 16h-28" stroke={c.line} strokeOpacity="0.5" />
      <circle cx="292" cy="60" r="14" stroke={c.line} strokeWidth="2" />
      <path d="M292 52v16M286 60h12" stroke={c.line} strokeWidth="2" />
    </svg>
  );
}

export function SoftwareStackVisual({ className, tone = "gold" }: VisualProps) {
  const c = palette(tone);
  return (
    <svg viewBox="0 0 320 120" className={cn("w-full h-auto", className)} aria-hidden fill="none">
      <rect x="28" y="18" width="54" height="84" rx="10" stroke={c.line} strokeWidth="2" />
      <rect x="36" y="28" width="38" height="22" rx="3" fill={c.fill} />
      <circle cx="55" cy="88" r="4" stroke={c.line} />
      <rect x="108" y="24" width="180" height="76" rx="10" stroke={c.glow} strokeWidth="2" />
      <path d="M124 44h48M124 56h72M124 68h40" stroke={c.line} strokeOpacity="0.8" />
      <rect x="220" y="40" width="50" height="44" rx="6" fill={c.fill} />
      <path d="M230 74v-22l10 8 10-12v26" stroke={c.glow} strokeWidth="2" />
    </svg>
  );
}

export function OrganicSearchVisual({ className, tone = "cyan" }: VisualProps) {
  const c = palette(tone);
  return (
    <svg viewBox="0 0 320 120" className={cn("w-full h-auto", className)} aria-hidden fill="none">
      <circle cx="86" cy="52" r="28" stroke={c.line} strokeWidth="2" />
      <path d="M106 72l22 22" stroke={c.line} strokeWidth="3" strokeLinecap="round" />
      <path d="M168 92v-28M196 92V44M224 92V56M252 92V32" stroke={c.line} strokeWidth="8" strokeLinecap="round" />
      <path d="M164 88h96" stroke={c.dim} />
    </svg>
  );
}

export function PaidAdsVisual({ className, tone = "cyan" }: VisualProps) {
  const c = palette(tone);
  return (
    <svg viewBox="0 0 320 120" className={cn("w-full h-auto", className)} aria-hidden fill="none">
      <circle cx="160" cy="60" r="10" fill={c.line} />
      <circle cx="160" cy="60" r="28" stroke={c.line} strokeOpacity="0.8" />
      <circle cx="160" cy="60" r="46" stroke={c.line} strokeOpacity="0.4" />
      <circle cx="160" cy="60" r="64" stroke={c.line} strokeOpacity="0.2" />
      <path d="M160 18v12M160 90v12M96 60h12M212 60h12" stroke={c.glow} strokeLinecap="round" />
    </svg>
  );
}

export function PartnershipVisual({ className, tone = "diamond" }: VisualProps) {
  const c = palette(tone);
  return (
    <svg viewBox="0 0 320 120" className={cn("w-full h-auto", className)} aria-hidden fill="none">
      <defs>
        <linearGradient id="gem-fill" x1="0.2" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="45%" stopColor="#67e8f9" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      <path
        d="M160 10 L214 48 L160 110 L106 48 Z"
        fill="url(#gem-fill)"
        stroke={c.line}
        strokeWidth="2"
      />
      <path d="M106 48h108" stroke={c.line} strokeWidth="1.5" />
      <path d="M160 10 L160 110" stroke={c.glow} strokeWidth="1.25" strokeOpacity="0.85" />
      <path d="M160 10 L128 48 L160 110 M160 10 L192 48 L160 110" stroke={c.dim} />
      <circle cx="160" cy="48" r="3.5" fill={c.line} />
    </svg>
  );
}

function FlowLabel({
  x,
  children,
}: {
  x: number;
  children: string;
}) {
  return (
    <text
      x={x}
      y="168"
      textAnchor="middle"
      fill="#94a3b8"
      fontSize="13"
      letterSpacing="0.14em"
      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
    >
      {children}
    </text>
  );
}

export function CaptureFlowVisual({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 720 200"
      className={cn("w-full h-auto", className)}
      aria-hidden
      fill="none"
    >
      <defs>
        <linearGradient id="ln-rail" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.2" />
          <stop offset="55%" stopColor="#22d3ee" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      <path d="M162 86h36M246 86h72M366 86h36M450 86h72M570 86h36" stroke="url(#ln-rail)" strokeWidth="1.25" />
      <circle cx="208" cy="86" r="2.25" fill="#22d3ee" fillOpacity="0.8" />
      <circle cx="360" cy="86" r="2.25" fill="#22d3ee" fillOpacity="0.55" />
      <circle cx="512" cy="86" r="2.25" fill="#f59e0b" fillOpacity="0.85" />

      <g>
        <circle
          cx="120"
          cy="86"
          r="40"
          fill="rgba(34,211,238,0.06)"
          stroke="#22d3ee"
          strokeWidth="1.25"
          strokeOpacity="0.8"
        />
        <g
          transform="translate(102.5 68.5) scale(1.45)"
          stroke="#22d3ee"
          strokeWidth="1.15"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
        </g>
        <path
          d="M139 64l10 10M149 64l-10 10"
          stroke="#22d3ee"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <FlowLabel x={120}>MISSED CALL</FlowLabel>
      </g>

      <g>
        <circle
          cx="360"
          cy="86"
          r="40"
          fill="rgba(34,211,238,0.06)"
          stroke="#22d3ee"
          strokeWidth="1.25"
          strokeOpacity="0.8"
        />
        <g
          transform="translate(342.5 68.5) scale(1.45)"
          stroke="#22d3ee"
          strokeWidth="1.15"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </g>
        <path
          d="M350 82h16M350 89h10"
          stroke="#22d3ee"
          strokeWidth="1.45"
          strokeLinecap="round"
        />
        <FlowLabel x={360}>TEXT BACK</FlowLabel>
      </g>

      <g>
        <circle
          cx="600"
          cy="86"
          r="40"
          fill="rgba(245,158,11,0.07)"
          stroke="#f59e0b"
          strokeWidth="1.25"
          strokeOpacity="0.9"
        />
        <g
          transform="translate(582.5 68.5) scale(1.45)"
          stroke="#f59e0b"
          strokeWidth="1.15"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="8" height="9" rx="1.2" />
          <rect x="13" y="3" width="8" height="5" rx="1.2" />
          <rect x="13" y="10" width="8" height="11" rx="1.2" />
          <rect x="3" y="14" width="8" height="7" rx="1.2" />
        </g>
        <path
          d="M624 62.5l1.5 3.1 3.4.4-2.6 2.3.7 3.4-3-1.9-3 1.9.7-3.4-2.6-2.3 3.4-.4z"
          stroke="#f59e0b"
          strokeWidth="1.15"
          strokeLinejoin="round"
          fill="rgba(245,158,11,0.28)"
        />
        <FlowLabel x={600}>DASHBOARD</FlowLabel>
      </g>
    </svg>
  );
}

export function InclusionMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden fill="none">
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeOpacity="0.35" />
      <path d="M10 16.5l4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
