"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";

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

export function ContractPay() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [returnUrl, setReturnUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("intent-begin");
    if (!raw) {
      setError("We could not find your details to open the payment.");
      return;
    }
    const details = JSON.parse(raw);

    fetch("/api/stripe/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.clientSecret) {
          throw new Error(payload.error || "Could not start payment.");
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
    return <p className="text-sm text-red-300 text-center">{error}</p>;
  }

  if (!clientSecret || !stripePromise || !options) {
    return <p className="text-foreground/80 text-center">Loading payment…</p>;
  }

  return (
    <div className="w-full text-left rounded-2xl border-2 border-accent/45 bg-gradient-to-br from-cyan-400/15 via-card to-oled p-6 sm:p-8">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
        Payment
      </p>
      <p className="mt-2 text-sm text-foreground/75 leading-relaxed">
        Complete payment to begin your sprint.
      </p>
      <Elements stripe={stripePromise} options={options}>
        <ConfirmStep confirmLabel="Pay now" returnUrl={returnUrl} />
      </Elements>
    </div>
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
