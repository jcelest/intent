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

  return { message, status: 502 };
}
