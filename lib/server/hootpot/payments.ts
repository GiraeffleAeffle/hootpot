import { crcToAtto, hexToBytes, normalizeTxHash } from "@/lib/hootpot/amounts";
import {
  isConfiguredAddress,
  normalizeAmount,
  POT_ADDRESS,
  ROUND_ID,
} from "@/lib/hootpot/config";
import { encodeHootpotTransferData } from "@/lib/hootpot/transferData";
import type { HootpotTicket } from "@/lib/server/hootpot/store";

export type MiniappTransaction = {
  to: string;
  data: `0x${string}`;
  value?: string;
};

export type PaymentVerification =
  | { status: "verified"; txHash: `0x${string}` }
  | { status: "pending"; reason: string }
  | { status: "failed"; reason: string };

type RpcResponse<TResult> = {
  result?: TResult;
  error?: { message?: string };
};

type TransactionReceipt = {
  status?: string;
};

const DEFAULT_GNOSIS_RPC_URL = "https://rpc.gnosischain.com/";

function gnosisRpcUrl(): string {
  return process.env.GNOSIS_RPC_URL?.trim() || DEFAULT_GNOSIS_RPC_URL;
}

function strip0x(value: string): string {
  return value.startsWith("0x") ? value.slice(2) : value;
}

async function rpcCall<TResult>(
  method: string,
  params: unknown[],
): Promise<TResult | null> {
  const response = await fetch(gnosisRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`rpc_http_${response.status}`);
  }
  const payload = (await response.json()) as RpcResponse<TResult | null>;
  if (payload.error) {
    throw new Error(payload.error.message ?? "rpc_error");
  }
  return payload.result ?? null;
}

export async function buildHootpotPaymentTransactions(input: {
  ticket: HootpotTicket;
  participantAddress: string;
}): Promise<MiniappTransaction[]> {
  const { ticket, participantAddress } = input;
  if (!isConfiguredAddress(ticket.merchantAddress)) {
    throw new Error("merchant_not_configured");
  }
  if (!isConfiguredAddress(participantAddress)) {
    throw new Error("participant_required");
  }
  if (
    ticket.participantAddress &&
    ticket.participantAddress.toLowerCase() !== participantAddress.toLowerCase()
  ) {
    throw new Error("participant_mismatch");
  }

  const [{ Sdk }, { TransferBuilder }] = await Promise.all([
    import("@aboutcircles/sdk"),
    import("@aboutcircles/sdk-transfers"),
  ]);
  const sdk = new Sdk();
  const transferBuilder = new TransferBuilder(sdk.circlesConfig);
  const transactions = await transferBuilder.constructAdvancedTransfer(
    participantAddress as `0x${string}`,
    ticket.merchantAddress as `0x${string}`,
    crcToAtto(ticket.amount),
    {
      txData: hexToBytes(ticket.transferData),
      useWrappedBalances: true,
    },
  );

  return transactions.map((transaction) => ({
    to: transaction.to,
    data: transaction.data,
    value: String(transaction.value ?? BigInt(0)),
  }));
}

export async function buildHootpotTopUpTransactions(input: {
  participantAddress: string;
  amount: string;
}): Promise<MiniappTransaction[]> {
  if (!isConfiguredAddress(POT_ADDRESS)) {
    throw new Error("pot_not_configured");
  }
  if (!isConfiguredAddress(input.participantAddress)) {
    throw new Error("participant_required");
  }
  const normalizedAmount = normalizeAmount(input.amount);
  if (!normalizedAmount) {
    throw new Error("invalid_amount");
  }

  const [{ Sdk }, { TransferBuilder }] = await Promise.all([
    import("@aboutcircles/sdk"),
    import("@aboutcircles/sdk-transfers"),
  ]);
  const sdk = new Sdk();
  const transferBuilder = new TransferBuilder(sdk.circlesConfig);
  const transferData = encodeHootpotTransferData(`hootpot:topup:${ROUND_ID}`);
  const transactions = await transferBuilder.constructAdvancedTransfer(
    input.participantAddress as `0x${string}`,
    POT_ADDRESS as `0x${string}`,
    crcToAtto(normalizedAmount),
    {
      txData: hexToBytes(transferData),
      useWrappedBalances: true,
    },
  );

  return transactions.map((transaction) => ({
    to: transaction.to,
    data: transaction.data,
    value: String(transaction.value ?? BigInt(0)),
  }));
}

export async function verifyHootpotPaymentTx(
  ticket: HootpotTicket,
  txHash: string,
): Promise<PaymentVerification> {
  const normalizedHash = normalizeTxHash(txHash);
  if (!normalizedHash) {
    return { status: "failed", reason: "invalid_tx_hash" };
  }

  const receipt = await rpcCall<TransactionReceipt>(
    "eth_getTransactionReceipt",
    [normalizedHash],
  );
  if (!receipt) {
    return { status: "pending", reason: "tx_not_indexed_yet" };
  }
  if (receipt.status && receipt.status !== "0x1") {
    return { status: "failed", reason: "tx_reverted" };
  }

  const transaction = await rpcCall<unknown>("eth_getTransactionByHash", [
    normalizedHash,
  ]);
  const haystack = JSON.stringify({ receipt, transaction }).toLowerCase();
  const transferDataNeedle = strip0x(ticket.transferData).toLowerCase();
  const merchantNeedle = strip0x(ticket.merchantAddress).toLowerCase();

  if (!haystack.includes(transferDataNeedle)) {
    return { status: "pending", reason: "receipt_reference_not_found_yet" };
  }
  if (isConfiguredAddress(ticket.merchantAddress) && !haystack.includes(merchantNeedle)) {
    return { status: "failed", reason: "merchant_not_found_in_tx" };
  }

  return { status: "verified", txHash: normalizedHash };
}

export async function verifyHootpotPayment(input: {
  ticket: HootpotTicket;
  txHashes: string[];
}): Promise<PaymentVerification> {
  if (input.txHashes.length === 0) {
    return { status: "failed", reason: "tx_hash_required" };
  }

  let latestPending: PaymentVerification | null = null;
  for (const txHash of input.txHashes) {
    const verification = await verifyHootpotPaymentTx(input.ticket, txHash);
    if (verification.status === "verified") return verification;
    if (verification.status === "pending") latestPending = verification;
  }

  return latestPending ?? { status: "failed", reason: "payment_tx_not_valid" };
}
