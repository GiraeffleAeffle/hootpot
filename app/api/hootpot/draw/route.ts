import { NextRequest, NextResponse } from "next/server";

import { requireHootpotAdmin } from "@/lib/server/hootpot/admin";
import { drawHootpotRound, getHootpotState } from "@/lib/server/hootpot/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const adminError = requireHootpotAdmin(request);
  if (adminError) return adminError;

  let seed: string | undefined;
  try {
    const input = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    seed = readString(input.seed) || undefined;
  } catch {
    seed = undefined;
  }

  try {
    await drawHootpotRound({ seed });
    const state = await getHootpotState();
    return NextResponse.json({ ok: true, state });
  } catch (error) {
    if (error instanceof Error && error.message === "no_eligible_tickets") {
      return NextResponse.json({ error: "no_eligible_tickets" }, { status: 409 });
    }
    if (error instanceof Error && error.message === "winner_missing_address") {
      return NextResponse.json({ error: "winner_missing_address" }, { status: 409 });
    }
    if (error instanceof Error && error.message === "pot_empty") {
      return NextResponse.json({ error: "pot_empty" }, { status: 409 });
    }
    console.error("[hootpot] draw failed", error);
    return NextResponse.json({ error: "draw_failed" }, { status: 500 });
  }
}
