import { NextResponse } from "next/server";
import { requireDialerSession } from "@/lib/dialer-auth";
import { assertTwilioConfigured, twilio } from "@/lib/twilio-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  try {
    const config = assertTwilioConfigured();
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
