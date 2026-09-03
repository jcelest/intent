import { NextResponse } from "next/server";
import { getAgreementRecord } from "@/lib/agreements-db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  
  if (!id) {
    return NextResponse.json({ error: "Missing agreement ID" }, { status: 400 });
  }

  const record = await getAgreementRecord(id);
  if (!record) {
    return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
  }

  return new NextResponse(record.agreementHtml, {
    headers: {
      "Content-Type": "text/html",
      "Content-Disposition": `attachment; filename="LeadNet-Service-Agreement-${record.companyName.replace(/[^a-z0-9]/gi, '_')}.html"`,
    },
  });
}
