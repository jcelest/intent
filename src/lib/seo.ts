/**
 * SEO config for intentrev.net
 * Primary keyword: contractor lead generation: lead gen & revenue for trades
 */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://intentrev.net";

export const SITE_NAME = "Intent";
/** Primary SEO brand phrase used across titles, copy, and schema */
export const BRAND_NAME = "Intent Revenue";
export const SITE_TAGLINE = "We Grow Revenue. By A Lot.";

/** Public business phone — consistent NAP sitewide for Google Search & schema.org */
export const BUSINESS_PHONE_E164 = "+14075437480";
export const BUSINESS_PHONE_DISPLAY = "(407) 543-7480";
export const BUSINESS_PHONE_TEL = `tel:${BUSINESS_PHONE_E164}`;
/** Alternate formats help phone-number queries match page content */
export const BUSINESS_PHONE_PLAIN = "4075437480";
export const BUSINESS_PHONE_HYPHEN = "407-543-7480";

export const BUSINESS_ADDRESS = {
  streetAddress: "1321 Madison Ivy Circle",
  addressLocality: "Apopka",
  addressRegion: "FL",
  postalCode: "32712",
  addressCountry: "US",
} as const;

export const BUSINESS_GEO = {
  latitude: 28.6762,
  longitude: -81.5115,
} as const;

/** Primary phrase for keyword consistency (title, H1, description, body) */
export const PRIMARY_KEYWORD_PHRASE = "contractor lead generation";

/** Default meta title: ~55 chars for search & social */
export const SEO_TITLE_DEFAULT = `${BRAND_NAME} | Revenue Growth for Contractors & Trades`;

/** Meta description: includes primary keyword, ~155-160 chars */
export const DEFAULT_DESCRIPTION =
  "Intent Revenue maps and grows revenue for HVAC, plumbing, roofing & home services: custom software, organic search growth, paid ads & content. Phone-first trades. Florida & nationwide.";

export const FLORIDA_KEYWORDS = [
  "Intent Revenue",
  "lead generation Florida",
  "marketing agency Florida",
  "Florida contractor leads",
  "Orlando lead generation",
  "Tampa lead generation",
  "Florida business growth",
  "revenue generation Florida",
  "lead generation Orlando",
  "lead generation Tampa",
];

export const CENTRAL_FLORIDA_KEYWORDS = [
  "lead generation Central Florida",
  "contractor marketing Orlando",
  "lead generation Orlando",
  "Tampa lead generation",
  "Kissimmee marketing",
  "Winter Park lead generation",
  "Lakeland contractor leads",
];

export const CONTRACTOR_KEYWORDS = [
  "Intent Revenue",
  "lead generation for contractors",
  "contractor lead generation",
  "contractor marketing",
  "HVAC lead generation",
  "plumbing lead generation",
  "roofing lead generation",
  "contractor leads",
  "home services lead generation",
  "marketing for contractors",
];

/** Helps site rank for direct phone lookups */
export const SEO_PHONE_KEYWORDS = [
  BUSINESS_PHONE_DISPLAY,
  BUSINESS_PHONE_HYPHEN,
  BUSINESS_PHONE_PLAIN,
  "407 543 7480",
  "Intent Revenue phone",
];
