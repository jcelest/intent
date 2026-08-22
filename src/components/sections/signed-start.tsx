"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { getEngagement, type CaptureAddonId, type EngagementId } from "@/lib/engagements";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const appearance = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#22d3ee",
    colorBackground: "#020617",
    colorText: "#f8fafc",
    fontFamily: "Space Grotesk, system-ui, sans-serif",
    borderRadius: "8px",
  },
};

export function SignedStart() {
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [returnUrl, setReturnUrl] = useState("");
  const [confirmLabel, setConfirmLabel] = useState("Start LeadNet");

  useEffect(() => {
    const raw = sessionStorage.getItem("intent-begin");
    if (!raw) {
      setError("We could not find the start details. Begin again from LeadNet.");
      return;
    }
    const details = JSON.parse(raw) as {
      path: EngagementId;
      name: string;
      company: string;
      email: string;
      phone: string;
      addons: CaptureAddonId[];
    };
    setConfirmLabel(getEngagement(details.path).confirmLabel);
    fetch("/api/stripe/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.clientSecret) {
          throw new Error(payload.error || "Could not continue.");
        }
        setClientSecret(payload.clientSecret);
        setReturnUrl(payload.returnUrl);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const options = useMemo(
    () =>
      clientSecret
        ? { clientSecret, appearance, loader: "auto" as const }
        : undefined,
    [clientSecret]
  );

  if (error) {
    return <p className="text-center text-red-300">{error}</p>;
  }
  if (!clientSecret || !stripePromise || !options) {
    return <p className="text-center text-muted">Opening confirm…</p>;
  }

  return (
    <div className="rounded-2xl border border-border bg-card/80 p-6 sm:p-8">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
        Agreement signed
      </p>
      <p className="mt-2 text-sm text-foreground/75">
        Confirm to start the work.
      </p>
      <Elements stripe={stripePromise} options={options}>
        <Confirm confirmLabel={confirmLabel} returnUrl={returnUrl} />
      </Elements>
    </div>
  );
}

function Confirm({
  confirmLabel,
  returnUrl,
}: {
  confirmLabel: string;
  returnUrl: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });
    setBusy(false);
    if (result.error) setError(result.error.message ?? "Could not confirm.");
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5">
      <PaymentElement options={{ layout: "tabs" }} />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <Button type="submit" className="w-full" size="lg" disabled={!stripe || busy}>
        {busy ? "Confirming…" : confirmLabel}
      </Button>
    </form>
  );
}
