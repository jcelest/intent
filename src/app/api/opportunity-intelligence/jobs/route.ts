import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getCollectionJobs, runCollectionJob } from "@/lib/opportunity-intelligence";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  try {
    const jobs = await getCollectionJobs();
    return NextResponse.json({ ok: true, jobs });
  } catch (error) {
    console.error("API collection jobs error:", error);
    return NextResponse.json({ ok: false, error: "Failed to load collection jobs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const jobType = body.jobType || "all_sources";
    const targetSourceId = body.targetSourceId;

    const result = await runCollectionJob(jobType, targetSourceId);
    return NextResponse.json({ ok: result.success, jobId: result.jobId });
  } catch (error) {
    console.error("API run collection job error:", error);
    return NextResponse.json({ ok: false, error: "Failed to trigger collection job" }, { status: 500 });
  }
}
