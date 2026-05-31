import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

function readBearerToken(request: NextRequest): string {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function requireHootpotAdmin(request: NextRequest): NextResponse | null {
  const expectedSecret = process.env.HOOTPOT_ADMIN_SECRET?.trim();

  if (!expectedSecret) {
    if (process.env.NODE_ENV !== "production") return null;
    return NextResponse.json(
      { error: "admin_secret_not_configured" },
      { status: 503 },
    );
  }

  const providedSecret =
    request.headers.get("x-hootpot-admin-secret")?.trim() ||
    readBearerToken(request);

  if (!providedSecret || !constantTimeEquals(providedSecret, expectedSecret)) {
    return NextResponse.json({ error: "admin_required" }, { status: 401 });
  }

  return null;
}
