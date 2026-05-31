import { NextRequest, NextResponse } from "next/server";

import { isConfiguredAddress } from "@/lib/hootpot/config";
import { fetchGnosisPayNonce, GnosisPayApiError } from "@/lib/server/hootpot/gnosisPay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function requestOrigin(request: NextRequest): { domain: string; origin: string } {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host") ?? "localhost:3000";
  const protocol =
    request.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return {
    domain: host,
    origin: `${protocol}://${host}`,
  };
}

function buildSiweMessage(input: {
  address: string;
  domain: string;
  origin: string;
  nonce: string;
}): string {
  return `${input.domain} wants you to sign in with your Ethereum account:
${input.address}

Sync Gnosis Pay card receipts into Hootpot.

URI: ${input.origin}
Version: 1
Chain ID: 100
Nonce: ${input.nonce}
Issued At: ${new Date().toISOString()}`;
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

  const participantAddress = readString(
    (body as Record<string, unknown>).participantAddress,
  );
  if (!isConfiguredAddress(participantAddress)) {
    return NextResponse.json({ error: "participant_address_required" }, { status: 400 });
  }

  try {
    const nonce = await fetchGnosisPayNonce();
    const { domain, origin } = requestOrigin(request);
    return NextResponse.json({
      ok: true,
      message: buildSiweMessage({
        address: participantAddress,
        domain,
        origin,
        nonce,
      }),
      signatureType: "erc1271",
      ttlInSeconds: 3600,
    });
  } catch (error) {
    if (error instanceof GnosisPayApiError) {
      return NextResponse.json(
        { error: "gnosis_pay_api_failed", detail: error.message },
        { status: 502 },
      );
    }
    console.error("[hootpot] Gnosis Pay SIWE session failed", error);
    return NextResponse.json({ error: "gnosis_pay_session_failed" }, { status: 500 });
  }
}
