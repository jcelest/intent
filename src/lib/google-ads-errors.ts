/**
 * Normalize google-ads-api failures (GoogleAdsFailure shape) for HTTP responses.
 */

type AdsFailureLike = {
  errors?: Array<{ message?: string | null } | null>;
};

function extractMessages(err: unknown): string {
  if (err instanceof Error && err.message && !err.message.includes("[object Object]")) {
    return err.message;
  }
  const f = err as AdsFailureLike;
  if (Array.isArray(f.errors)) {
    const parts = f.errors
      .map((e) => e?.message)
      .filter((m): m is string => Boolean(m && m.trim()));
    if (parts.length) return parts.join(" ");
  }
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return "Google Ads API request failed.";
}

export type GoogleAdsHttpError = {
  message: string;
  status: number;
  code?: string;
};

export function toGoogleAdsHttpError(err: unknown): GoogleAdsHttpError {
  const message = extractMessages(err);

  if (message.includes("only approved for use with test accounts")) {
    return {
      code: "DEVELOPER_TOKEN_TEST_ONLY",
      status: 403,
      message:
        `${message} ` +
        "While your developer token is in test mode, set GOOGLE_ADS_CUSTOMER_ID (and LOGIN if needed) to a " +
        "Google Ads test account only. To call production accounts, apply for Basic or Standard access in " +
        "Google Ads → Tools → API Center.",
    };
  }

  if (
    message.includes("login-customer-id") ||
    message.includes("manager's customer id must be set")
  ) {
    return {
      code: "LOGIN_CUSTOMER_ID_REQUIRED",
      status: 403,
      message:
        `${message} ` +
        "Set GOOGLE_ADS_LOGIN_CUSTOMER_ID in Vercel/.env.local to your **test manager (MCC)** 10-digit ID, and " +
        "GOOGLE_ADS_CUSTOMER_ID to the **client** account you are querying (under that manager). " +
        "If you only use one account, try setting both to that account’s ID or only CUSTOMER_ID for direct access. " +
        "Your OAuth refresh token must be for a Google user who can access that Ads account (re-run OAuth if you switched accounts).",
    };
  }

  return { message, status: 502 };
}
