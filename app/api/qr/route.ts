import QRCode from "qrcode";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("value")?.trim();
  if (!value || value.length > 1000) {
    return NextResponse.json({ error: "invalid_value" }, { status: 400 });
  }

  const svg = await QRCode.toString(value, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 256,
    color: {
      dark: "#171428",
      light: "#fffdf8",
    },
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300",
    },
  });
}
