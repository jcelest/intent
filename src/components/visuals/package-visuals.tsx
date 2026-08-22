import { cn } from "@/lib/utils";

type VisualProps = {
  className?: string;
  tone?: "cyan" | "gold";
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

export function PartnershipVisual({ className, tone = "cyan" }: VisualProps) {
  const c = palette(tone);
  return (
    <svg viewBox="0 0 320 120" className={cn("w-full h-auto", className)} aria-hidden fill="none">
      <circle cx="96" cy="60" r="22" stroke={c.line} strokeWidth="2" />
      <circle cx="224" cy="60" r="22" stroke={c.glow} strokeWidth="2" />
      <path d="M118 60h84" stroke={c.line} strokeWidth="2" />
      <circle cx="160" cy="60" r="7" fill={c.glow} />
      <path d="M96 48c-18-22-44-14-52 8M224 48c18-22 44-14 52 8" stroke={c.dim} />
    </svg>
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
      <rect x="24" y="48" width="140" height="104" rx="16" stroke="#22d3ee" strokeWidth="2" />
      <path d="M70 88c18-22 50-22 68 0" stroke="#22d3ee" strokeWidth="2" />
      <circle cx="94" cy="118" r="5" fill="#22d3ee" />
      <text x="94" y="172" textAnchor="middle" fill="#64748b" fontSize="11" fontFamily="ui-monospace, monospace">
        MISSED CALL
      </text>
      <path d="M176 100h52" stroke="#22d3ee" strokeOpacity="0.6" markerEnd="url(#arrow)" />
      <rect x="240" y="48" width="140" height="104" rx="16" stroke="#22d3ee" strokeWidth="2" />
      <rect x="258" y="70" width="104" height="48" rx="8" fill="rgba(34,211,238,0.12)" />
      <path d="M270 86h80M270 98h52" stroke="#22d3ee" />
      <text x="310" y="172" textAnchor="middle" fill="#64748b" fontSize="11" fontFamily="ui-monospace, monospace">
        TEXT BACK
      </text>
      <path d="M392 100h52" stroke="#22d3ee" strokeOpacity="0.6" />
      <rect x="456" y="48" width="140" height="104" rx="16" stroke="#f59e0b" strokeWidth="2" />
      <rect x="476" y="68" width="100" height="10" rx="2" fill="#f59e0b" fillOpacity="0.4" />
      <rect x="476" y="86" width="72" height="8" rx="2" fill="#f59e0b" fillOpacity="0.25" />
      <rect x="476" y="102" width="88" height="8" rx="2" fill="#f59e0b" fillOpacity="0.25" />
      <text x="526" y="172" textAnchor="middle" fill="#64748b" fontSize="11" fontFamily="ui-monospace, monospace">
        DASHBOARD
      </text>
      <path
        d="M628 78l10 22 24 2-18 16 6 24-22-14-22 14 6-24-18-16 24-2z"
        stroke="#f59e0b"
        strokeWidth="2"
      />
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
