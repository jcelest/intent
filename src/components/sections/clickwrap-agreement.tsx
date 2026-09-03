"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { captureAgreementHtml } from "@/lib/capture-agreement";
import { getEngagement, addonAmount, LEADNET_MONTHLY_CENTS, CAPTURE_ADDONS, EngagementId, CaptureAddonId } from "@/lib/engagements";
import { formatCurrency } from "@/lib/utils";

interface BeginDetails {
  path: EngagementId;
  name: string;
  company: string;
  email: string;
  phone: string;
  addons: CaptureAddonId[];
  acceptanceId?: string;
}

export function ClickwrapAgreement() {
  const router = useRouter();
  const [details, setDetails] = useState<BeginDetails | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const raw = sessionStorage.getItem("intent-begin");
    if (!raw) {
      setError("We could not find your details. Please go back and try again.");
      return;
    }
    
    try {
      const parsedDetails = JSON.parse(raw);
      setDetails(parsedDetails);
      const engagement = getEngagement(parsedDetails.path);
      const amount = (engagement.amountCents ?? 0) + addonAmount(parsedDetails.addons);
      const htmlContent = captureAgreementHtml({
        ...parsedDetails,
        amountCents: amount,
      });
      setHtml(htmlContent);
    } catch {
      setError("Failed to load agreement.");
    }
  }, []);

  async function onAccept() {
    if (!agreed) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/agreement/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details),
      });
      const data = await response.json();
      if (!response.ok || !data.acceptanceId) {
        throw new Error(data.error || "Could not accept agreement.");
      }
      
      const newDetails = { ...details, acceptanceId: data.acceptanceId };
      sessionStorage.setItem("intent-begin", JSON.stringify(newDetails));
      router.push("/begin/pay");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setLoading(false);
    }
  }

  if (error) {
    return <p className="text-sm text-red-300 text-center">{error}</p>;
  }

  if (!html || !details) {
    return <p className="text-center text-foreground/80">Loading agreement...</p>;
  }

  const engagement = getEngagement(details.path);
  const sprintAmount = (engagement.amountCents ?? 0);
  const addonsSelected = CAPTURE_ADDONS.filter(a => details.addons.includes(a.id));
  const totalAmount = sprintAmount + addonAmount(details.addons);

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
      
      <div className="rounded-xl border border-white/10 bg-card p-6 space-y-4 text-sm">
        <h3 className="font-semibold text-lg text-foreground">Agreement Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-foreground/80">
          <div>
            <span className="block text-muted text-xs uppercase tracking-wider mb-1">Customer</span>
            {details.company} ({details.name})
          </div>
          <div>
            <span className="block text-muted text-xs uppercase tracking-wider mb-1">Package</span>
            {engagement.title}
          </div>
          <div>
            <span className="block text-muted text-xs uppercase tracking-wider mb-1">Implementation Fee</span>
            {formatCurrency(totalAmount)} due today
          </div>
          <div>
            <span className="block text-muted text-xs uppercase tracking-wider mb-1">Recurring Subscription</span>
            {formatCurrency(LEADNET_MONTHLY_CENTS)} / month (starts after 30 days)
          </div>
          {addonsSelected.length > 0 && (
            <div className="col-span-1 sm:col-span-2">
              <span className="block text-muted text-xs uppercase tracking-wider mb-1">Selected Add-ons</span>
              {addonsSelected.map(a => a.label).join(", ")}
            </div>
          )}
        </div>
      </div>

      <div 
        className="rounded-xl border border-white/10 bg-card p-6 h-[50vh] overflow-y-auto custom-scrollbar text-black"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      
      <div className="flex flex-col gap-4">
        <label className="flex items-start sm:items-center gap-3 cursor-pointer p-4 border border-white/10 rounded-xl bg-black/20 hover:bg-black/40 transition-colors">
          <input 
            type="checkbox" 
            className="w-5 h-5 mt-1 sm:mt-0 rounded border-white/20 bg-background accent-accent shrink-0"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span className="text-foreground/90 font-medium leading-relaxed">
            I have read and agree to the LeadNet Service Agreement and authorize the charges described in it.
          </span>
        </label>
        
        <Button 
          size="lg" 
          disabled={!agreed || loading} 
          onClick={onAccept}
          className="w-full sm:w-auto self-end"
        >
          {loading ? "Saving..." : "Continue to Payment"}
        </Button>
      </div>
    </div>
  );
}
