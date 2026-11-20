import { NextResponse } from "next/server";
import { requireDialerSession } from "@/lib/dialer-auth";
import { assertTwilioConfigured, getTwilioRestClient, twilio } from "@/lib/twilio-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  try {
    const config = assertTwilioConfigured();
    const client = getTwilioRestClient();
    if (!client) throw new Error("Twilio REST credentials are not configured.");
    try {
      // Standard Twilio API keys cannot read the Accounts resource. Fetching the
      // configured TwiML App validates the key/secret and account relationship
      // against an endpoint Standard keys are permitted to access.
      await client.applications(config.twimlAppSid).fetch();
    } catch (cause) {
      const status = typeof cause === "object" && cause && "status" in cause ? Number(cause.status) : 0;
      if (status === 401 || status === 403) throw new Error("Twilio rejected the API Key SID or API Key Secret. Update that credential pair in Vercel.");
      if (status === 404) throw new Error("Twilio could not find the configured TwiML App SID in this account.");
      throw cause;
    }
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;
    const token = new AccessToken(config.accountSid, config.apiKeySid, config.apiKeySecret, {
      identity: auth.user.id,
      ttl: 60 * 60,
    });
    token.addGrant(new VoiceGrant({ outgoingApplicationSid: config.twimlAppSid, incomingAllow: true }));
    return NextResponse.json({ token: token.toJwt(), identity: auth.user.id, expiresIn: 3600 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Twilio is not configured." },
      { status: 503 },
    );
  }
}
