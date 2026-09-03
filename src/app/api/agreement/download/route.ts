import { NextResponse } from "next/server";
import * as db from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") || searchParams.get("id"); // fallback to id for backwards compatibility if needed
  
  if (!token) {
    return NextResponse.json({ error: "Missing agreement token" }, { status: 400 });
  }

  try {
    const record = await db.getAgreementByDownloadToken(token);
    
    if (!record) {
      return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
    }

    return new NextResponse(record.agreement_html, {
      headers: {
        "Content-Type": "text/html",
        "Content-Disposition": `attachment; filename="LeadNet-Service-Agreement-${record.company_name.replace(/[^a-z0-9]/gi, '_')}.html"`,
      },
    });

  } catch (err) {
    console.error("Failed to fetch agreement from DB", err);
    return NextResponse.json({ error: "Could not retrieve agreement" }, { status: 500 });
  }
}
