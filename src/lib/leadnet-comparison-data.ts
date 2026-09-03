export const COMPETITOR_STACK = [
  {
    category: "Speed-to-Lead & Missed Calls",
    tools: "Hatch / CHIIRP",
    setupCost: "$1,000 – $3,000",
    monthlyCost: "$450 – $900/mo",
    contract: "12-Month Lock-in",
  },
  {
    category: "5-Star Review Collection",
    tools: "Podium / Birdeye",
    setupCost: "$500 – $1,500",
    monthlyCost: "$299 – $599/mo",
    contract: "12-Month Lock-in",
  },
  {
    category: "Database Reactivation",
    tools: "ServiceTitan Marketing Pro",
    setupCost: "$5,000 – $25,000",
    monthlyCost: "$500 – $2,000/mo",
    contract: "Annual Retainer",
  },
  {
    category: "Call Tracking & Routing",
    tools: "CallRail + Voice Assist",
    setupCost: "$0",
    monthlyCost: "$145 – $290/mo",
    contract: "Metered Usage",
  },
] as const;

export const LEADNET_FEATURES = [
  "LiveWire: Sub-3s missed-call text-back",
  "RevSurge: 1-click database reactivation",
  "AutoSet: 5-star Google review automation",
  "Instant Angi & Google LSA auto-replies",
] as const;

export const COMPETITOR_TOTALS = {
  firstYear: "$20,400 – $55,000+",
  monthly: "$1,494 – $3,789 / mo",
  setupNote: "+ $2,500 – $10,000 setup",
} as const;
