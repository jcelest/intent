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

export function BeginFlow({
  capture,
  launchpad,
  partnership,
  initialPath,
  initialAddons,
  stripeReady,
  docusignReady,
}: {
  capture: Engagement;
  launchpad: Engagement;
  partnership: Engagement;
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
        : capture;
  const open = stripeReady && engagement.amountCents !== null;
  const gold = path === "launchpad";

  return (
    <div className="mx-auto max-w-xl">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <PathButton
          active={path === "capture"}
          tone="cyan"
          label="LeadNet"
          onClick={() => setPath("capture")}
        />
        <PathButton
          active={path === "launchpad"}
          tone="gold"
          label="Launchpad"
          onClick={() => setPath("launchpad")}
        />
        <PathButton
          active={path === "partnership"}
          tone="cyan"
          label="Partnership"
          onClick={() => setPath("partnership")}
        />
      </div>

      <div
        className={cn(
          "mt-8 rounded-2xl border p-6 sm:p-8",
          gold
            ? "border-amber-500/35 bg-gradient-to-br from-amber-600/15 via-card to-oled"
            : "border-accent/30 bg-gradient-to-br from-accent/10 via-card to-oled"
        )}
      >
        <p
          className={cn(
            "font-mono text-xs uppercase tracking-[0.2em]",
            gold ? "text-amber-200/80" : "text-accent"
          )}
        >
          {engagement.kicker}
        </p>
        <h2 className="mt-3 text-2xl sm:text-3xl font-semibold text-foreground">
          {engagement.title}
        </h2>
        <p className="mt-3 text-foreground/80 leading-relaxed">
          {engagement.summary}
        </p>
        <ul className="mt-5 space-y-2 text-sm text-foreground/75">
          {engagement.points.map((point) => (
            <li key={point} className="flex gap-2">
              <span className={gold ? "text-amber-300" : "text-accent"}>·</span>
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
                    "w-full rounded-lg border px-3 py-2 text-left text-sm",
                    on ? "border-accent bg-accent/10" : "border-border"
                  )}
                >
                  <span className="font-medium">{addon.label}</span>
                  <span className="float-right font-mono text-accent">
                    {formatCurrency(addon.amountCents)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {open ? (
        <StartForm
          engagement={engagement}
          addons={path === "capture" ? addons : []}
          docusignReady={docusignReady && path === "capture"}
        />
      ) : (
        <div className="mt-8 rounded-2xl border border-border bg-card/70 p-6 text-center">
          <p className="text-foreground/85 leading-relaxed">
            This start path is opened privately after we talk. Tell us about
            the shop first.
          </p>
          <Link
            href="/#get-in-touch"
            className="mt-5 inline-flex font-semibold text-accent hover:underline"
          >
            Apply first
          </Link>
        </div>
      )}
    </div>
  );
}

function PathButton({
  active,
  tone,
  label,
  onClick,
}: {
  active: boolean;
  tone: "gold" | "cyan";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-12 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-colors",
        tone === "gold" && active && "border-amber-400/70 bg-amber-500/15 text-amber-100",
        tone === "gold" && !active && "border-border text-muted hover:border-amber-400/40 hover:text-foreground",
        tone === "cyan" && active && "border-accent bg-accent/10 text-accent",
        tone === "cyan" && !active && "border-border text-muted hover:border-accent/40 hover:text-foreground"
      )}
    >
      {label}
    </button>
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
      <div className="mt-8 rounded-2xl border border-border bg-card/80 p-6 sm:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          Confirm to begin
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
    <form onSubmit={onContinue} className="mt-8 space-y-4">
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
        {loading
          ? "One moment…"
          : docusignReady
            ? "Continue to payment"
            : "Continue"}
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
