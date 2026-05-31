import { crcToAtto, hexToBytes, normalizeTxHash } from "@/lib/hootpot/amounts";
import {
  isConfiguredAddress,
  GROUP_ADDRESS,
  GROUP_MINT_HANDLER_ADDRESS,
  normalizeAmount,
  POT_ADDRESS,
  ROUND_ID,
} from "@/lib/hootpot/config";
import { encodeHootpotTransferData } from "@/lib/hootpot/transferData";
import {
  getHootpotGroupPayoutState,
  getHootpotGroupTokenBalance,
} from "@/lib/server/hootpot/group";
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
const HUB_V2_ADDRESS = "0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8";
const MAX_UINT96 = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFF");

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

export async function buildPotTrustTransactions(input: {
  operatorAddress: string;
  trustedAddress: string;
}): Promise<MiniappTransaction[]> {
  if (!isConfiguredAddress(POT_ADDRESS)) {
    throw new Error("pot_not_configured");
  }
  if (!isConfiguredAddress(input.operatorAddress)) {
    throw new Error("operator_required");
  }
  if (!isConfiguredAddress(input.trustedAddress)) {
    throw new Error("trusted_address_required");
  }
  if (input.operatorAddress.toLowerCase() !== POT_ADDRESS.toLowerCase()) {
    throw new Error("pot_owner_required");
  }
  if (input.trustedAddress.toLowerCase() === POT_ADDRESS.toLowerCase()) {
    throw new Error("trusted_address_is_pot");
  }

  const { HubV2ContractMinimal } = await import("@aboutcircles/sdk-core/minimal");
  const hub = new HubV2ContractMinimal({
    address: HUB_V2_ADDRESS,
    rpcUrl: gnosisRpcUrl(),
  });
  const transaction = hub.trust(input.trustedAddress as `0x${string}`, MAX_UINT96);

  return [
    {
      to: transaction.to,
      data: transaction.data,
      value: String(transaction.value ?? BigInt(0)),
    },
  ];
}

export async function buildGroupMemberTransactions(input: {
  operatorAddress: string;
  memberAddress: string;
}): Promise<MiniappTransaction[]> {
  if (!isConfiguredAddress(GROUP_ADDRESS)) {
    throw new Error("group_not_configured");
  }
  if (!isConfiguredAddress(input.operatorAddress)) {
    throw new Error("operator_required");
  }
  if (!isConfiguredAddress(input.memberAddress)) {
    throw new Error("member_required");
  }
  if (input.memberAddress.toLowerCase() === GROUP_ADDRESS.toLowerCase()) {
    throw new Error("member_is_group");
  }

  const { BaseGroupContract } = await import("@aboutcircles/sdk-core/baseGroup");
  const group = new BaseGroupContract({
    address: GROUP_ADDRESS as `0x${string}`,
    rpcUrl: gnosisRpcUrl(),
  });
  const owner = await group.owner();
  const service = await group.service();
  const normalizedOperator = input.operatorAddress.toLowerCase();
  if (
    normalizedOperator !== owner.toLowerCase() &&
    normalizedOperator !== service.toLowerCase()
  ) {
    throw new Error("group_owner_or_service_required");
  }

  const transaction = group.trust(input.memberAddress as `0x${string}`, MAX_UINT96);
  return [
    {
      to: transaction.to,
      data: transaction.data,
      value: String(transaction.value ?? BigInt(0)),
    },
  ];
}

export async function getHootSupportState(input: {
  participantAddress: string;
}): Promise<{
  groupAddress: string;
  mintHandler: string;
  participantTrustsGroup: boolean;
  groupTrustsParticipant: boolean;
  maxMintableAtto: string;
  groupTokenBalanceAtto: string;
  potGroupTokenBalanceAtto: string;
  potMaxRedeemableAtto: string;
  redeemableCollateralTokenCount: number;
  treasuryCollateralTokenCount: number;
}> {
  if (!isConfiguredAddress(GROUP_ADDRESS)) {
    throw new Error("group_not_configured");
  }
  if (!isConfiguredAddress(input.participantAddress)) {
    throw new Error("participant_required");
  }

  const mintHandler = await getGroupMintHandler();
  const { HubV2ContractMinimal } = await import("@aboutcircles/sdk-core/minimal");
  const [{ Sdk }] = await Promise.all([import("@aboutcircles/sdk")]);
  const hub = new HubV2ContractMinimal({
    address: HUB_V2_ADDRESS,
    rpcUrl: gnosisRpcUrl(),
  });
  const [
    participantTrustsGroup,
    groupTrustsParticipant,
    groupTokenBalance,
    payoutState,
  ] = await Promise.all([
    hub.isTrusted(
      input.participantAddress as `0x${string}`,
      GROUP_ADDRESS as `0x${string}`,
    ),
    hub.isTrusted(
      GROUP_ADDRESS as `0x${string}`,
      input.participantAddress as `0x${string}`,
    ),
    getHootpotGroupTokenBalance(input.participantAddress),
    getHootpotGroupPayoutState(),
  ]);

  let maxMintableAtto = "0";
  try {
    const sdk = new Sdk();
    const maxFlow = await sdk.rpc.pathfinder.findMaxFlow({
      from: input.participantAddress.toLowerCase() as `0x${string}`,
      to: mintHandler.toLowerCase() as `0x${string}`,
      useWrappedBalances: true,
    });
    maxMintableAtto = maxFlow.toString();
  } catch (error) {
    console.warn("[hootpot] could not calculate HOOT mintable amount", error);
  }

  return {
    groupAddress: GROUP_ADDRESS,
    mintHandler,
    participantTrustsGroup,
    groupTrustsParticipant,
    maxMintableAtto,
    groupTokenBalanceAtto: groupTokenBalance.toString(),
    potGroupTokenBalanceAtto: payoutState.potGroupTokenBalanceAtto,
    potMaxRedeemableAtto: payoutState.potMaxRedeemableAtto,
    redeemableCollateralTokenCount: payoutState.redeemableCollateralTokenCount,
    treasuryCollateralTokenCount: payoutState.treasuryCollateralTokenCount,
  };
}

async function getGroupMintHandler(): Promise<string> {
  if (isConfiguredAddress(GROUP_MINT_HANDLER_ADDRESS)) {
    return GROUP_MINT_HANDLER_ADDRESS;
  }
  const { BaseGroupContract } = await import("@aboutcircles/sdk-core/baseGroup");
  const group = new BaseGroupContract({
    address: GROUP_ADDRESS as `0x${string}`,
    rpcUrl: gnosisRpcUrl(),
  });
  return group.BASE_MINT_HANDLER();
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
