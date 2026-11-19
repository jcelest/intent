import { Suspense } from "react";
import { DialerWorkspace } from "@/components/dialer/dialer-workspace";

export const dynamic = "force-dynamic";

export default function DialerPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#f7f7f5] text-sm text-[#66716b]">Opening Intent Dialer…</div>}>
      <DialerWorkspace />
    </Suspense>
  );
}
