import { NextRequest, NextResponse } from "next/server";

import { getHootSupportState } from "@/lib/server/hootpot/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const participantAddress =
    request.nextUrl.searchParams.get("participantAddress")?.trim() ?? "";

  try {
    const support = await getHootSupportState({ participantAddress });
    return NextResponse.json({ ok: true, support });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === "group_not_configured" ||
        error.message === "participant_required"
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    console.error("[hootpot] HOOT support state failed", error);
    return NextResponse.json(
      { error: "could_not_load_group_support_state" },
      { status: 500 },
    );
  }
}
