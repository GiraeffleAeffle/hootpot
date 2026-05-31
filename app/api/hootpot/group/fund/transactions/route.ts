import { NextRequest, NextResponse } from "next/server";

import { buildGroupFundTransactions } from "@/lib/server/hootpot/group";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as Record<string, unknown>;
    const participantAddress = readString(input.participantAddress);
    const amount = readString(input.amount);
    const transactions = await buildGroupFundTransactions({
      participantAddress,
      amount,
    });

    return NextResponse.json({ ok: true, transactions });
  } catch (error) {
    if (error instanceof Error) {
      if (
        "code" in error &&
        (error as Error & { code?: string }).code === "TRANSFER_NO_PATH"
      ) {
        return NextResponse.json({ error: "no_group_mint_path" }, { status: 409 });
      }
      const status =
        error.message === "group_not_configured" ||
        error.message === "participant_required" ||
        error.message === "invalid_amount"
          ? 400
          : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("[hootpot] group funding transaction build failed", error);
    return NextResponse.json(
      { error: "could_not_build_group_funding_transaction" },
      { status: 500 },
    );
  }
}
