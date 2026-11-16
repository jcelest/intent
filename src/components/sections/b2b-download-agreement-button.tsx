"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function B2BDownloadAgreementButton() {
  const [downloadToken, setDownloadToken] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("intent-b2b-begin") || sessionStorage.getItem("intent-begin");
    if (raw) {
      try {
        const details = JSON.parse(raw);
        if (details.publicDownloadToken) {
          setDownloadToken(details.publicDownloadToken);
        } else if (details.acceptanceId) {
          setDownloadToken(details.acceptanceId);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  if (!downloadToken) return null;

  return (
    <Button
      variant="secondary"
      onClick={() => {
        window.location.href = `/api/agreement/download?token=${downloadToken}`;
      }}
    >
      Download Commercial Partnership Agreement
    </Button>
  );
}
