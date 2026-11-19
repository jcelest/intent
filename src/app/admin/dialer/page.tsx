import { Suspense } from "react";
import { DialerWorkspace } from "@/components/dialer/dialer-workspace";

export const dynamic = "force-dynamic";

export default function DialerPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#f8fafc] text-sm text-[#64748b]">Opening Intent Dialer…</div>}>
      <DialerWorkspace />
    </Suspense>
  );
}
