import twilio from "twilio";

function env(name: string) {
  const value = process.env[name]?.trim() || "";
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    return value.slice(1, -1).trim();
  }
  return value;
}

export function getTwilioConfig() {
  return {
    accountSid: env("TWILIO_ACCOUNT_SID"),
    authToken: env("TWILIO_AUTH_TOKEN"),
    apiKeySid: env("TWILIO_API_KEY_SID"),
    apiKeySecret: env("TWILIO_API_KEY_SECRET"),
    twimlAppSid: env("TWILIO_TWIML_APP_SID"),
    phoneNumber: env("TWILIO_PHONE_NUMBER"),
    siteUrl: (env("DIALER_PUBLIC_URL") || env("NEXT_PUBLIC_SITE_URL")).replace(/\/$/, ""),
  };
}

export function getTwilioRestClient() {
  const config = getTwilioConfig();
  if (config.accountSid && config.apiKeySid && config.apiKeySecret) {
    return twilio(config.apiKeySid, config.apiKeySecret, { accountSid: config.accountSid });
  }
  if (config.accountSid && config.authToken) return twilio(config.accountSid, config.authToken);
  return null;
}

export function getTwilioRestAuthCandidates() {
  const config = getTwilioConfig();
  const candidates: Array<{ username: string; password: string }> = [];
  if (config.accountSid && config.authToken) candidates.push({ username: config.accountSid, password: config.authToken });
  if (config.apiKeySid && config.apiKeySecret) candidates.push({ username: config.apiKeySid, password: config.apiKeySecret });
  return candidates;
}

export function assertTwilioConfigured() {
  const config = getTwilioConfig();
  const missing = Object.entries(config)
    .filter(([key, value]) => key !== "siteUrl" && !value)
    .map(([key]) => key);
  if (missing.length) throw new Error(`Twilio is missing: ${missing.join(", ")}`);
  return config;
}

export function absoluteCallbackUrl(request: Request, path: string) {
  const config = getTwilioConfig();
  return `${config.siteUrl || new URL(request.url).origin}${path}`;
}

export function validateTwilioWebhook(request: Request, params: Record<string, string>) {
  const { authToken, siteUrl } = getTwilioConfig();
  if (!authToken) return process.env.NODE_ENV !== "production";
  const signature = request.headers.get("x-twilio-signature") || "";
  const incoming = new URL(request.url);
  const url = siteUrl ? `${siteUrl}${incoming.pathname}${incoming.search}` : request.url;
  return twilio.validateRequest(authToken, signature, url, params);
}

export { twilio };
