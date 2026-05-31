import { NextRequest, NextResponse } from "next/server";

import { buildGroupDonationTransactions } from "@/lib/server/hootpot/group";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const input = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const participantAddress = readString(input.participantAddress);
  const amount = readString(input.amount);

  try {
    const transactions = await buildGroupDonationTransactions({
      participantAddress,
      amount,
    });
    return NextResponse.json({ ok: true, transactions });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === "group_not_configured" ||
        error.message === "pot_not_configured" ||
        error.message === "participant_required" ||
        error.message === "invalid_amount" ||
        error.message === "group_token_balance_too_low"
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    console.error("[hootpot] HOOT donation transaction build failed", error);
    return NextResponse.json(
      { error: "could_not_build_group_donation_transaction" },
      { status: 500 },
    );
  }
}
