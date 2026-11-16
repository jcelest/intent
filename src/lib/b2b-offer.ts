export const COMMERCIAL_PARTNERSHIPS_OFFER_VERSION = "commercial-partnerships-2026-v1";
export const COMMERCIAL_PARTNERSHIPS_AGREEMENT_VERSION = "commercial-partnerships-service-agreement-v1";
export const B2B_CURRENCY = "usd";

export const TOTAL_PRICE_CENTS = 400000; // $4,000 total
export const DUE_TODAY_CENTS = 200000;   // $2,000 start payment
export const COMPLETION_FEE_CENTS = 200000; // $2,000 completion payment (collected separately at milestone)
export const DEFAULT_TARGET_ACCOUNT_COUNT = 3;

export type B2BCustomerDetails = {
  name: string;
  company: string;
  email: string;
  phone: string;
  trade?: string;
  serviceArea?: string;
  scopeLimits?: string;
  targetAccounts?: number;
};

export type B2BOrderSnapshot = {
  offerVersion: string;
  agreementVersion: string;
  currency: typeof B2B_CURRENCY;
  product: "commercial-partnerships";
  packageName: string;
  totalPriceCents: number;
  dueTodayCents: number;
  completionFeeCents: number;
  targetAccountCount: number;
  paymentMode: "milestone-start";
  termsSummary: {
    totalFee: string;
    dueToday: string;
    completionFee: string;
    onboardedDefinition: string;
    guarantee: string;
    dayOneRule: string;
    updates: string;
    noJobGuarantee: string;
  };
};

export function calculateCommercialPartnershipsOrder(
  customTargetCount: number = DEFAULT_TARGET_ACCOUNT_COUNT
): B2BOrderSnapshot {
  return {
    offerVersion: COMMERCIAL_PARTNERSHIPS_OFFER_VERSION,
    agreementVersion: COMMERCIAL_PARTNERSHIPS_AGREEMENT_VERSION,
    currency: B2B_CURRENCY,
    product: "commercial-partnerships",
    packageName: "Commercial Partnerships",
    totalPriceCents: TOTAL_PRICE_CENTS,
    dueTodayCents: DUE_TODAY_CENTS,
    completionFeeCents: COMPLETION_FEE_CENTS,
    targetAccountCount: customTargetCount,
    paymentMode: "milestone-start",
    termsSummary: {
      totalFee: "$4,000 total fee",
      dueToday: "$2,000 start payment due on signing, before outreach begins",
      completionFee: "$2,000 completion payment due only when 3rd target account reaches Onboarded status",
      onboardedDefinition:
        "Vendor packet approved in writing; COI, W-9, and license accepted; named dispatch/operations contact confirmed; and work-order route known.",
      guarantee:
        "30-Day Trajectory Guarantee: full $2,000 start payment refunded if by Day 30 client does not have at least 1 account Onboarded + 1 in active onboarding, or 2 accounts Onboarded.",
      dayOneRule:
        "Day 1 begins only after start payment has cleared and client provides COI, W-9, license, and rate sheet.",
      updates: "Weekly written updates provided every Friday.",
      noJobGuarantee:
        "No guarantee of work orders, job volume, or revenue beyond the stated 30-day refund guarantee.",
    },
  };
}
