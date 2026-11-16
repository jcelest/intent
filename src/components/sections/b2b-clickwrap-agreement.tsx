"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { commercialPartnershipsAgreementHtml } from "@/lib/b2b-agreement";
import {
  calculateCommercialPartnershipsOrder,
  type B2BCustomerDetails,
  type B2BOrderSnapshot,
} from "@/lib/b2b-offer";
import { formatCurrency, cn } from "@/lib/utils";

interface B2BBeginPayload {
  flow: "b2b";
  product: "commercial-partnerships";
  order?: B2BOrderSnapshot;
  details: B2BCustomerDetails;
  acceptanceId?: string;
  publicDownloadToken?: string;
}

export function B2BClickwrapAgreement() {
  const router = useRouter();
  const [payload, setPayload] = useState<B2BBeginPayload | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("intent-b2b-begin") || sessionStorage.getItem("intent-begin");
    if (!raw) {
      setError("We could not find your order details. Please go back and confirm them again.");
      return;
    }
    try {
      setPayload(JSON.parse(raw));
    } catch {
      setError("Failed to load agreement.");
    }
  }, []);

  const order = useMemo(
    () => calculateCommercialPartnershipsOrder(payload?.details?.targetAccounts || 3),
    [payload]
  );
  const html = useMemo(
    () => (payload && order ? commercialPartnershipsAgreementHtml({ details: payload.details, order }) : null),
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
        body: JSON.stringify({
          flow: "b2b",
          product: "commercial-partnerships",
          details: payload.details,
        }),
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
      sessionStorage.setItem("intent-b2b-begin", JSON.stringify(nextPayload));
      sessionStorage.setItem("intent-begin", JSON.stringify(nextPayload));
      router.push("/b2b/begin/pay");
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
          <Summary label="Client" value={`${payload.details.company} (${payload.details.name})`} />
          <Summary label="Campaign" value={`${order.packageName} (${order.targetAccountCount} Target Accounts)`} />
          <Summary label="Start payment due today" value={formatCurrency(order.dueTodayCents)} />
          <Summary
            label="Completion payment"
            value={`${formatCurrency(order.completionFeeCents)} (due only when 3rd account reaches Onboarded status)`}
          />
          <Summary label="Total Campaign Fee" value={formatCurrency(order.totalPriceCents)} />
          <Summary
            label="Guarantee"
            value="30-Day Trajectory Guarantee (full $2,000 refunded if criteria not met)"
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
            I have read and agree to this Commercial Partnerships Service Agreement, including the 30-Day Trajectory Guarantee and the $2,000 start payment due today.
          </span>
        </button>

        <Button
          size="lg"
          disabled={!agreed || loading}
          onClick={onAccept}
          className="w-full sm:w-auto sm:self-end"
        >
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
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
