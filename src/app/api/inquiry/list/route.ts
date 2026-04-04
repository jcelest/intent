import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSubmissions } from "@/lib/form-store";

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  const submissions = getSubmissions();
  return NextResponse.json(submissions);
}
