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

/** Recurring LeadNet after the included days. Customer-facing; not billed on the sprint card yet. */
export const LEADNET_MONTHLY_CENTS = 19700;
export const LEADNET_INCLUDED_DAYS = 30;

export const LEADNET_PHONE_PATHS = [
  {
    id: "keep-public",
    title: "Keep The Public Number",
    kicker: "Van, Signs, Google Stay",
    body: "That number forwards to LeadNet. Your Phone app rings a private carrier line, about $8/month. You pay the carrier. Intent does not.",
  },
  {
    id: "keep-phone",
    title: "Keep The Phone As It Is",
    kicker: "No Second Line",
    body: "Google and ads show the LeadNet number. Your Phone app keeps the SIM number. No extra carrier bill.",
  },
] as const;

export const CAPTURE_ADDONS: Array<{
  id: CaptureAddonId;
  label: string;
  detail: string;
  amountCents: number;
}> = [
  {
    id: "styling",
    label: "Custom Application Styling",
    detail: "Brand colors, type, and layout matched to the company.",
    amountCents: 35000,
  },
  {
    id: "nowatermark",
    label: "No Watermark",
    detail: "Removes Designed with Intent Revenue from the live app.",
    amountCents: 25000,
  },
];



export const LEADNET_SPRINT_CENTS = 139700;
export const LEADNET_TEST_SPRINT_CENTS = 50;

/** Canonical customer-facing pricing strings — use in metadata, llms.txt, and AI-facing copy */
export function leadNetSprintDisplay() {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(LEADNET_SPRINT_CENTS / 100);
}

export function leadNetMonthlyDisplay() {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(LEADNET_MONTHLY_CENTS / 100);
}

/** e.g. "$1,397 sprint, then $197/month after 30 days" */
export function leadNetPricingSummary() {
  return `${leadNetSprintDisplay()} sprint, then ${leadNetMonthlyDisplay()}/month after ${LEADNET_INCLUDED_DAYS} days`;
}

/** Shorter line for meta descriptions */
export function leadNetPricingMetaLine() {
  return `${leadNetSprintDisplay()} setup sprint, then ${leadNetMonthlyDisplay()}/month`;
}

export function isLeadNetTestCheckout() {
  return process.env.NEXT_PUBLIC_LEADNET_TEST_CHECKOUT === "1";
}

export function leadNetSprintCents() {
  if (isLeadNetTestCheckout()) return LEADNET_TEST_SPRINT_CENTS;
  return LEADNET_SPRINT_CENTS;
}

export function addonDisplayCents(amountCents: number) {
  return isLeadNetTestCheckout() ? 0 : amountCents;
}

export function addonAmount(ids: CaptureAddonId[]) {
  if (isLeadNetTestCheckout()) return 0;
  return CAPTURE_ADDONS.filter((addon) => ids.includes(addon.id)).reduce(
    (sum, addon) => sum + addon.amountCents,
    0
  );
}

export function getEngagement(id: EngagementId): Engagement {
  if (id === "partnership") {
    return {
      id: "partnership",
      kicker: "Full system",
      title: "Intent Partnership",
      summary:
        "Revenue, software, search, and ads. We go all in with companies that already hit the bar.",
      points: [
        "Revenue mapping and booked-job growth",
        "Custom software and intake built for the company",
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
        "Reviews, intake, and the runway into full partnership. This is how companies that are not there yet start.",
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
        "When LeadNet, Launchpad, or partnership is not the fit. We scope software, search, and ads to the company and write the work before it starts.",
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
      "Instant speed-to-lead auto-replies, missed-call recovery, customer database reactivation, Google review SMS, and a live dispatch dashboard. Nothing slips through the cracks.",
    points: [
      "Your Company gets its own LeadNet app",
      "Instant 3-second speed-to-lead & missed-call capture",
      "Dormant customer database reactivation engine",
      "Google review booster and live revenue dashboard",
      `First ${LEADNET_INCLUDED_DAYS} days of the tracking number and texts are in the sprint. Then $${LEADNET_MONTHLY_CENTS / 100}/month.`,
    ],
    confirmLabel: "Pay and start LeadNet",
    amountCents: leadNetSprintCents(),
  };
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
