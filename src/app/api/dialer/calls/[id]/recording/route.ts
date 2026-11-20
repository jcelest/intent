import { NextResponse } from "next/server";
import { requireDialerSession } from "@/lib/dialer-auth";
import { sql } from "@/lib/db";
import { getTwilioConfig, getTwilioRestAuthCandidates, getTwilioRestClient } from "@/lib/twilio-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;

  const url = new URL(request.url);
  const requestedFormat = (url.searchParams.get("format") || "mp3").toLowerCase();
  const format = requestedFormat === "wav" ? "wav" : "mp3";
  const isDownload = url.searchParams.get("download") === "1" || url.searchParams.get("download") === "true";

  const rows = await sql`
    SELECT c.*, l.first_name, l.last_name, l.company
    FROM dialer_calls c
    LEFT JOIN dialer_leads l ON l.id = c.lead_id
    WHERE c.id = ${params.id}
    LIMIT 1
  `;
  const call = rows[0];
  if (!call) {
    return NextResponse.json({ error: "Call not found." }, { status: 404 });
  }

  let recordingSid = (call.recording_sid as string | null) || null;
  let recordingUrl = (call.recording_url as string | null) || null;

  // Auto-sync from Twilio if SID is missing but call SIDs exist
  if (!recordingSid && (call.twilio_call_sid || call.twilio_parent_call_sid)) {
    try {
      const config = getTwilioConfig();
      const client = getTwilioRestClient();
      if (config.accountSid && client) {
        let twilioRecordings: Array<{ sid: string }> = [];
        if (call.twilio_call_sid) {
          twilioRecordings = await client.recordings.list({ callSid: call.twilio_call_sid as string, limit: 1 });
        }
        if (!twilioRecordings.length && call.twilio_parent_call_sid && call.twilio_parent_call_sid !== call.twilio_call_sid) {
          twilioRecordings = await client.recordings.list({ callSid: call.twilio_parent_call_sid as string, limit: 1 });
        }
        if (twilioRecordings.length > 0) {
          const rec = twilioRecordings[0];
          recordingSid = rec.sid;
          recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Recordings/${rec.sid}`;
          await sql`
            UPDATE dialer_calls
            SET recording_sid = ${rec.sid}, recording_url = ${recordingUrl}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${params.id}
          `;
        }
      }
    } catch (err) {
      console.warn("Failed to lookup recording in Twilio", err);
    }
  }

  if (!recordingSid && !recordingUrl) {
    return NextResponse.json({ error: "No recording available for this call." }, { status: 404 });
  }

  const config = getTwilioConfig();
  let mediaUrl: string;

  if (recordingSid && config.accountSid) {
    mediaUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Recordings/${recordingSid}.${format}`;
  } else if (recordingUrl) {
    if (recordingUrl.includes("api.twilio.com")) {
      const base = recordingUrl.replace(/\.(mp3|wav|json)$/i, "");
      mediaUrl = `${base}.${format}`;
    } else {
      mediaUrl = recordingUrl;
    }
  } else {
    return NextResponse.json({ error: "Unable to resolve recording media URL." }, { status: 404 });
  }

  const forwardHeaders: Record<string, string> = {};
  const clientRange = request.headers.get("range");
  if (clientRange) {
    forwardHeaders["Range"] = clientRange;
  }

  try {
    const authCandidates = mediaUrl.includes("api.twilio.com") ? getTwilioRestAuthCandidates() : [];
    let upstreamRes: Response;
    if (!authCandidates.length) {
      upstreamRes = await fetch(mediaUrl, { headers: forwardHeaders });
    } else {
      let lastResponse: Response | null = null;
      for (const candidate of authCandidates) {
        const credentials = Buffer.from(`${candidate.username}:${candidate.password}`).toString("base64");
        const response = await fetch(mediaUrl, { headers: { ...forwardHeaders, Authorization: `Basic ${credentials}` } });
        lastResponse = response;
        if (response.status !== 401 && response.status !== 403) break;
        await response.body?.cancel();
      }
      upstreamRes = lastResponse as Response;
    }

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return NextResponse.json(
        { error: `Twilio recording stream error: ${upstreamRes.status} ${upstreamRes.statusText}` },
        { status: upstreamRes.status }
      );
    }

    const contactParts = [call.first_name, call.last_name].filter(Boolean);
    const contactName = contactParts.length ? contactParts.join("-") : (call.company as string) || "call";
    const safeContact = contactName.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
    const filename = `call-${params.id.slice(0, 8)}-${safeContact}.${format}`;

    const contentType = format === "wav" ? "audio/wav" : "audio/mpeg";
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Accept-Ranges", "bytes");

    if (isDownload) {
      headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    } else {
      headers.set("Content-Disposition", `inline; filename="${filename}"`);
    }

    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);

    const contentRange = upstreamRes.headers.get("content-range");
    if (contentRange) headers.set("Content-Range", contentRange);

    return new NextResponse(upstreamRes.body, {
      status: upstreamRes.status,
      headers,
    });
  } catch (err) {
    console.error("Failed to stream recording", err);
    return NextResponse.json({ error: "Unable to stream recording." }, { status: 502 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;

  const body = (await request.json()) as {
    recordingUrl?: string;
    recordingSid?: string;
    syncFromTwilio?: boolean;
  };

  let recordingSid = body.recordingSid?.trim() || null;
  let recordingUrl = body.recordingUrl?.trim() || null;

  if (body.syncFromTwilio) {
    const rows = await sql`
      SELECT twilio_call_sid, twilio_parent_call_sid FROM dialer_calls WHERE id = ${params.id} LIMIT 1
    `;
    const call = rows[0];
    if (call?.twilio_call_sid || call?.twilio_parent_call_sid) {
      const config = getTwilioConfig();
      const client = getTwilioRestClient();
      if (config.accountSid && client) {
        let twilioRecordings: Array<{ sid: string }> = [];
        if (call.twilio_call_sid) {
          twilioRecordings = await client.recordings.list({ callSid: call.twilio_call_sid as string, limit: 1 });
        }
        if (!twilioRecordings.length && call.twilio_parent_call_sid && call.twilio_parent_call_sid !== call.twilio_call_sid) {
          twilioRecordings = await client.recordings.list({ callSid: call.twilio_parent_call_sid as string, limit: 1 });
        }
        if (twilioRecordings.length > 0) {
          recordingSid = twilioRecordings[0].sid;
          recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Recordings/${recordingSid}`;
        } else {
          return NextResponse.json({ error: "No recordings found on Twilio for this call." }, { status: 404 });
        }
      } else {
        return NextResponse.json({ error: "Twilio credentials are not configured." }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "This call has no associated Twilio Call SID." }, { status: 400 });
    }
  }

  if (!recordingSid && !recordingUrl) {
    return NextResponse.json({ error: "recordingSid or recordingUrl is required." }, { status: 400 });
  }

  const rows = await sql`
    UPDATE dialer_calls
    SET
      recording_sid = COALESCE(${recordingSid}, recording_sid),
      recording_url = COALESCE(${recordingUrl}, recording_url),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${params.id}
    RETURNING *
  `;

  if (!rows.length) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  return NextResponse.json({ success: true, call: rows[0] });
}
