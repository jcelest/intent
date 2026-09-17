"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function BillingPortalButton() {
  const [downloadToken, setDownloadToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("intent-begin");
    if (!raw) return;
    try {
      const details = JSON.parse(raw);
      if (details.publicDownloadToken) setDownloadToken(details.publicDownloadToken);
    } catch {
      // ignore malformed browser state
    }
  }, []);

  async function openPortal() {
    if (!downloadToken) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: downloadToken }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Could not open billing portal.");
      }
      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open billing portal.");
      setBusy(false);
    }
  }

  if (!downloadToken) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <Button variant="secondary" onClick={openPortal} disabled={busy}>
        {busy ? "Opening billing..." : "Manage billing"}
      </Button>
      {error ? <p className="text-center text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

