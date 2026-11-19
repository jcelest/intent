export type AutomaticDialerDisposition = "no_answer" | "busy" | "failed";

export function automaticDispositionForTwilioStatus(status: string): AutomaticDialerDisposition | null {
  if (status === "busy") return "busy";
  if (status === "failed") return "failed";
  if (status === "no-answer" || status === "canceled") return "no_answer";
  return null;
}

export function isAutomaticDialerDisposition(value: string): value is AutomaticDialerDisposition {
  return value === "no_answer" || value === "busy" || value === "failed";
}
