"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { leadNetWebsiteAgreementHtml } from "@/lib/capture-agreement";
import {
  calculateLeadNetOrder,
  type LeadNetCustomerDetails,
  type LeadNetOrderSelection,
} from "@/lib/leadnet-offer";
import { formatCurrency, cn } from "@/lib/utils";

interface BeginDetails {
  selection: LeadNetOrderSelection;
  details: LeadNetCustomerDetails;
  acceptanceId?: string;
  publicDownloadToken?: string;
}

export function ClickwrapAgreement() {
  const router = useRouter();
  const [payload, setPayload] = useState<BeginDetails | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("intent-begin");
    if (!raw) {
      setError("We could not find your order. Please go back and configure it again.");
      return;
    }
    try {
      setPayload(JSON.parse(raw));
    } catch {
      setError("Failed to load agreement.");
    }
  }, []);

  const order = useMemo(
    () => (payload ? calculateLeadNetOrder(payload.selection) : null),
    [payload]
  );
  const html = useMemo(
    () => (payload && order ? leadNetWebsiteAgreementHtml({ details: payload.details, order }) : null),
    [order, payload]
  );

  async function onAccept() {
    if (!agreed || !payload) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/agreement/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.acceptanceId) {
        throw new Error(data.error || "Could not accept agreement.");
      }
      const nextPayload = {
        ...payload,
        acceptanceId: data.acceptanceId,
        publicDownloadToken: data.publicDownloadToken,
      };
      sessionStorage.setItem("intent-begin", JSON.stringify(nextPayload));
      router.push("/begin/pay");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setLoading(false);
    }
  }

  if (error) {
    return <p className="text-center text-sm text-red-300">{error}</p>;
  }

  if (!payload || !order || !html) {
    return <p className="text-center text-foreground/80">Loading agreement...</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="space-y-4 rounded-xl border border-white/10 bg-card p-6 text-sm">
        <h3 className="text-lg font-semibold text-foreground">Agreement Summary</h3>
        <div className="grid gap-4 text-foreground/80 sm:grid-cols-2">
          <Summary label="Customer" value={`${payload.details.company} (${payload.details.name})`} />
          <Summary label="Package" value={`${order.package.name} - ${order.selection.paymentMode}`} />
          <Summary label="Due today" value={formatCurrency(order.dueTodayCents)} />
          <Summary
            label="Future recurring"
            value={
              order.recurringAfterActivationCents
                ? `${formatCurrency(order.recurringAfterActivationCents)}/month after all selected services are active`
                : "No recurring charge from this order"
            }
          />
        </div>
      </div>

      <div
        className="h-[50vh] overflow-y-auto rounded-xl border border-white/10 bg-card p-6 text-black"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setAgreed(!agreed)}
          className={cn(
            "flex cursor-pointer items-start gap-4 rounded-xl border p-4 text-left transition-colors",
            agreed ? "border-accent bg-accent/10" : "border-white/10 bg-black/20 hover:border-accent/40"
          )}
        >
          <span
            className={cn(
              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border-2",
              agreed ? "border-accent bg-accent" : "border-white/20"
            )}
            aria-hidden
          >
            {agreed ? <span className="text-sm font-bold text-oled">✓</span> : null}
          </span>
          <span className="font-medium leading-relaxed text-foreground/90">
            I have read and agree to this website and LeadNet agreement, including
            the charges due today and any selected future activation subscriptions.
          </span>
        </button>

        <Button size="lg" disabled={!agreed || loading} onClick={onAccept} className="w-full sm:w-auto sm:self-end">
          {loading ? "Saving..." : "Continue to Payment"}
        </Button>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-1 block text-xs uppercase tracking-wider text-muted">{label}</span>
      {value}
    </div>
  );
}
