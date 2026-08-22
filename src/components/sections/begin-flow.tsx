"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import {
  CAPTURE_ADDONS,
  type CaptureAddonId,
  type Engagement,
  type EngagementId,
} from "@/lib/engagements";
import {
  CaptureFlowVisual,
  PartnershipVisual,
  RevenueStreamsVisual,
  SoftwareStackVisual,
} from "@/components/visuals/package-visuals";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const appearance = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#22d3ee",
    colorBackground: "#020617",
    colorText: "#f8fafc",
    colorDanger: "#f87171",
    fontFamily: "Space Grotesk, system-ui, sans-serif",
    borderRadius: "8px",
    spacingUnit: "4px",
  },
  rules: {
    ".Label": {
      color: "#64748b",
      fontSize: "11px",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
    },
    ".Input": {
      backgroundColor: "#000000",
      border: "1px solid #1e293b",
    },
  },
};

const THEMES: Record<
  EngagementId,
  {
    card: string;
    kicker: string;
    mark: string;
    btnActive: string;
    btnIdle: string;
    apply: string;
    applyHover: string;
  }
> = {
  capture: {
    card: "border-2 border-accent/45 bg-gradient-to-br from-cyan-400/20 via-card to-oled shadow-[0_0_48px_rgba(34,211,238,0.18)]",
    kicker: "text-accent",
    mark: "text-accent",
    btnActive:
      "border-accent bg-accent/15 text-accent shadow-[0_0_24px_rgba(34,211,238,0.2)]",
    btnIdle: "border-border text-muted hover:border-accent/40 hover:text-foreground",
    apply: "bg-accent text-oled",
    applyHover: "hover:bg-cyan-300",
  },
  launchpad: {
    card: "border-2 border-amber-500/45 bg-gradient-to-br from-amber-600/40 via-amber-900/88 to-amber-950/95 shadow-[0_0_48px_rgba(217,169,65,0.2)]",
    kicker: "text-amber-200/90",
    mark: "text-amber-300",
    btnActive: "border-amber-400/70 bg-amber-500/15 text-amber-100",
    btnIdle:
      "border-border text-muted hover:border-amber-400/40 hover:text-foreground",
    apply: "bg-amber-400 text-oled",
    applyHover: "hover:bg-amber-300",
  },
  partnership: {
    card: "border-2 border-cyan-200/30 bg-gradient-to-br from-cyan-400/15 via-slate-950 to-amber-950/80 shadow-[0_0_48px_rgba(34,211,238,0.12)]",
    kicker: "text-cyan-100",
    mark: "text-cyan-200",
    btnActive:
      "border-cyan-200/70 bg-cyan-400/10 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.16)]",
    btnIdle:
      "border-border text-muted hover:border-cyan-200/40 hover:text-foreground",
    apply: "bg-cyan-100 text-oled",
    applyHover: "hover:bg-white",
  },
  custom: {
    card: "border-2 border-slate-400/40 bg-gradient-to-br from-slate-300/15 via-card to-oled shadow-[0_0_40px_rgba(148,163,184,0.14)]",
    kicker: "text-slate-200",
    mark: "text-slate-200",
    btnActive:
      "border-slate-300/70 bg-slate-400/15 text-slate-100 shadow-[0_0_20px_rgba(148,163,184,0.16)]",
    btnIdle:
      "border-border text-muted hover:border-slate-400/40 hover:text-foreground",
    apply: "bg-slate-200 text-oled",
    applyHover: "hover:bg-white",
  },
};

export function BeginFlow({
  capture,
  launchpad,
  partnership,
  custom,
  initialPath,
  initialAddons,
  stripeReady,
  docusignReady,
}: {
  capture: Engagement;
  launchpad: Engagement;
  partnership: Engagement;
  custom: Engagement;
  initialPath: EngagementId;
  initialAddons: CaptureAddonId[];
  stripeReady: boolean;
  docusignReady: boolean;
}) {
  const [path, setPath] = useState<EngagementId>(initialPath);
  const [addons, setAddons] = useState<CaptureAddonId[]>(initialAddons);
  const engagement =
    path === "partnership"
      ? partnership
      : path === "launchpad"
        ? launchpad
        : path === "custom"
          ? custom
          : capture;
  const theme = THEMES[path];
  const checkoutOpen = stripeReady && path === "capture" && capture.amountCents !== null;
  const total =
    (capture.amountCents ?? 99900) +
    CAPTURE_ADDONS.filter((addon) => addons.includes(addon.id)).reduce(
      (sum, addon) => sum + addon.amountCents,
      0
    );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <PathButton
          active={path === "capture"}
          className={path === "capture" ? THEMES.capture.btnActive : THEMES.capture.btnIdle}
          label="LeadNet"
          onClick={() => setPath("capture")}
        />
        <PathButton
          active={path === "launchpad"}
          className={
            path === "launchpad" ? THEMES.launchpad.btnActive : THEMES.launchpad.btnIdle
          }
          label="Launchpad"
          onClick={() => setPath("launchpad")}
        />
        <PathButton
          active={path === "partnership"}
          className={
            path === "partnership"
              ? THEMES.partnership.btnActive
              : THEMES.partnership.btnIdle
          }
          label="Partnership"
          onClick={() => setPath("partnership")}
        />
        <PathButton
          active={path === "custom"}
          className={path === "custom" ? THEMES.custom.btnActive : THEMES.custom.btnIdle}
          label="Custom"
          onClick={() => setPath("custom")}
        />
      </div>

      <div className={cn("mt-8 rounded-2xl border p-6 sm:p-8", theme.card)}>
        <p className={cn("font-mono text-xs uppercase tracking-[0.2em]", theme.kicker)}>
          {engagement.kicker}
        </p>
        <h2 className="mt-3 text-2xl sm:text-3xl font-semibold text-foreground">
          {engagement.title}
        </h2>
        <p className="mt-3 text-foreground/85 leading-relaxed">{engagement.summary}</p>
        <div className="mt-6 opacity-90">
          {path === "capture" ? (
            <CaptureFlowVisual />
          ) : path === "launchpad" ? (
            <RevenueStreamsVisual />
          ) : path === "partnership" ? (
            <PartnershipVisual />
          ) : (
            <SoftwareStackVisual tone="cyan" />
          )}
        </div>
        {path === "capture" ? (
          <div className="mt-6">
            <p className="text-5xl sm:text-6xl font-semibold tracking-tight text-accent">
              {formatCurrency(99900)}
            </p>
            <p className="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-muted">
              sprint
            </p>
          </div>
        ) : null}
        <ul className="mt-6 space-y-3 text-sm text-foreground/80">
          {engagement.points.map((point) => (
            <li key={point} className="flex gap-3">
              <span className={cn("mt-0.5 font-semibold", theme.mark)} aria-hidden>
                ▸
              </span>
              {point}
            </li>
          ))}
        </ul>
        {path === "capture" ? (
          <div className="mt-6 space-y-2">
            {CAPTURE_ADDONS.map((addon) => {
              const on = addons.includes(addon.id);
              return (
                <button
                  key={addon.id}
                  type="button"
                  onClick={() =>
                    setAddons((current) =>
                      on
                        ? current.filter((id) => id !== addon.id)
                        : [...current, addon.id]
                    )
                  }
                  className={cn(
                    "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                    on
                      ? "border-accent bg-accent/15"
                      : "border-white/10 hover:border-accent/40"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{addon.label}</p>
                      <p className="mt-1 text-sm text-foreground/65">{addon.detail}</p>
                    </div>
                    <p className="text-xl font-semibold tracking-tight text-accent shrink-0">
                      {formatCurrency(addon.amountCents)}
                    </p>
                  </div>
                </button>
              );
            })}
            <p className="pt-3 font-mono text-xs uppercase tracking-[0.18em] text-muted">
              Due to start
            </p>
            <p className="text-4xl font-semibold tracking-tight text-accent">
              {formatCurrency(total)}
            </p>
          </div>
        ) : null}
      </div>

      {checkoutOpen ? (
        <StartForm
          engagement={engagement}
          addons={addons}
          docusignReady={docusignReady}
        />
      ) : (
        <ApplyCard path={path} theme={theme} label={engagement.confirmLabel} />
      )}
    </div>
  );
}

function PathButton({
  active,
  className,
  label,
  onClick,
}: {
  active: boolean;
  className: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-12 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-colors",
        className
      )}
    >
      {label}
    </button>
  );
}

function ApplyCard({
  path,
  theme,
  label,
}: {
  path: EngagementId;
  theme: (typeof THEMES)[EngagementId];
  label: string;
}) {
  const href =
    path === "launchpad" ? "/qualification#intent-launchpad" : "/#get-in-touch";
  const copy =
    path === "launchpad"
      ? "Launchpad opens after we see the shop. Start with qualification."
      : path === "partnership"
        ? "Partnership starts after we talk. Tell us about the shop."
        : path === "custom"
          ? "Tell us what you need. We write the scope before we build."
          : "Stripe is not open on this path yet.";

  return (
    <div className={cn("mt-8 rounded-2xl border p-6 sm:p-8 text-center", theme.card)}>
      <p className="text-foreground/85 leading-relaxed">{copy}</p>
      <Link
        href={href}
        className={cn(
          "mt-6 inline-flex w-full items-center justify-center rounded-lg px-8 py-4 text-lg font-semibold",
          theme.apply,
          theme.applyHover
        )}
      >
        {label}
      </Link>
    </div>
  );
}

function StartForm({
  engagement,
  addons,
  docusignReady,
}: {
  engagement: Engagement;
  addons: CaptureAddonId[];
  docusignReady: boolean;
}) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [returnUrl, setReturnUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const options = useMemo(
    () =>
      clientSecret
        ? { clientSecret, appearance, loader: "auto" as const }
        : undefined,
    [clientSecret]
  );

  async function onContinue(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const details = { path: engagement.id, name, company, email, phone, addons };
    sessionStorage.setItem("intent-begin", JSON.stringify(details));

    const response = await fetch("/api/stripe/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
    });
    const payload = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok || !payload.clientSecret) {
      setError(payload.error ?? "Could not continue. Try again.");
      return;
    }
    setClientSecret(payload.clientSecret);
    setReturnUrl(payload.returnUrl);
  }

  if (clientSecret && stripePromise && options) {
    return (
      <div className="mt-8 rounded-2xl border-2 border-accent/45 bg-gradient-to-br from-cyan-400/15 via-card to-oled p-6 sm:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
          Payment
        </p>
        <p className="mt-2 text-sm text-foreground/75 leading-relaxed">
          {docusignReady
            ? "Pay now. After that you will sign the LeadNet agreement."
            : "Software we build stays with Intent unless a signed contract says otherwise."}
        </p>
        <Elements stripe={stripePromise} options={options}>
          <ConfirmStep
            confirmLabel={engagement.confirmLabel}
            returnUrl={returnUrl}
          />
        </Elements>
      </div>
    );
  }

  return (
    <form
      onSubmit={onContinue}
      className="mt-8 space-y-4 rounded-2xl border-2 border-accent/30 bg-card/80 p-6 sm:p-8"
    >
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
        Shop details
      </p>
      <Field label="Your name">
        <Input
          required
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <Field label="Shop name">
        <Input
          required
          autoComplete="organization"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
        />
      </Field>
      <Field label="Email">
        <Input
          required
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <Field label="Phone">
        <Input
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </Field>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? "One moment…" : "Continue to payment"}
      </Button>
      <p className="text-center text-xs text-muted leading-relaxed">
        By continuing you agree to the{" "}
        <Link href="/terms" className="text-accent hover:underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-accent hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}

function ConfirmStep({
  confirmLabel,
  returnUrl,
}: {
  confirmLabel: string;
  returnUrl: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onConfirm(event: FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });
    setBusy(false);
    if (result.error) {
      setError(result.error.message ?? "Could not confirm. Try again.");
    }
  }

  return (
    <form onSubmit={onConfirm} className="mt-6 space-y-5">
      <PaymentElement options={{ layout: "tabs" }} />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={!stripe || busy}
      >
        {busy ? "Confirming…" : confirmLabel}
      </Button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="block font-mono text-xs uppercase tracking-wider text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
