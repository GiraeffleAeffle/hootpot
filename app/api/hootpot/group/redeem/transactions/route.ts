import { NextRequest, NextResponse } from "next/server";

import { buildGroupRedeemTransactions } from "@/lib/server/hootpot/group";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const input = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const operatorAddress = readString(input.operatorAddress);
  const amount = readString(input.amount);

  try {
    const transactions = await buildGroupRedeemTransactions({
      operatorAddress,
      amount,
    });
    return NextResponse.json({ ok: true, transactions });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "pot_owner_required") {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (
        error.message === "group_not_configured" ||
        error.message === "pot_not_configured" ||
        error.message === "operator_required" ||
        error.message === "invalid_amount" ||
        error.message === "group_token_balance_too_low" ||
        error.message === "no_redeemable_collateral_trust"
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.message === "no_group_redeem_path") {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
    }

    console.error("[hootpot] HOOT redemption transaction build failed", error);
    return NextResponse.json(
      { error: "could_not_build_group_redemption_transaction" },
      { status: 500 },
    );
  }
}
