import { NextRequest, NextResponse } from "next/server";

import { requireHootpotAdmin } from "@/lib/server/hootpot/admin";
import { clearHootpotTickets, getHootpotState } from "@/lib/server/hootpot/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  const adminError = requireHootpotAdmin(request);
  if (adminError) return adminError;

  await clearHootpotTickets();
  const state = await getHootpotState();
  return NextResponse.json({ ok: true, state });
}
