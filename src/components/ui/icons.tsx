import { cn } from "@/lib/utils";

const iconClass = "flex-shrink-0";

export function DispatcherIcon({
  className,
  accent,
}: {
  className?: string;
  accent?: boolean;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(iconClass, "h-8 w-8", accent && "text-accent", className)}
    >
      <path d="M12 2a10 10 0 0 1 0 20 10 10 0 0 1 0-20" />
      <path d="M12 2a10 10 0 0 0 0 20" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4" />
    </svg>
  );
}

export function LightningIcon({
  className,
  accent,
}: {
  className?: string;
  accent?: boolean;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(iconClass, "h-8 w-8", accent && "text-accent", className)}
    >
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

export function TargetIcon({
  className,
  accent,
}: {
  className?: string;
  accent?: boolean;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(iconClass, "h-8 w-8", accent && "text-accent", className)}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export function AtomIcon({
  className,
  accent,
}: {
  className?: string;
  accent?: boolean;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(iconClass, "h-8 w-8", accent && "text-accent", className)}
    >
      <circle cx="12" cy="12" r="1" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      <path d="M12 2a15.3 15.3 0 0 0-4 10 15.3 15.3 0 0 0 4 10 15.3 15.3 0 0 0 4-10 15.3 15.3 0 0 0-4-10z" />
      <path d="M2 12h20" />
    </svg>
  );
}
