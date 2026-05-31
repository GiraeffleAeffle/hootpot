import { NextRequest, NextResponse } from "next/server";

import { buildPotTrustTransactions } from "@/lib/server/hootpot/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const input = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const operatorAddress = readString(input.operatorAddress);
  const trustedAddress = readString(input.trustedAddress);

  try {
    const transactions = await buildPotTrustTransactions({
      operatorAddress,
      trustedAddress,
    });
    return NextResponse.json({ ok: true, transactions });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "pot_owner_required") {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (
        error.message === "pot_not_configured" ||
        error.message === "operator_required" ||
        error.message === "trusted_address_required" ||
        error.message === "trusted_address_is_pot"
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    console.error("[hootpot] pot trust transaction build failed", error);
    return NextResponse.json(
      { error: "could_not_build_pot_trust_transaction" },
      { status: 500 },
    );
  }
}
