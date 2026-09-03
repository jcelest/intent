"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function DownloadAgreementButton() {
  const [acceptanceId, setAcceptanceId] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("intent-begin");
    if (raw) {
      try {
        const details = JSON.parse(raw);
        if (details.acceptanceId) {
          setAcceptanceId(details.acceptanceId);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  if (!acceptanceId) return null;

  return (
    <Button
      variant="secondary"
      onClick={() => {
        window.location.href = `/api/agreement/download?id=${acceptanceId}`;
      }}
    >
      Download Service Agreement
    </Button>
  );
}
