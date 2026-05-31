import { NextRequest, NextResponse } from "next/server";

import { buildGroupOpenServiceSetupTransactions } from "@/lib/server/hootpot/group";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as Record<string, unknown>;
    const operatorAddress = readString(input.operatorAddress);
    const transactions = await buildGroupOpenServiceSetupTransactions({
      operatorAddress,
    });

    return NextResponse.json({ ok: true, transactions });
  } catch (error) {
    if (error instanceof Error) {
      const status =
        error.message === "group_owner_required" ? 403
        : error.message === "group_not_configured" ||
            error.message === "open_service_not_configured" ||
            error.message === "operator_required"
          ? 400
          : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("[hootpot] group service setup transaction build failed", error);
    return NextResponse.json(
      { error: "could_not_build_group_service_transaction" },
      { status: 500 },
    );
  }
}
