import { formatCurrency } from "@/lib/utils";
import {
  LEADNET_FOLLOW_UP,
  WEBSITE_CARE,
  WEBSITE_PACKAGES,
} from "@/lib/leadnet-offer";

/** Fixed 1080x1920 (9:16) social asset for the website-first LeadNet offer. */
export function LeadNetSocialComparison() {
  return (
    <div
      className="relative overflow-hidden bg-black text-foreground select-none"
      style={{ width: 1080, height: 1920 }}
    >
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(34,211,238,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34,211,238,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />
      <div className="relative z-10 flex h-full flex-col px-14 py-16">
        <div className="text-center">
          <p className="font-mono text-[22px] uppercase tracking-[0.22em] text-accent">
            Intent Revenue
          </p>
          <h1 className="mt-4 text-[76px] font-bold leading-none tracking-tight">
            LeadNet Websites
          </h1>
          <p className="mx-auto mt-5 max-w-[820px] text-[31px] leading-snug text-zinc-300">
            Professional business websites with optional follow-up software.
          </p>
        </div>

        <div className="mt-14 grid flex-1 content-center gap-8">
          <PricePanel
            title="Business Website"
            pages={`Up to ${WEBSITE_PACKAGES.business.pageLimit} pages`}
            monthly={`${formatCurrency(WEBSITE_PACKAGES.business.monthly.setupCents)} setup + ${formatCurrency(WEBSITE_PACKAGES.business.monthly.recurringCents)}/mo`}
            upfront={formatCurrency(WEBSITE_PACKAGES.business.upfrontCents)}
          />
          <PricePanel
            title="Expanded Website"
            pages={`Up to ${WEBSITE_PACKAGES.expanded.pageLimit} pages`}
            monthly={`${formatCurrency(WEBSITE_PACKAGES.expanded.monthly.setupCents)} setup + ${formatCurrency(WEBSITE_PACKAGES.expanded.monthly.recurringCents)}/mo`}
            upfront={formatCurrency(WEBSITE_PACKAGES.expanded.upfrontCents)}
          />
          <div className="rounded-[28px] border-2 border-accent bg-accent/10 p-8">
            <p className="font-mono text-[18px] uppercase tracking-wider text-accent">
              Optional add-ons
            </p>
            <p className="mt-4 text-[34px] font-bold">
              LeadNet Follow-Up: {formatCurrency(LEADNET_FOLLOW_UP.monthlyCents)}/mo at activation
            </p>
            <p className="mt-3 text-[27px] text-zinc-300">
              Website Care for upfront buyers: {formatCurrency(WEBSITE_CARE.monthlyCents)}/mo at hosting activation
            </p>
            <p className="mt-5 text-[23px] leading-relaxed text-zinc-400">
              No minimum subscription term. No 12-payment website plan. Future
              activation subscriptions are not charged at website checkout.
            </p>
          </div>
        </div>

        <p className="mt-10 text-center font-mono text-[28px] font-semibold text-accent">
          intentrev.net/leadnet
        </p>
      </div>
    </div>
  );
}

function PricePanel({
  title,
  pages,
  monthly,
  upfront,
}: {
  title: string;
  pages: string;
  monthly: string;
  upfront: string;
}) {
  return (
    <div className="rounded-[28px] border border-zinc-700/80 bg-zinc-950/90 p-8">
      <p className="text-[44px] font-bold">{title}</p>
      <p className="mt-2 font-mono text-[18px] uppercase tracking-wider text-zinc-400">{pages}</p>
      <div className="mt-6 grid grid-cols-2 gap-5">
        <div className="rounded-2xl border border-accent/35 bg-accent/10 p-6">
          <p className="font-mono text-[16px] uppercase tracking-wider text-accent">Monthly</p>
          <p className="mt-2 text-[32px] font-bold text-white">{monthly}</p>
        </div>
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900/70 p-6">
          <p className="font-mono text-[16px] uppercase tracking-wider text-zinc-400">Upfront</p>
          <p className="mt-2 text-[40px] font-bold text-white">{upfront}</p>
        </div>
      </div>
    </div>
  );
}
