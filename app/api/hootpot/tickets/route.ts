import { NextResponse } from "next/server";

import { clearHootpotTickets, getHootpotState } from "@/lib/server/hootpot/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE() {
  await clearHootpotTickets();
  const state = await getHootpotState();
  return NextResponse.json({ ok: true, state });
}
