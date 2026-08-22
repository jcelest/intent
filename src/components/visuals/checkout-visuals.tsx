import { cn } from "@/lib/utils";

export function CheckoutSignVisual({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 280 160"
      className={cn("mx-auto w-full max-w-xs h-auto", className)}
      aria-hidden
      fill="none"
    >
      <circle
        className="checkout-ring"
        cx="140"
        cy="80"
        r="64"
        stroke="#22d3ee"
        strokeOpacity="0.18"
        strokeWidth="2"
      />
      <circle
        className="checkout-ring checkout-ring-2"
        cx="140"
        cy="80"
        r="46"
        stroke="#22d3ee"
        strokeOpacity="0.4"
        strokeWidth="2"
      />
      <circle cx="140" cy="80" r="28" fill="rgba(34,211,238,0.1)" stroke="#22d3ee" strokeWidth="2" />
      <path
        d="M108 72h24v16c0 6-4 12-12 16-8-4-12-10-12-16V72z"
        stroke="#22d3ee"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="120" cy="64" r="7" stroke="#22d3ee" strokeWidth="2" />
      <path
        d="M148 86h28M148 94h18"
        stroke="#67e8f9"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle className="checkout-dot" cx="214" cy="48" r="4" fill="#22d3ee" />
      <circle className="checkout-dot" cx="66" cy="118" r="3.5" fill="#67e8f9" style={{ animationDelay: "0.4s" }} />
      <circle className="checkout-dot" cx="228" cy="112" r="3" fill="#22d3ee" style={{ animationDelay: "0.8s" }} />
    </svg>
  );
}

export function CheckoutDoneVisual({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 280 160"
      className={cn("mx-auto w-full max-w-xs h-auto", className)}
      aria-hidden
      fill="none"
    >
      <circle
        className="checkout-ring"
        cx="140"
        cy="80"
        r="66"
        stroke="#22d3ee"
        strokeOpacity="0.16"
        strokeWidth="2"
      />
      <circle
        className="checkout-ring checkout-ring-2"
        cx="140"
        cy="80"
        r="48"
        stroke="#22d3ee"
        strokeOpacity="0.35"
        strokeWidth="2"
      />
      <circle
        className="checkout-ring checkout-ring-3"
        cx="140"
        cy="80"
        r="32"
        fill="rgba(34,211,238,0.12)"
        stroke="#22d3ee"
        strokeWidth="2.5"
      />
      <path
        className="checkout-check"
        d="M124 80l10 10 22-24"
        stroke="#67e8f9"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className="checkout-dot" cx="54" cy="52" r="4" fill="#22d3ee" />
      <circle className="checkout-dot" cx="226" cy="44" r="3.5" fill="#67e8f9" style={{ animationDelay: "0.35s" }} />
      <circle className="checkout-dot" cx="48" cy="118" r="3" fill="#22d3ee" style={{ animationDelay: "0.7s" }} />
      <circle className="checkout-dot" cx="232" cy="120" r="4" fill="#67e8f9" style={{ animationDelay: "1s" }} />
    </svg>
  );
}
