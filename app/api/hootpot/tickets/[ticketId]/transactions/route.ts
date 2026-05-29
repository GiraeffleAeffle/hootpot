import { NextRequest, NextResponse } from "next/server";

import { buildHootpotPaymentTransactions } from "@/lib/server/hootpot/payments";
import { getHootpotTicket } from "@/lib/server/hootpot/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ ticketId: string }> },
) {
  const { ticketId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const participantAddress =
    body && typeof body === "object" && !Array.isArray(body)
      ? readString((body as Record<string, unknown>).participantAddress)
      : "";

  const ticket = await getHootpotTicket(ticketId);
  if (!ticket) {
    return NextResponse.json({ error: "ticket_not_found" }, { status: 404 });
  }
  if (ticket.status === "eligible" || ticket.status === "reimbursed") {
    return NextResponse.json({ error: "ticket_already_closed" }, { status: 409 });
  }

  try {
    const transactions = await buildHootpotPaymentTransactions({
      ticket,
      participantAddress,
    });
    return NextResponse.json({ ok: true, ticket, transactions });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "transaction_build_failed";
    const status =
      reason === "merchant_not_configured" ||
      reason === "participant_required" ||
      reason === "participant_mismatch"
        ? 400
        : 500;
    console.error("[hootpot] transaction build failed", reason);
    return NextResponse.json({ error: reason }, { status });
  }
}
