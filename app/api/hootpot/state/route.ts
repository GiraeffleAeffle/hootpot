import { NextResponse } from "next/server";

import { getHootpotState } from "@/lib/server/hootpot/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const state = await getHootpotState();
  return NextResponse.json({ ok: true, state });
}
