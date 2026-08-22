export type EngagementId = "capture" | "launchpad" | "partnership" | "custom";

export type CaptureAddonId = "styling" | "nowatermark";

export type Engagement = {
  id: EngagementId;
  kicker: string;
  title: string;
  summary: string;
  points: string[];
  confirmLabel: string;
  amountCents: number | null;
};

export const CAPTURE_ADDONS: Array<{
  id: CaptureAddonId;
  label: string;
  detail: string;
  amountCents: number;
}> = [
  {
    id: "styling",
    label: "Custom application styling",
    detail: "Brand colors, type, and layout matched to the shop.",
    amountCents: 49900,
  },
  {
    id: "nowatermark",
    label: "No watermark",
    detail: "Removes Designed with Intent Revenue from the live app.",
    amountCents: 25000,
  },
];

function amountFromEnv(key: string, fallback?: number): number | null {
  const raw = process.env[key];
  if (raw) {
    const cents = Number.parseInt(raw, 10);
    if (Number.isFinite(cents) && cents >= 50) return cents;
  }
  return fallback ?? null;
}

export function getEngagement(id: EngagementId): Engagement {
  if (id === "partnership") {
    return {
      id: "partnership",
      kicker: "Full system",
      title: "Intent Partnership",
      summary:
        "Revenue, software, search, and ads. We go all in with shops that already hit the bar.",
      points: [
        "Revenue mapping and booked-job growth",
        "Custom software and intake built for the shop",
        "Organic search first, paid ads when they accelerate the work",
      ],
      confirmLabel: "Talk partnership",
      amountCents: null,
    };
  }

  if (id === "launchpad") {
    return {
      id: "launchpad",
      kicker: "Path to qualification",
      title: "Intent Launchpad",
      summary:
        "Reviews, intake, and the runway into full partnership. This is how shops that are not there yet start.",
      points: [
        "Post-job Google review engine",
        "Google Business Profile build-out",
        "Missed-call text-back and lead intake",
      ],
      confirmLabel: "Apply for Launchpad",
      amountCents: null,
    };
  }

  if (id === "custom") {
    return {
      id: "custom",
      kicker: "Built to spec",
      title: "Custom package",
      summary:
        "When LeadNet, Launchpad, or partnership is not the fit. We scope software, search, and ads to the shop and write the work before it starts.",
      points: [
        "Scoped software, not a template",
        "Search and ads only where they move jobs",
        "Written proposal before we build",
      ],
      confirmLabel: "Request a scope",
      amountCents: null,
    };
  }

  return {
    id: "capture",
    kicker: "Nothing slips through",
    title: "Intent LeadNet",
    summary:
      "Missed-call text-back, lead intake, owner alerts, Google review SMS, and a shop dashboard. Every ring stays in the system. Nothing slips through the cracks.",
    points: [
      "The shop gets its own LeadNet app",
      "Tracking number and missed-call recovery",
      "Priority intake and owner SMS",
      "Google review requests and a live dashboard",
    ],
    confirmLabel: "Pay and start LeadNet",
    amountCents: amountFromEnv("CAPTURE_AMOUNT_CENTS", 99900),
  };
}

export function addonAmount(ids: CaptureAddonId[]) {
  return CAPTURE_ADDONS.filter((addon) => ids.includes(addon.id)).reduce(
    (sum, addon) => sum + addon.amountCents,
    0
  );
}

export function parseAddons(value: unknown): CaptureAddonId[] {
  const list = Array.isArray(value) ? value : [];
  return CAPTURE_ADDONS.map((addon) => addon.id).filter((id) => list.includes(id));
}

export function isStripeConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  );
}

export function isDocuSignConfigured() {
  return Boolean(
    process.env.DOCUSIGN_INTEGRATION_KEY &&
      process.env.DOCUSIGN_USER_ID &&
      process.env.DOCUSIGN_ACCOUNT_ID &&
      process.env.DOCUSIGN_RSA_PRIVATE_KEY
  );
}

export function parseEngagementId(value: string | null | undefined): EngagementId {
  if (value === "partnership") return "partnership";
  if (value === "launchpad") return "launchpad";
  if (value === "custom") return "custom";
  return "capture";
}
