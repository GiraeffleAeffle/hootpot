import { NextRequest, NextResponse } from "next/server";

import { buildGroupFundTransactions } from "@/lib/server/hootpot/group";

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
    const transactions = await buildGroupFundTransactions({
      participantAddress,
      amount,
    });
    return NextResponse.json({ ok: true, transactions });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === "group_not_configured" ||
        error.message === "participant_required" ||
        error.message === "invalid_amount"
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "TRANSFER_NO_PATH"
    ) {
      return NextResponse.json({ error: "no_group_mint_path" }, { status: 409 });
    }

    console.error("[hootpot] HOOT support transaction build failed", error);
    return NextResponse.json({ error: "no_group_mint_path" }, { status: 409 });
  }
}
