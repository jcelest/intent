"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { captureAgreementHtml } from "@/lib/capture-agreement";
import { getEngagement, addonAmount, LEADNET_MONTHLY_CENTS, CAPTURE_ADDONS, EngagementId, CaptureAddonId } from "@/lib/engagements";
import { formatCurrency, cn } from "@/lib/utils";

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
        <button
          type="button"
          onClick={() => setAgreed(!agreed)}
          className={cn(
            "flex items-start sm:items-center gap-4 text-left cursor-pointer p-4 border rounded-xl transition-all duration-300",
            agreed 
              ? "border-accent bg-accent/10" 
              : "border-white/10 bg-black/20 hover:border-accent/40 hover:bg-black/40"
          )}
        >
          <div 
            className={cn(
              "flex w-6 h-6 shrink-0 items-center justify-center rounded mt-0.5 sm:mt-0 transition-colors border-2",
              agreed ? "bg-accent border-accent" : "border-white/20"
            )}
          >
            {agreed && (
              <svg 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="black" 
                strokeWidth="4" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
          </div>
          <span className="text-foreground/90 font-medium leading-relaxed">
            I have read and agree to the LeadNet Service Agreement and authorize the charges described in it.
          </span>
        </button>
        
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
