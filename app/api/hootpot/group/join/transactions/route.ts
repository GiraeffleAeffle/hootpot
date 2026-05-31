import { NextRequest, NextResponse } from "next/server";

import { buildGroupJoinTransactions } from "@/lib/server/hootpot/group";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as Record<string, unknown>;
    const participantAddress = readString(input.participantAddress);
    const transactions = await buildGroupJoinTransactions({ participantAddress });

    return NextResponse.json({ ok: true, transactions });
  } catch (error) {
    if (error instanceof Error) {
      const status =
        error.message === "open_join_not_enabled" ? 409
        : error.message === "group_not_configured" ||
            error.message === "participant_required"
          ? 400
          : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("[hootpot] group join transaction build failed", error);
    return NextResponse.json(
      { error: "could_not_build_group_join_transaction" },
      { status: 500 },
    );
  }
}
