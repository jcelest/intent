"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import {
  calculateCommercialPartnershipsOrder,
  type B2BCustomerDetails,
} from "@/lib/b2b-offer";

export function B2BBeginFlow({
  initialValues,
  stripeReady,
}: {
  initialValues: {
    company?: string;
    name?: string;
    email?: string;
    phone?: string;
    trade?: string;
    serviceArea?: string;
    scopeLimits?: string;
    targetAccounts?: number;
  };
  stripeReady: boolean;
}) {
  const [details, setDetails] = useState<B2BCustomerDetails>({
    company: initialValues.company ?? "",
    name: initialValues.name ?? "",
    email: initialValues.email ?? "",
    phone: initialValues.phone ?? "",
    trade: initialValues.trade,
    serviceArea: initialValues.serviceArea,
    scopeLimits: initialValues.scopeLimits,
    targetAccounts: initialValues.targetAccounts ?? 3,
  });
  const [loading, setLoading] = useState(false);

  const order = useMemo(
    () => calculateCommercialPartnershipsOrder(details.targetAccounts || 3),
    [details.targetAccounts]
  );

  function setField<K extends keyof B2BCustomerDetails>(
    key: K,
    value: B2BCustomerDetails[K]
  ) {
    setDetails((current) => ({ ...current, [key]: value }));
  }

  function onContinue(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    const payload = {
      flow: "b2b",
      product: "commercial-partnerships",
      order,
      details,
    };
    sessionStorage.setItem("intent-b2b-begin", JSON.stringify(payload));
    sessionStorage.setItem("intent-begin", JSON.stringify(payload));
    window.location.href = "/b2b/begin/agreement";
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_0.88fr]">
      <form onSubmit={onContinue} className="rounded-xl border border-accent/35 bg-card/90 p-5 sm:p-7">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
          Commercial Partnerships
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">
          Confirm your details
        </h2>
        <p className="mt-1 text-sm text-foreground/75 leading-relaxed">
          Review or edit your contact information below. Detailed onboarding information (trade, service area, rate sheet, and licenses) is collected after checkout.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Company name">
            <Input
              required
              autoComplete="organization"
              placeholder="e.g. Acme Heating & Cooling LLC"
              value={details.company}
              onChange={(event) => setField("company", event.target.value)}
            />
          </Field>
          <Field label="Signer name">
            <Input
              required
              autoComplete="name"
              placeholder="e.g. John Doe"
              value={details.name}
              onChange={(event) => setField("name", event.target.value)}
            />
          </Field>
          <Field label="Email address">
            <Input
              required
              type="email"
              autoComplete="email"
              placeholder="e.g. john@acme.com"
              value={details.email}
              onChange={(event) => setField("email", event.target.value)}
            />
          </Field>
          <Field label="Phone number">
            <Input
              required
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="e.g. (407) 555-0199"
              value={details.phone}
              onChange={(event) => setField("phone", event.target.value)}
            />
          </Field>
        </div>

        <Button
          type="submit"
          className="mt-6 w-full"
          size="lg"
          disabled={!stripeReady || loading}
        >
          {!stripeReady ? "Checkout not configured" : loading ? "One moment..." : "Review agreement"}
        </Button>
        <p className="mt-4 text-center text-xs leading-relaxed text-muted">
          Do not enter passwords here. Subject to{" "}
          <Link href="/terms" className="text-accent hover:underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-accent hover:underline">
            Privacy Policy
          </Link>.
        </p>
      </form>

      <aside className="rounded-xl border border-white/15 bg-oled p-5 sm:p-7">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
          Order summary
        </p>
        <p className="mt-4 text-sm uppercase tracking-[0.12em] text-muted">Due today</p>
        <p className="mt-1 text-5xl font-semibold text-accent">{formatCurrency(order.dueTodayCents)}</p>
        <p className="mt-1 text-xs text-muted">One-time start payment before outreach begins</p>

        <div className="mt-5 space-y-3">
          <Line label="Campaign Package" amount="Commercial Partnerships" />
          <Line label="Target Outcome" amount={`${order.targetAccountCount} commercial accounts`} />
          <Line label="Total Campaign Fee" amount={formatCurrency(order.totalPriceCents)} />
          <Line label="Due Today (Start Payment)" amount={formatCurrency(order.dueTodayCents)} />
          <Line label="Completion Payment (Milestone)" amount={formatCurrency(order.completionFeeCents)} />
        </div>

        <div className="mt-6 border-t border-white/10 pt-5 text-sm leading-relaxed text-foreground/75 space-y-3">
          <p>
            <strong className="text-foreground">Payment Structure:</strong> $2,000 start payment due today. Remaining $2,000 completion payment due only when the 3rd target account reaches Onboarded status. Handled outside this flow with no automatic recurring charges.
          </p>
          <p>
            <strong className="text-foreground">Onboarded Definition:</strong> An account counts as Onboarded when its vendor packet is approved in writing, COI, W-9, and license are accepted, a named dispatch contact is confirmed, and the work-order route is known.
          </p>
          <p>
            <strong className="text-foreground">30-Day Trajectory Guarantee:</strong> Full $2,000 start payment is refunded if by Day 30 the client does not have at least 1 account Onboarded plus 1 more in active onboarding, or 2 accounts Onboarded.
          </p>
          <p>
            <strong className="text-foreground">Day 1 Rule:</strong> Day 1 of the 30 days begins only when the start payment has cleared and client provides COI, W-9, license, and rate sheet.
          </p>
          <p>
            <strong className="text-foreground">Weekly Updates:</strong> Provider will send Client a written update each Friday during the campaign listing decision makers reached, packets submitted, and accounts Onboarded.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="block font-mono text-xs uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  );
}

function Line({ label, amount }: { label: string; amount: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-foreground/70">{label}</span>
      <span className="shrink-0 font-semibold text-foreground">{amount}</span>
    </div>
  );
}
