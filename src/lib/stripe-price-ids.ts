import type { LeadNetOrderSnapshot } from "@/lib/leadnet-offer";

export type LeadNetStripePriceIds = {
  businessSetup: string;
  businessMonthly: string;
  businessUpfront: string;
  expandedSetup: string;
  expandedMonthly: string;
  expandedUpfront: string;
  websiteCareMonthly: string;
  leadNetSpeedToLeadMonthly: string;
};

const PRICE_ENV = {
  businessSetup: "STRIPE_PRICE_BUSINESS_WEBSITE_SETUP",
  businessMonthly: "STRIPE_PRICE_BUSINESS_WEBSITE_MONTHLY",
  businessUpfront: "STRIPE_PRICE_BUSINESS_WEBSITE_UPFRONT",
  expandedSetup: "STRIPE_PRICE_EXPANDED_WEBSITE_SETUP",
  expandedMonthly: "STRIPE_PRICE_EXPANDED_WEBSITE_MONTHLY",
  expandedUpfront: "STRIPE_PRICE_EXPANDED_WEBSITE_UPFRONT",
  websiteCareMonthly: "STRIPE_PRICE_WEBSITE_CARE_MONTHLY",
  leadNetSpeedToLeadMonthly: "STRIPE_PRICE_LEADNET_SPEED_TO_LEAD_MONTHLY",
} as const satisfies Record<keyof LeadNetStripePriceIds, string>;

export function isStripeLiveMode() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_"));
}

export function getLeadNetStripePriceIds(): Partial<LeadNetStripePriceIds> {
  return Object.fromEntries(
    Object.entries(PRICE_ENV).map(([key, envName]) => [key, process.env[envName] || ""])
  ) as Partial<LeadNetStripePriceIds>;
}

export function getStripePriceEnvName(key: keyof LeadNetStripePriceIds) {
  return PRICE_ENV[key];
}

export function getWebsiteSetupPriceId(order: LeadNetOrderSnapshot) {
  const ids = getLeadNetStripePriceIds();
  return order.selection.packageId === "expanded" ? ids.expandedSetup : ids.businessSetup;
}

export function getWebsiteMonthlyPriceId(order: LeadNetOrderSnapshot) {
  const ids = getLeadNetStripePriceIds();
  return order.selection.packageId === "expanded" ? ids.expandedMonthly : ids.businessMonthly;
}

export function getWebsiteUpfrontPriceId(order: LeadNetOrderSnapshot) {
  const ids = getLeadNetStripePriceIds();
  return order.selection.packageId === "expanded" ? ids.expandedUpfront : ids.businessUpfront;
}

export function missingStripePriceEnvNames(order: LeadNetOrderSnapshot) {
  const ids = getLeadNetStripePriceIds();
  const missing: Array<keyof LeadNetStripePriceIds> = [];

  if (order.selection.paymentMode === "monthly") {
    missing.push(
      order.selection.packageId === "expanded" ? "expandedSetup" : "businessSetup",
      order.selection.packageId === "expanded" ? "expandedMonthly" : "businessMonthly"
    );
  } else {
    missing.push(order.selection.packageId === "expanded" ? "expandedUpfront" : "businessUpfront");
  }

  if (order.selection.careSelected) missing.push("websiteCareMonthly");
  if (order.selection.leadNetSelected) missing.push("leadNetSpeedToLeadMonthly");

  return missing.filter((key) => !ids[key]).map((key) => PRICE_ENV[key]);
}

