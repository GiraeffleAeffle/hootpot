import { attoToCrcNumber, crcToAtto, hexToBytes } from "@/lib/hootpot/amounts";
import {
  GROUP_ADDRESS,
  GROUP_OPEN_SERVICE_ADDRESS,
  isConfiguredAddress,
  normalizeAmount,
  ROUND_ID,
} from "@/lib/hootpot/config";
import { encodeHootpotTransferData } from "@/lib/hootpot/transferData";
import { getCrcBalanceCrc, normalizeCrcNumber } from "@/lib/server/hootpot/potBalance";
import type { MiniappTransaction } from "@/lib/server/hootpot/payments";

export type HootpotGroupState = {
  groupAddress: string;
  isGroupOnHub: boolean;
  owner: string;
  service: string;
  configuredOpenService: string;
  openJoinEnabled: boolean;
  feeCollection: string;
  mintHandler: string;
  treasury: string;
  membershipConditions: string[];
  treasuryBalanceCrc: number;
  totalSupplyCrc: number;
  error?: string;
};

type TransactionLike = {
  to: string;
  data: `0x${string}`;
  value?: bigint;
};

const DEFAULT_GNOSIS_RPC_URL = "https://rpc.gnosischain.com/";
const MAX_UINT96 = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFF");
const OPEN_GROUP_SERVICE_ABI = [
  {
    type: "function",
    name: "join",
    inputs: [{ name: "member", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

function gnosisRpcUrl(): string {
  return process.env.GNOSIS_RPC_URL?.trim() || DEFAULT_GNOSIS_RPC_URL;
}

function mapTransaction(transaction: TransactionLike): MiniappTransaction {
  return {
    to: transaction.to,
    data: transaction.data,
    value: String(transaction.value ?? BigInt(0)),
  };
}

async function groupContracts() {
  const { BaseGroupContract, HubV2Contract, circlesConfig } = await import(
    "@aboutcircles/sdk-core"
  );
  const rpcUrl = gnosisRpcUrl();
  const group = new BaseGroupContract({
    address: GROUP_ADDRESS as `0x${string}`,
    rpcUrl,
  });
  const hub = new HubV2Contract({
    address: circlesConfig[100].v2HubAddress,
    rpcUrl,
  });

  return { group, hub, rpcUrl };
}

export async function getHootpotGroupState(): Promise<HootpotGroupState | null> {
  if (!isConfiguredAddress(GROUP_ADDRESS)) return null;

  try {
    const { group, hub } = await groupContracts();
    const [
      isGroupOnHub,
      owner,
      service,
      feeCollection,
      mintHandler,
      treasury,
      membershipConditions,
    ] = await Promise.all([
      hub.isGroup(GROUP_ADDRESS as `0x${string}`),
      group.owner(),
      group.service(),
      group.feeCollection(),
      group.BASE_MINT_HANDLER(),
      group.BASE_TREASURY(),
      group.getMembershipConditions(),
    ]);
    const tokenId = await hub.toTokenId(GROUP_ADDRESS as `0x${string}`);
    const [treasuryBalanceCrc, totalSupply] = await Promise.all([
      getCrcBalanceCrc(treasury),
      hub.totalSupply(tokenId),
    ]);
    const configuredOpenService = GROUP_OPEN_SERVICE_ADDRESS;
    const openJoinEnabled =
      isConfiguredAddress(configuredOpenService) &&
      service.toLowerCase() === configuredOpenService.toLowerCase();

    return {
      groupAddress: GROUP_ADDRESS,
      isGroupOnHub,
      owner,
      service,
      configuredOpenService,
      openJoinEnabled,
      feeCollection,
      mintHandler,
      treasury,
      membershipConditions: [...membershipConditions],
      treasuryBalanceCrc,
      totalSupplyCrc: normalizeCrcNumber(attoToCrcNumber(totalSupply)),
    };
  } catch (error) {
    console.warn("[hootpot] could not load group state", error);
    return {
      groupAddress: GROUP_ADDRESS,
      isGroupOnHub: false,
      owner: "",
      service: "",
      configuredOpenService: GROUP_OPEN_SERVICE_ADDRESS,
      openJoinEnabled: false,
      feeCollection: "",
      mintHandler: "",
      treasury: "",
      membershipConditions: [],
      treasuryBalanceCrc: 0,
      totalSupplyCrc: 0,
      error: error instanceof Error ? error.message : "group_state_failed",
    };
  }
}

export async function buildGroupJoinTransactions(input: {
  participantAddress: string;
}): Promise<MiniappTransaction[]> {
  if (!isConfiguredAddress(GROUP_ADDRESS)) {
    throw new Error("group_not_configured");
  }
  if (!isConfiguredAddress(input.participantAddress)) {
    throw new Error("participant_required");
  }

  const { group, hub, rpcUrl } = await groupContracts();
  const [service, groupTrustsParticipant] = await Promise.all([
    group.service(),
    hub.isTrusted(
      GROUP_ADDRESS as `0x${string}`,
      input.participantAddress as `0x${string}`,
    ),
  ]);
  const memberAcceptsGroup = hub.trust(GROUP_ADDRESS as `0x${string}`, MAX_UINT96);

  if (groupTrustsParticipant) {
    return [mapTransaction(memberAcceptsGroup)];
  }

  if (
    !isConfiguredAddress(GROUP_OPEN_SERVICE_ADDRESS) ||
    service.toLowerCase() !== GROUP_OPEN_SERVICE_ADDRESS.toLowerCase()
  ) {
    throw new Error("open_join_not_enabled");
  }

  const { Contract } = await import("@aboutcircles/sdk-core");
  const serviceContract = new Contract({
    address: GROUP_OPEN_SERVICE_ADDRESS as `0x${string}`,
    abi: OPEN_GROUP_SERVICE_ABI,
    rpcUrl,
  });
  const openJoin = {
    to: serviceContract.address,
    data: serviceContract.encodeWrite("join", [
      input.participantAddress as `0x${string}`,
    ]),
    value: BigInt(0),
  };

  return [memberAcceptsGroup, openJoin].map(mapTransaction);
}

export async function buildGroupFundTransactions(input: {
  participantAddress: string;
  amount: string;
}): Promise<MiniappTransaction[]> {
  if (!isConfiguredAddress(GROUP_ADDRESS)) {
    throw new Error("group_not_configured");
  }
  if (!isConfiguredAddress(input.participantAddress)) {
    throw new Error("participant_required");
  }
  const normalizedAmount = normalizeAmount(input.amount);
  if (!normalizedAmount) {
    throw new Error("invalid_amount");
  }

  const [{ Sdk }, { TransferBuilder }, { group, hub }] = await Promise.all([
    import("@aboutcircles/sdk"),
    import("@aboutcircles/sdk-transfers"),
    groupContracts(),
  ]);
  const mintHandler = await group.BASE_MINT_HANDLER();
  const sdk = new Sdk();
  const transferBuilder = new TransferBuilder(sdk.circlesConfig);
  const transferData = encodeHootpotTransferData(
    `hootpot:group-funding:${ROUND_ID}`,
  );
  const transactions = await transferBuilder.constructAdvancedTransfer(
    input.participantAddress as `0x${string}`,
    mintHandler,
    crcToAtto(normalizedAmount),
    {
      txData: hexToBytes(transferData),
      useWrappedBalances: true,
    },
  );
  const memberAcceptsGroup = hub.trust(GROUP_ADDRESS as `0x${string}`, MAX_UINT96);

  return [memberAcceptsGroup, ...transactions].map(mapTransaction);
}

export async function buildGroupOpenServiceSetupTransactions(input: {
  operatorAddress: string;
}): Promise<MiniappTransaction[]> {
  if (!isConfiguredAddress(GROUP_ADDRESS)) {
    throw new Error("group_not_configured");
  }
  if (!isConfiguredAddress(GROUP_OPEN_SERVICE_ADDRESS)) {
    throw new Error("open_service_not_configured");
  }
  if (!isConfiguredAddress(input.operatorAddress)) {
    throw new Error("operator_required");
  }

  const { group } = await groupContracts();
  const owner = await group.owner();
  if (input.operatorAddress.toLowerCase() !== owner.toLowerCase()) {
    throw new Error("group_owner_required");
  }

  const currentService = await group.service();
  if (currentService.toLowerCase() === GROUP_OPEN_SERVICE_ADDRESS.toLowerCase()) {
    return [];
  }

  return [
    mapTransaction(
      group.setService(GROUP_OPEN_SERVICE_ADDRESS as `0x${string}`),
    ),
  ];
}
