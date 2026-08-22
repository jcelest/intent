"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CaptureAddonId, EngagementId } from "@/lib/engagements";

export function PaidSign() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("intent-begin");
    if (!raw) {
      setError("Payment went through. We could not find your details to open the agreement.");
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

    fetch("/api/docusign/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.url) {
          throw new Error(payload.error || "Could not open the agreement.");
        }
        window.location.href = payload.url;
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="text-center">
        <p className="text-red-300 leading-relaxed">{error}</p>
        <p className="mt-3 text-sm text-foreground/75 leading-relaxed">
          You are paid. We will send the LeadNet agreement by email if this
          page cannot open it.
        </p>
        <Link
          href="/#get-in-touch"
          className="mt-6 inline-flex font-semibold text-accent hover:underline"
        >
          Contact Intent
        </Link>
      </div>
    );
  }

  return (
    <p className="text-center text-foreground/80">Opening the agreement…</p>
  );
}
