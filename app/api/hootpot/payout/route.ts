import { NextRequest, NextResponse } from "next/server";

import { normalizeTxHash } from "@/lib/hootpot/amounts";
import { requireHootpotAdmin } from "@/lib/server/hootpot/admin";
import {
  getHootpotState,
  recordHootpotPayout,
} from "@/lib/server/hootpot/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const adminError = requireHootpotAdmin(request);
  if (adminError) return adminError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const payoutTxHash = normalizeTxHash(readString(input.payoutTxHash));
  if (!payoutTxHash) {
    return NextResponse.json({ error: "invalid_tx_hash" }, { status: 400 });
  }

  try {
    await recordHootpotPayout({ payoutTxHash });
    const state = await getHootpotState();
    return NextResponse.json({ ok: true, state });
  } catch (error) {
    if (error instanceof Error && error.message === "round_not_drawn") {
      return NextResponse.json({ error: "round_not_drawn" }, { status: 409 });
    }
    console.error("[hootpot] payout record failed", error);
    return NextResponse.json({ error: "payout_failed" }, { status: 500 });
  }
}
