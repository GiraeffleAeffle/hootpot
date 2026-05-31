import { createHash } from "node:crypto";

import { normalizeAmount } from "@/lib/hootpot/config";
import type { ExternalHootpotReceiptInput } from "@/lib/server/hootpot/store";

type JsonRecord = Record<string, unknown>;

export class GnosisPayApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "GnosisPayApiError";
  }
}

const DEFAULT_API_BASE_URL = "https://api.gnosispay.com";
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;

function apiBaseUrl(): string {
  return (process.env.GNOSIS_PAY_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(
    /\/+$/,
    "",
  );
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function readRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readInteger(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return fallback;
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function formatMinorUnits(rawAmount: string, decimals: number): string | null {
  const trimmed = rawAmount.trim();
  if (!trimmed) return null;
  if (/^\d+\.\d+$/.test(trimmed)) return normalizeAmount(trimmed);
  if (!/^-?\d+$/.test(trimmed)) return null;

  const negative = trimmed.startsWith("-");
  const digits = negative ? trimmed.slice(1) : trimmed;
  if (decimals <= 0) return normalizeAmount(`${negative ? "-" : ""}${digits}`);

  const padded = digits.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return normalizeAmount(`${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`);
}

async function fetchGnosisPayJson(pathname: string, accessToken: string): Promise<unknown> {
  const response = await fetch(`${apiBaseUrl()}${pathname}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage =
      readString(readRecord(payload).message) ||
      readString(readRecord(payload).error) ||
      `Gnosis Pay API request failed with ${response.status}.`;
    throw new GnosisPayApiError(errorMessage, response.status);
  }

  return payload;
}

function extractTransactionResults(payload: unknown): JsonRecord[] {
  if (Array.isArray(payload)) return payload.map(readRecord);

  const root = readRecord(payload);
  const results = readArray(root.results);
  if (results.length > 0) return results.map(readRecord);

  const data = readRecord(root.data);
  return readArray(data.results).map(readRecord);
}

function collectAddress(addresses: Set<string>, value: unknown) {
  const address = readString(value);
  if (ADDRESS_PATTERN.test(address)) {
    addresses.add(address.toLowerCase());
  }
}

function collectAddressObject(addresses: Set<string>, value: unknown) {
  const record = readRecord(value);
  collectAddress(addresses, record.address);
  collectAddress(addresses, record.safeAddress);
  collectAddress(addresses, record.safeWalletAddress);
}

export async function fetchGnosisPayAccountAddresses(
  accessToken: string,
): Promise<string[]> {
  const [safeConfig, user, eoaAccounts, owners] = await Promise.allSettled([
    fetchGnosisPayJson("/api/v1/safe-config", accessToken),
    fetchGnosisPayJson("/api/v1/user", accessToken),
    fetchGnosisPayJson("/api/v1/eoa-accounts", accessToken),
    fetchGnosisPayJson("/api/v1/owners", accessToken),
  ]);
  const addresses = new Set<string>();

  if (safeConfig.status === "fulfilled") {
    const root = readRecord(safeConfig.value);
    collectAddressObject(addresses, root);
    collectAddressObject(addresses, root.safe);
    collectAddressObject(addresses, root.safeWallet);
    collectAddressObject(addresses, readRecord(root.data));
    collectAddressObject(addresses, readRecord(root.data).safe);
    collectAddressObject(addresses, readRecord(root.data).safeWallet);
  }

  if (user.status === "fulfilled") {
    const root = readRecord(user.value);
    const data = readRecord(root.data);
    for (const wallet of readArray(root.safeWallets).concat(readArray(data.safeWallets))) {
      collectAddressObject(addresses, wallet);
    }
    for (const wallet of readArray(root.signInWallets).concat(readArray(data.signInWallets))) {
      collectAddressObject(addresses, wallet);
    }
  }

  if (eoaAccounts.status === "fulfilled") {
    const root = readRecord(eoaAccounts.value);
    const accounts = readArray(readRecord(root.data).eoaAccounts);
    for (const account of accounts) {
      collectAddress(addresses, readRecord(account).address);
    }
  }

  if (owners.status === "fulfilled") {
    const root = readRecord(owners.value);
    for (const owner of readArray(readRecord(root.data).owners)) {
      collectAddress(addresses, owner);
    }
  }

  if (
    safeConfig.status === "rejected" &&
    user.status === "rejected" &&
    eoaAccounts.status === "rejected" &&
    owners.status === "rejected"
  ) {
    const firstError = safeConfig.reason;
    if (firstError instanceof GnosisPayApiError) throw firstError;
    throw new Error("gnosis_pay_account_lookup_failed");
  }

  return [...addresses];
}

export async function fetchGnosisPayCardTransactions(input: {
  accessToken: string;
  limit?: number;
}): Promise<JsonRecord[]> {
  const limit = Math.min(Math.max(input.limit ?? 25, 10), 100);
  const params = new URLSearchParams({
    limit: String(limit),
    offset: "0",
  });
  const payload = await fetchGnosisPayJson(
    `/api/v1/cards/transactions?${params}`,
    input.accessToken,
  );
  return extractTransactionResults(payload);
}

export function mapGnosisPayTransactionToReceipt(input: {
  transaction: JsonRecord;
  participantAddress: string;
}): ExternalHootpotReceiptInput | null {
  const transaction = input.transaction;
  const kind = readString(transaction.kind);
  const status = readString(transaction.status);

  if (kind && kind.toLowerCase() !== "payment") return null;
  if (/declined|failed|rejected|cancelled/i.test(status)) return null;

  const merchant = readRecord(transaction.merchant);
  const merchantCountry = readRecord(merchant.country);
  const billingCurrency = readRecord(transaction.billingCurrency);
  const transactionCurrency = readRecord(transaction.transactionCurrency);
  const currencyCode =
    readString(billingCurrency.code) || readString(transactionCurrency.code) || "EUR";
  const decimals = readInteger(billingCurrency.decimals, 2);
  const transactionDecimals = readInteger(transactionCurrency.decimals, decimals);
  const paymentAmount =
    formatMinorUnits(readString(transaction.billingAmount), decimals) ??
    formatMinorUnits(readString(transaction.transactionAmount), transactionDecimals) ??
    null;

  if (!paymentAmount) return null;

  const onchainTransactions = readArray(transaction.transactions).map(readRecord);
  const txHashes = onchainTransactions
    .map((entry) => readString(entry.hash))
    .filter((hash) => HASH_PATTERN.test(hash));
  const sourcePayloadHash = hashJson(transaction);
  const externalTransactionId =
    readString(transaction.threadId) ||
    readString(transaction.id) ||
    txHashes[0] ||
    undefined;
  const createdAt = readString(transaction.createdAt);
  const receiptBasis =
    externalTransactionId ??
    [
      createdAt,
      readString(transaction.cardToken),
      readString(merchant.name),
      readString(transaction.billingAmount),
      currencyCode,
      txHashes.join(","),
    ].join("|");
  const externalReceiptId = externalTransactionId ?? `gp-${hashJson(receiptBasis)}`;
  const merchantName = readString(merchant.name) || "Gnosis Pay merchant";
  const pendingLabel = readBoolean(transaction.isPending) ? "pending" : "cleared";
  const externalStatus = [kind || "Payment", status, pendingLabel]
    .filter(Boolean)
    .join(" / ");

  return {
    source: "gnosis_pay",
    externalReceiptId,
    externalTransactionId,
    sourcePayloadHash,
    merchantName,
    participantAddress: input.participantAddress,
    amount: paymentAmount,
    paymentAmount,
    paymentCurrency: currencyCode,
    sourceAmountLabel: `${paymentAmount} ${currencyCode}`,
    externalStatus,
    externalMerchantCity: readString(merchant.city) || undefined,
    externalMerchantCountry:
      readString(merchantCountry.alpha2) || readString(merchantCountry.name) || undefined,
    externalMerchantMcc: readString(transaction.mcc) || undefined,
    paidAt: readString(transaction.clearedAt) || createdAt || undefined,
    txHash: txHashes[0],
    txHashes: txHashes.length > 0 ? txHashes : undefined,
  };
}
