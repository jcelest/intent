"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import {
  calculateLeadNetOrder,
  normalizeLeadNetSelection,
  WEBSITE_PACKAGES,
  type LeadNetCustomerDetails,
  type WebsitePackageId,
  type WebsitePaymentMode,
} from "@/lib/leadnet-offer";
import type { Engagement, EngagementId } from "@/lib/engagements";

export function BeginFlow({
  initialPackageId = "business",
  initialPaymentMode = "monthly",
  initialLeadNetSelected = false,
  initialCareSelected = false,
  stripeReady,
}: {
  capture?: Engagement;
  launchpad?: Engagement;
  partnership?: Engagement;
  custom?: Engagement;
  initialPath?: EngagementId;
  initialAddons?: unknown[];
  initialPackageId?: WebsitePackageId;
  initialPaymentMode?: WebsitePaymentMode;
  initialLeadNetSelected?: boolean;
  initialCareSelected?: boolean;
  stripeReady: boolean;
}) {
  const normalizedInitial = normalizeLeadNetSelection({
    packageId: initialPackageId,
    paymentMode: initialPaymentMode,
    leadNetSelected: initialLeadNetSelected,
    careSelected: initialCareSelected,
  });
  const [packageId, setPackageId] = useState<WebsitePackageId>(normalizedInitial.packageId);
  const [paymentMode, setPaymentMode] = useState<WebsitePaymentMode>(normalizedInitial.paymentMode);
  const [leadNetSelected, setLeadNetSelected] = useState(normalizedInitial.leadNetSelected);
  const [careSelected, setCareSelected] = useState(normalizedInitial.careSelected);
  const [details, setDetails] = useState<LeadNetCustomerDetails>({
    name: "",
    company: "",
    email: "",
    phone: "",
    industry: "",
    domainStatus: "",
    services: "",
    serviceAreas: "",
    brandingAssets: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);

  const order = useMemo(
    () =>
      calculateLeadNetOrder({
        packageId,
        paymentMode,
        leadNetSelected,
        careSelected,
      }),
    [careSelected, leadNetSelected, packageId, paymentMode]
  );

  function setDetail<K extends keyof LeadNetCustomerDetails>(
    key: K,
    value: LeadNetCustomerDetails[K]
  ) {
    setDetails((current) => ({ ...current, [key]: value }));
  }

  function onContinue(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    sessionStorage.setItem(
      "intent-begin",
      JSON.stringify({
        selection: order.selection,
        details,
      })
    );
    window.location.href = "/begin/agreement";
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_0.82fr]">
      <form onSubmit={onContinue} className="rounded-xl border border-accent/35 bg-card/90 p-5 sm:p-7">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
          Website order
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ModeButton active={paymentMode === "monthly"} onClick={() => setPaymentMode("monthly")}>
            Monthly
          </ModeButton>
          <ModeButton active={paymentMode === "upfront"} onClick={() => setPaymentMode("upfront")}>
            Upfront
          </ModeButton>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {(Object.keys(WEBSITE_PACKAGES) as WebsitePackageId[]).map((id) => {
            const item = WEBSITE_PACKAGES[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPackageId(id)}
                className={`rounded-lg border p-4 text-left ${
                  packageId === id ? "border-accent bg-accent/12" : "border-white/15"
                }`}
              >
                <span className="block font-semibold">{item.name}</span>
                <span className="mt-1 block text-sm text-foreground/65">
                  Up to {item.pageLimit} agreed public content pages
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-5 space-y-3">
          <CheckRow
            checked={leadNetSelected}
            onChange={setLeadNetSelected}
            title="LeadNet Follow-Up"
            detail="$149/month beginning at LeadNet activation. No separate setup fee in this website bundle."
          />
          {paymentMode === "upfront" ? (
            <CheckRow
              checked={careSelected}
              onChange={setCareSelected}
              title="Website Care"
              detail="$49/month beginning when hosting service is activated."
            />
          ) : (
            <p className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-foreground/65">
              Monthly managed websites already include hosting, maintenance, and up
              to 30 minutes of content edits per month.
            </p>
          )}
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <Field label="Your name">
            <Input required autoComplete="name" value={details.name} onChange={(event) => setDetail("name", event.target.value)} />
          </Field>
          <Field label="Company name">
            <Input required autoComplete="organization" value={details.company} onChange={(event) => setDetail("company", event.target.value)} />
          </Field>
          <Field label="Email">
            <Input required type="email" autoComplete="email" value={details.email} onChange={(event) => setDetail("email", event.target.value)} />
          </Field>
          <Field label="Phone">
            <Input required type="tel" inputMode="tel" autoComplete="tel" value={details.phone} onChange={(event) => setDetail("phone", event.target.value)} />
          </Field>
          <Field label="Industry">
            <Input required value={details.industry} onChange={(event) => setDetail("industry", event.target.value)} />
          </Field>
          <Field label="Domain status">
            <Input required placeholder="Have one / need one / not sure" value={details.domainStatus} onChange={(event) => setDetail("domainStatus", event.target.value)} />
          </Field>
          <Field label="Services">
            <Input required value={details.services} onChange={(event) => setDetail("services", event.target.value)} />
          </Field>
          <Field label="Service areas">
            <Input required value={details.serviceAreas} onChange={(event) => setDetail("serviceAreas", event.target.value)} />
          </Field>
          <Field label="Branding/assets">
            <Input placeholder="Logo, colors, photos, or none yet" value={details.brandingAssets} onChange={(event) => setDetail("brandingAssets", event.target.value)} />
          </Field>
          <Field label="Notes">
            <Input placeholder="No passwords here" value={details.notes} onChange={(event) => setDetail("notes", event.target.value)} />
          </Field>
        </div>

        <Button type="submit" className="mt-6 w-full" size="lg" disabled={!stripeReady || loading}>
          {!stripeReady ? "Checkout not configured" : loading ? "One moment..." : "Review agreement"}
        </Button>
        <p className="mt-4 text-center text-xs leading-relaxed text-muted">
          Do not enter passwords here. We collect account access through secure
          handoff during onboarding. Subject to{" "}
          <Link href="/terms" className="text-accent hover:underline">Terms</Link>
          {" "}and{" "}
          <Link href="/privacy" className="text-accent hover:underline">Privacy Policy</Link>.
        </p>
      </form>

      <aside className="rounded-xl border border-white/15 bg-oled p-5 sm:p-7">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
          Exact summary
        </p>
        <p className="mt-4 text-sm uppercase tracking-[0.12em] text-muted">Due today</p>
        <p className="mt-1 text-5xl font-semibold text-accent">{formatCurrency(order.dueTodayCents)}</p>
        <div className="mt-5 space-y-3">
          {order.oneTimeCharges.map((charge) => (
            <Line key={charge.id} label={charge.label} amount={formatCurrency(charge.amountCents)} />
          ))}
        </div>
        {order.recurringWebsiteCharges.length ? (
          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="font-semibold">Website renews</p>
            {order.recurringWebsiteCharges.map((charge) => (
              <Line key={charge.id} label={charge.label} amount={`${formatCurrency(charge.amountCents)}/mo`} />
            ))}
          </div>
        ) : null}
        {order.activationCharges.length ? (
          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="font-semibold">Billing starts later</p>
            {order.activationCharges.map((charge) => (
              <Line key={charge.id} label={charge.label} amount={`${formatCurrency(charge.amountCents)}/mo`} />
            ))}
          </div>
        ) : null}
        <div className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm leading-relaxed text-foreground/70">
          <p>{order.ownershipSummary}</p>
          <p>{order.cancellationSummary}</p>
          <p>No minimum subscription term. No 12-payment plan. No automatic price drop or automatic website ownership transfer.</p>
        </div>
      </aside>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-4 py-3 font-semibold ${
        active ? "border-accent bg-accent/15 text-accent" : "border-white/15 text-foreground/75"
      }`}
    >
      {children}
    </button>
  );
}

function CheckRow({
  checked,
  onChange,
  title,
  detail,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  detail: string;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-lg border border-white/10 bg-black/20 p-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 accent-cyan-300"
      />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-sm leading-relaxed text-foreground/65">{detail}</span>
      </span>
    </label>
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
