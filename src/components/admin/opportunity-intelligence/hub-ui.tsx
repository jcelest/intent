import type { OpportunityClassification } from "@/lib/opportunity-hub";

export const classificationMeta: Record<OpportunityClassification, { label: string; className: string; color: string }> = {
  confirmed: { label: "Confirmed", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300", color: "#34d399" },
  timing_based: { label: "Timing-based", className: "border-amber-400/30 bg-amber-400/10 text-amber-200", color: "#fbbf24" },
  asset_based: { label: "Asset-based", className: "border-sky-400/30 bg-sky-400/10 text-sky-300", color: "#38bdf8" },
  relationship: { label: "Relationship", className: "border-violet-400/30 bg-violet-400/10 text-violet-300", color: "#a78bfa" },
  inferred: { label: "Inferred", className: "border-slate-400/25 bg-slate-400/10 text-slate-300", color: "#94a3b8" },
};

export function ClassificationBadge({ classification }: { classification: OpportunityClassification }) {
  const meta = classificationMeta[classification] || classificationMeta.inferred;
  return <span className={`inline-flex border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>{meta.label}</span>;
}

export function ValueDisplay({ documented, estimated }: { documented: number | null; estimated: number | null }) {
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  if (documented !== null) return <span className="text-emerald-300">{formatter.format(documented)} <span className="text-[9px] uppercase text-emerald-400/60">documented</span></span>;
  if (estimated !== null) return <span className="text-sky-300">{formatter.format(estimated)} <span className="text-[9px] uppercase text-sky-400/60">estimate</span></span>;
  return <span className="text-[#5f6871]">Unknown</span>;
}

export function SectionHeading({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col justify-between gap-4 border-b border-white/[0.08] pb-5 md:flex-row md:items-end">
      <div>
        {eyebrow && <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300/80">{eyebrow}</div>}
        <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
        {description && <p className="mt-1 max-w-4xl text-sm leading-6 text-[#8e98a2]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading source-backed intelligence…" }: { label?: string }) {
  return <div className="grid min-h-48 place-items-center border border-white/[0.08] bg-[#0d1014]"><div className="font-mono text-xs text-[#6e7882]"><span className="mr-2 inline-block h-2 w-2 animate-pulse bg-amber-300" />{label}</div></div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="border border-rose-400/20 bg-rose-400/[0.05] p-5 text-sm text-rose-200"><div>{message}</div>{onRetry && <button onClick={onRetry} className="mt-3 border border-rose-300/25 px-3 py-1.5 text-xs hover:bg-rose-300/10">Retry</button>}</div>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="grid min-h-48 place-items-center border border-dashed border-white/10 bg-white/[0.015] p-8 text-center"><div><div className="text-sm font-medium text-[#d2d7dc]">{title}</div><p className="mt-2 max-w-xl text-xs leading-5 text-[#707a84]">{detail}</p></div></div>;
}
