import { createPublicKey, verify } from "node:crypto";

const DEFAULT_PUBLIC_KEY_URL = "https://webhooks.gnosispay.com/api/v1/public-key";
const DEFAULT_MAX_SKEW_SECONDS = 5 * 60;
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

let cachedPublicKey: string | null = null;

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function getWebhookPublicKey(): Promise<string> {
  const configured = process.env.GNOSIS_PAY_WEBHOOK_PUBLIC_KEY?.trim();
  if (configured) return configured;
  if (cachedPublicKey) return cachedPublicKey;

  const url =
    process.env.GNOSIS_PAY_WEBHOOK_PUBLIC_KEY_URL?.trim() || DEFAULT_PUBLIC_KEY_URL;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  const publicKey = readString(readRecord(payload).publicKey);
  if (!response.ok || !publicKey) {
    throw new Error("gnosis_pay_webhook_public_key_unavailable");
  }

  cachedPublicKey = publicKey;
  return publicKey;
}

function publicKeyForVerify(publicKey: string) {
  if (publicKey.includes("BEGIN PUBLIC KEY")) {
    return publicKey;
  }

  const raw = Buffer.from(publicKey, "base64");
  if (raw.length === 32) {
    return createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, raw]),
      format: "der",
      type: "spki",
    });
  }

  return publicKey;
}

function verifyTimestamp(timestamp: string): boolean {
  if (!/^\d+$/.test(timestamp)) return false;
  const raw = Number(timestamp);
  const timestampMs = raw > 1_000_000_000_000 ? raw : raw * 1000;
  const maxSkewSeconds = Number(
    process.env.GNOSIS_PAY_WEBHOOK_MAX_SKEW_SECONDS ?? DEFAULT_MAX_SKEW_SECONDS,
  );
  return Math.abs(Date.now() - timestampMs) <= maxSkewSeconds * 1000;
}

export async function verifyGnosisPayWebhook(input: {
  body: string;
  signature: string;
  timestamp: string;
}): Promise<boolean> {
  if (!input.signature || !input.timestamp || !verifyTimestamp(input.timestamp)) {
    return false;
  }

  try {
    const publicKey = await getWebhookPublicKey();
    return verify(
      null,
      Buffer.from(`${input.timestamp}.${input.body}`, "utf8"),
      publicKeyForVerify(publicKey),
      Buffer.from(input.signature, "base64"),
    );
  } catch {
    return false;
  }
}
