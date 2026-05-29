import { NextRequest, NextResponse } from "next/server";

import { normalizeAmount } from "@/lib/hootpot/config";
import { createHootpotCheckout } from "@/lib/server/hootpot/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
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
  const merchantId = readString(input.merchantId);
  const amount =
    typeof input.amount === "string" || typeof input.amount === "number"
      ? normalizeAmount(input.amount)
      : null;
  const participantAddress = readString(input.participantAddress);

  if (!merchantId) {
    return NextResponse.json({ error: "merchant_required" }, { status: 400 });
  }
  if (!amount) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }

  try {
    const ticket = await createHootpotCheckout({
      merchantId,
      amount,
      participantAddress: participantAddress || null,
    });
    return NextResponse.json({ ok: true, ticket }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "merchant_not_found") {
      return NextResponse.json({ error: "merchant_not_found" }, { status: 404 });
    }
    console.error("[hootpot] checkout create failed", error);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
