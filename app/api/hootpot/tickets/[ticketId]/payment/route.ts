import { NextRequest, NextResponse } from "next/server";

import { verifyHootpotPayment } from "@/lib/server/hootpot/payments";
import {
  getHootpotState,
  getHootpotTicket,
  markHootpotTicketEligible,
  recordHootpotPaymentSubmission,
} from "@/lib/server/hootpot/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
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

  const txHashes =
    body && typeof body === "object" && !Array.isArray(body)
      ? readStringArray((body as Record<string, unknown>).txHashes)
      : [];
  if (txHashes.length === 0) {
    return NextResponse.json({ error: "tx_hash_required" }, { status: 400 });
  }

  const ticket = await getHootpotTicket(ticketId);
  if (!ticket) {
    return NextResponse.json({ error: "ticket_not_found" }, { status: 404 });
  }

  await recordHootpotPaymentSubmission({ ticketId, txHashes });
  const verification = await verifyHootpotPayment({ ticket, txHashes });

  if (verification.status === "verified") {
    await markHootpotTicketEligible({
      ticketId,
      txHash: verification.txHash,
      txHashes,
    });
  } else {
    await recordHootpotPaymentSubmission({
      ticketId,
      txHashes,
      verificationError: verification.reason,
    });
  }

  const state = await getHootpotState();
  const updatedTicket =
    state.tickets.find((stateTicket) => stateTicket.ticketId === ticketId) ?? null;

  return NextResponse.json({
    ok: verification.status !== "failed",
    ticket: updatedTicket,
    state,
    verification,
  });
}
