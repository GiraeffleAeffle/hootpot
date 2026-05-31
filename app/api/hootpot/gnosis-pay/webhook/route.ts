import { NextRequest, NextResponse } from "next/server";

import {
  mapGnosisPayWebhookPayloadToReceipt,
} from "@/lib/server/hootpot/gnosisPay";
import { verifyGnosisPayWebhook } from "@/lib/server/hootpot/gnosisPayWebhook";
import {
  getHootpotState,
  upsertExternalHootpotReceipts,
} from "@/lib/server/hootpot/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-webhook-signature") ?? "";
  const timestamp = request.headers.get("x-webhook-timestamp") ?? "";

  try {
    const verified = await verifyGnosisPayWebhook({
      body,
      signature,
      timestamp,
    });
    if (!verified) {
      return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
    }

    const payload = JSON.parse(body) as unknown;
    const receipt = mapGnosisPayWebhookPayloadToReceipt(payload);
    if (!receipt) {
      return NextResponse.json({ ok: true, importedCount: 0, ignored: true });
    }

    const result = await upsertExternalHootpotReceipts({ receipts: [receipt] });
    const state = await getHootpotState();
    return NextResponse.json({
      ok: true,
      importedCount: result.importedCount,
      updatedCount: result.updatedCount,
      state,
    });
  } catch (error) {
    console.error("[hootpot] Gnosis Pay webhook failed", error);
    return NextResponse.json({ error: "webhook_failed" }, { status: 500 });
  }
}
