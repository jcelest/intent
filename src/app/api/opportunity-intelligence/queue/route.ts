import { NextResponse } from "next/server";
import { getIngestionQueueStatus, processQueueBatch } from "@/lib/continuous-ingestion-queue";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getIngestionQueueStatus();
    return NextResponse.json({ ok: true, status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed retrieving queue status";
    console.error("Failed getting ingestion queue status:", error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    let limit = 3;
    try {
      const body = await req.json();
      if (body && typeof body.limit === "number") {
        limit = Math.min(Math.max(body.limit, 1), 10);
      }
    } catch {
      // Body is optional
    }

    const batchResult = await processQueueBatch(limit);
    const updatedStatus = await getIngestionQueueStatus();

    return NextResponse.json({
      ok: true,
      batchResult,
      status: updatedStatus,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed processing queue batch";
    console.error("Failed processing ingestion queue batch:", error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
