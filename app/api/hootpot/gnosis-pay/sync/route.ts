import { NextRequest, NextResponse } from "next/server";

import { isConfiguredAddress } from "@/lib/hootpot/config";
import {
  fetchGnosisPayAccountAddresses,
  fetchGnosisPayCardTransactions,
  GnosisPayApiError,
  mapGnosisPayTransactionToReceipt,
  requestGnosisPayAccessToken,
} from "@/lib/server/hootpot/gnosisPay";
import {
  getHootpotState,
  upsertExternalHootpotReceipts,
} from "@/lib/server/hootpot/store";

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
  const participantAddress = readString(input.participantAddress);
  const message = readString(input.message);
  const signature = readString(input.signature);

  if (!isConfiguredAddress(participantAddress)) {
    return NextResponse.json({ error: "participant_address_required" }, { status: 400 });
  }
  if (!message || !signature) {
    return NextResponse.json({ error: "signature_required" }, { status: 400 });
  }

  try {
    const accessToken = await requestGnosisPayAccessToken({
      message,
      signature,
      ttlInSeconds: 3600,
    });
    const accountAddresses = await fetchGnosisPayAccountAddresses(accessToken);
    if (
      accountAddresses.length === 0 ||
      !accountAddresses.includes(participantAddress.toLowerCase())
    ) {
      return NextResponse.json(
        { error: "participant_not_linked_to_gnosis_pay_account" },
        { status: 403 },
      );
    }

    const transactions = await fetchGnosisPayCardTransactions({
      accessToken,
      limit: 100,
    });
    const receipts = transactions
      .map((transaction) =>
        mapGnosisPayTransactionToReceipt({
          transaction,
          participantAddress,
        }),
      )
      .filter((receipt) => receipt !== null);

    const result = await upsertExternalHootpotReceipts({ receipts });
    const state = await getHootpotState();
    return NextResponse.json({
      ok: true,
      importedCount: result.importedCount,
      updatedCount: result.updatedCount,
      skippedCount: transactions.length - receipts.length,
      state,
    });
  } catch (error) {
    if (error instanceof GnosisPayApiError) {
      const status = error.status === 401 || error.status === 403 ? error.status : 502;
      if (/domain.*not.*allowed/i.test(error.message)) {
        return NextResponse.json(
          {
            error: "gnosis_pay_domain_not_allowed",
            detail: error.message,
          },
          { status },
        );
      }
      return NextResponse.json(
        { error: "gnosis_pay_api_failed", detail: error.message },
        { status },
      );
    }
    console.error("[hootpot] Gnosis Pay sync failed", error);
    return NextResponse.json({ error: "gnosis_pay_sync_failed" }, { status: 500 });
  }
}
