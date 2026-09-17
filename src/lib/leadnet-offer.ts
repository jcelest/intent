export const LEADNET_OFFER_VERSION = "leadnet-website-first-2026-09";
export const LEADNET_AGREEMENT_VERSION = "leadnet-website-first-2026-09-v1";
export const OFFER_CURRENCY = "usd";

export type WebsitePackageId = "business" | "expanded";
export type WebsitePaymentMode = "monthly" | "upfront";

export type WebsitePackage = {
  id: WebsitePackageId;
  name: string;
  pageLimit: number;
  monthly: {
    setupCents: number;
    recurringCents: number;
  };
  upfrontCents: number;
  summary: string;
};

export type LeadNetOrderSelection = {
  packageId: WebsitePackageId;
  paymentMode: WebsitePaymentMode;
  leadNetSelected: boolean;
  careSelected: boolean;
};

export type LeadNetCustomerDetails = {
  name: string;
  company: string;
  email: string;
  phone: string;
  industry: string;
  domainStatus: string;
  services: string;
  serviceAreas: string;
  brandingAssets: string;
  notes: string;
};

export type ChargeLine = {
  id: string;
  label: string;
  amountCents: number;
  timing: "today" | "monthly" | "activation";
};

export type LeadNetOrderSnapshot = {
  offerVersion: string;
  agreementVersion: string;
  currency: typeof OFFER_CURRENCY;
  selection: LeadNetOrderSelection;
  package: WebsitePackage;
  dueTodayCents: number;
  oneTimeCharges: ChargeLine[];
  recurringWebsiteCharges: ChargeLine[];
  activationCharges: ChargeLine[];
  recurringAfterActivationCents: number;
  billingStartRules: string[];
  ownershipSummary: string;
  cancellationSummary: string;
  exclusions: string[];
  leadNetAllowance: typeof LEADNET_FOLLOW_UP;
  websiteCare: typeof WEBSITE_CARE;
  revisionScope: string;
};

export const WEBSITE_PACKAGES: Record<WebsitePackageId, WebsitePackage> = {
  business: {
    id: "business",
    name: "Business Website",
    pageLimit: 7,
    monthly: {
      setupCents: 29700,
      recurringCents: 19700,
    },
    upfrontCents: 149700,
    summary: "A professionally built business website with up to 7 agreed public content pages.",
  },
  expanded: {
    id: "expanded",
    name: "Expanded Website",
    pageLimit: 25,
    monthly: {
      setupCents: 49700,
      recurringCents: 29700,
    },
    upfrontCents: 249700,
    summary:
      "A larger business website with up to 25 agreed public content pages for substantive services and service-area coverage.",
  },
};

export const WEBSITE_CARE = {
  id: "website-care",
  name: "Website Care",
  monthlyCents: 4900,
  editMinutesPerMonth: 30,
  starts: "Begins when hosting service is activated.",
  availableFor: "upfront-buyers-only",
} as const;

export const LEADNET_FOLLOW_UP = {
  id: "leadnet-follow-up",
  name: "LeadNet Follow-Up",
  monthlyCents: 14900,
  includedSmsSegments: 1000,
  overageCentsPerSegment: 3,
  defaultApprovedOverageBudgetCents: 0,
  starts: "Begins when LeadNet Follow-Up is activated.",
} as const;

export const WEBSITE_INCLUDED = [
  "Mobile-friendly design using a repeatable design system adapted to the business",
  "Business branding",
  "Initial copy based on verified customer information",
  "Inquiry form and click-to-call",
  "Initial technical/on-page SEO setup",
  "Relevant titles and descriptions",
  "Crawlable page content and sitemap",
  "Appropriate structured data",
  "Analytics and Search Console setup, subject to account access",
  "Two consolidated prelaunch revision rounds",
  "Agreed page list before production",
];

export const OFFER_EXCLUSIONS = [
  "Ongoing SEO management",
  "Monthly content production or ranking campaigns",
  "Ecommerce",
  "Custom applications",
  "Complex integrations",
  "Logo design or photography unless separately agreed",
  "Unlimited revisions or edits",
  "Guaranteed rankings, indexing, traffic, leads, or revenue",
];

export function parseWebsitePackageId(value: unknown): WebsitePackageId {
  return value === "expanded" ? "expanded" : "business";
}

export function parseWebsitePaymentMode(value: unknown): WebsitePaymentMode {
  return value === "upfront" ? "upfront" : "monthly";
}

export function normalizeLeadNetSelection(input: Partial<LeadNetOrderSelection>): LeadNetOrderSelection {
  const paymentMode = parseWebsitePaymentMode(input.paymentMode);
  return {
    packageId: parseWebsitePackageId(input.packageId),
    paymentMode,
    leadNetSelected: Boolean(input.leadNetSelected),
    careSelected: paymentMode === "upfront" ? Boolean(input.careSelected) : false,
  };
}

export function calculateLeadNetOrder(input: Partial<LeadNetOrderSelection>): LeadNetOrderSnapshot {
  const selection = normalizeLeadNetSelection(input);
  const websitePackage = WEBSITE_PACKAGES[selection.packageId];
  const oneTimeCharges: ChargeLine[] = [];
  const recurringWebsiteCharges: ChargeLine[] = [];
  const activationCharges: ChargeLine[] = [];

  if (selection.paymentMode === "monthly") {
    oneTimeCharges.push({
      id: "website-setup",
      label: `${websitePackage.name} setup`,
      amountCents: websitePackage.monthly.setupCents,
      timing: "today",
    });
    oneTimeCharges.push({
      id: "website-first-month",
      label: `${websitePackage.name} first month`,
      amountCents: websitePackage.monthly.recurringCents,
      timing: "today",
    });
    recurringWebsiteCharges.push({
      id: "managed-website",
      label: `${websitePackage.name} managed website`,
      amountCents: websitePackage.monthly.recurringCents,
      timing: "monthly",
    });
  } else {
    oneTimeCharges.push({
      id: "website-purchase",
      label: `${websitePackage.name} purchase`,
      amountCents: websitePackage.upfrontCents,
      timing: "today",
    });
    if (selection.careSelected) {
      activationCharges.push({
        id: WEBSITE_CARE.id,
        label: WEBSITE_CARE.name,
        amountCents: WEBSITE_CARE.monthlyCents,
        timing: "activation",
      });
    }
  }

  if (selection.leadNetSelected) {
    activationCharges.push({
      id: LEADNET_FOLLOW_UP.id,
      label: LEADNET_FOLLOW_UP.name,
      amountCents: LEADNET_FOLLOW_UP.monthlyCents,
      timing: "activation",
    });
  }

  const dueTodayCents = oneTimeCharges.reduce((sum, charge) => sum + charge.amountCents, 0);
  const recurringAfterActivationCents =
    recurringWebsiteCharges.reduce((sum, charge) => sum + charge.amountCents, 0) +
    activationCharges.reduce((sum, charge) => sum + charge.amountCents, 0);

  return {
    offerVersion: LEADNET_OFFER_VERSION,
    agreementVersion: LEADNET_AGREEMENT_VERSION,
    currency: OFFER_CURRENCY,
    selection,
    package: websitePackage,
    dueTodayCents,
    oneTimeCharges,
    recurringWebsiteCharges,
    activationCharges,
    recurringAfterActivationCents,
    billingStartRules:
      selection.paymentMode === "monthly"
        ? [
            "Setup and the first managed-website month are collected at checkout.",
            "Later managed-website billing renews monthly on the subscription billing anniversary.",
            "LeadNet Follow-Up, if selected, begins billing only when that service is activated.",
          ]
        : [
            "The website purchase price is collected at checkout.",
            "Website Care, if selected, begins billing only when hosting service is activated.",
            "LeadNet Follow-Up, if selected, begins billing only when that service is activated.",
          ],
    ownershipSummary:
      selection.paymentMode === "monthly"
        ? "The customer owns their domain and supplied business content. The monthly plan provides a managed hosted website while subscribed and does not automatically transfer website source or design ownership."
        : "The customer owns their domain and supplied business content. Agreed website deliverables transfer upon completion and full payment, subject to third-party licensing limitations.",
    cancellationSummary:
      selection.paymentMode === "monthly"
        ? "The monthly website subscription has no minimum term. Future renewals can be cancelled anytime; service continues through the paid billing period, and hosted website service ends afterward unless separate transition terms are arranged."
        : "There is no mandatory website subscription for upfront purchases. Optional Care and LeadNet subscriptions can be cancelled independently for future renewal periods.",
    exclusions: OFFER_EXCLUSIONS,
    leadNetAllowance: LEADNET_FOLLOW_UP,
    websiteCare: WEBSITE_CARE,
    revisionScope:
      "Two consolidated prelaunch revision rounds are included. Ongoing edit allowances, where active, cover up to 30 minutes of content edits per billing month and do not roll over.",
  };
}

export function leadNetWebsitePricingSummary() {
  return "Business Website: $297 setup + $197/month or $1,497 upfront. Expanded Website: $497 setup + $297/month or $2,497 upfront. Optional LeadNet Follow-Up: $149/month at activation.";
}

export function leadNetWebsitePricingMetaLine() {
  return "Business websites from $297 setup + $197/month or $1,497 upfront";
}

