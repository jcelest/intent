import {
  LEADNET_MONTHLY_CENTS,
  LEADNET_PHONE_PATHS,
} from "@/lib/engagements";
import { formatCurrency } from "@/lib/utils";

export function LeadNetPhonePaths({ compact = false }: { compact?: boolean }) {
  return (
    <section
      id="phone-setup"
      className={compact ? "mt-6" : "px-4 sm:px-6 lg:px-8 py-8"}
    >
      <div className={compact ? "" : "max-w-5xl mx-auto"}>
        <h2
          className={
            compact
              ? "text-lg font-semibold"
              : "text-2xl sm:text-3xl font-semibold text-center"
          }
        >
          Two Ways The Phone Can Work
        </h2>
        <p
          className={
            compact
              ? "mt-2 text-sm text-foreground/75 leading-relaxed"
              : "mt-3 max-w-2xl mx-auto text-center text-sm sm:text-base text-foreground/75 leading-relaxed"
          }
        >
          The {formatCurrency(LEADNET_MONTHLY_CENTS)}/month covers the tracking
          number and texts. Choose a setup. Neither is an add-on.
        </p>
        <div
          className={
            compact
              ? "mt-4 grid gap-3 sm:grid-cols-2"
              : "mt-8 grid gap-4 sm:grid-cols-2"
          }
        >
          {LEADNET_PHONE_PATHS.map((path, index) => (
            <article
              key={path.id}
              className={
                index === 0
                  ? "rounded-xl border-2 border-accent/50 bg-oled p-5 sm:p-6"
                  : "rounded-xl border-2 border-white/40 bg-oled p-5 sm:p-6"
              }
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
                {path.kicker}
              </p>
              <h3 className="mt-2 text-lg font-semibold">{path.title}</h3>
              <p className="mt-2 text-sm text-foreground/75 leading-relaxed">
                {path.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
