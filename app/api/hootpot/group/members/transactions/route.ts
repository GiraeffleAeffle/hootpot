import { NextRequest, NextResponse } from "next/server";

import { buildGroupMemberTransactions } from "@/lib/server/hootpot/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const input = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const operatorAddress = readString(input.operatorAddress);
  const memberAddress = readString(input.memberAddress);

  try {
    const transactions = await buildGroupMemberTransactions({
      operatorAddress,
      memberAddress,
    });
    return NextResponse.json({ ok: true, transactions });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "group_owner_or_service_required") {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (
        error.message === "group_not_configured" ||
        error.message === "operator_required" ||
        error.message === "member_required" ||
        error.message === "member_is_group"
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    console.error("[hootpot] group member transaction build failed", error);
    return NextResponse.json(
      { error: "could_not_build_group_member_transaction" },
      { status: 500 },
    );
  }
}
