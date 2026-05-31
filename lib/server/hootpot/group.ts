import { attoToCrcNumber, crcToAtto, hexToBytes } from "@/lib/hootpot/amounts";
import {
  GROUP_ADDRESS,
  GROUP_OPEN_SERVICE_ADDRESS,
  isConfiguredAddress,
  normalizeAmount,
  POT_ADDRESS,
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

export type HootpotGroupPayoutState = {
  potGroupTokenBalanceAtto: string;
  potMaxRedeemableAtto: string;
  redeemableCollateralTokenCount: number;
  treasuryCollateralTokenCount: number;
};

type TransactionLike = {
  to: string;
  data: `0x${string}`;
  value?: bigint;
};

type TokenBalanceLike = {
  tokenAddress?: string;
  isErc1155?: boolean;
};

type AggregatedTrustRelationLike = {
  relation?: string;
  objectAvatar?: string;
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

function uniqueAddresses(values: string[]): `0x${string}`[] {
  return Array.from(new Set(values.map((value) => value.toLowerCase()))).filter(
    (value): value is `0x${string}` => isConfiguredAddress(value),
  );
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

async function groupTokenId(): Promise<bigint> {
  const { hub } = await groupContracts();
  return hub.toTokenId(GROUP_ADDRESS as `0x${string}`);
}

export async function getHootpotGroupTokenBalance(
  holderAddress: string,
): Promise<bigint> {
  if (!isConfiguredAddress(holderAddress)) return BigInt(0);
  const { hub } = await groupContracts();
  const tokenId = await hub.toTokenId(GROUP_ADDRESS as `0x${string}`);
  return hub.balanceOf(holderAddress as `0x${string}`, tokenId);
}

async function getGroupRedeemContext(redeemerAddress: string): Promise<{
  sdk: InstanceType<typeof import("@aboutcircles/sdk").Sdk>;
  expectedToTokens: `0x${string}`[];
  treasuryCollateralTokenCount: number;
}> {
  const [{ Sdk }, { group }] = await Promise.all([
    import("@aboutcircles/sdk"),
    groupContracts(),
  ]);
  const sdk = new Sdk();
  const treasuryAddress = (await group.BASE_TREASURY()).toLowerCase();
  const [treasuryBalances, trustRelationships] = (await Promise.all([
    sdk.rpc.balance.getTokenBalances(treasuryAddress as `0x${string}`),
    sdk.rpc.trust.getAggregatedTrustRelations(
      redeemerAddress.toLowerCase() as `0x${string}`,
    ),
  ])) as [TokenBalanceLike[], AggregatedTrustRelationLike[]];

  const treasuryTokens = new Set(
    treasuryBalances
      .filter((balance) => balance.isErc1155 && balance.tokenAddress)
      .map((balance) => String(balance.tokenAddress).toLowerCase()),
  );
  const expectedToTokens = uniqueAddresses(
    trustRelationships
      .filter(
        (trustObject) =>
          (trustObject.relation === "mutuallyTrusts" ||
            trustObject.relation === "trusts") &&
          Boolean(trustObject.objectAvatar) &&
          treasuryTokens.has(String(trustObject.objectAvatar).toLowerCase()),
      )
      .map((trustObject) => String(trustObject.objectAvatar)),
  );

  return {
    sdk,
    expectedToTokens,
    treasuryCollateralTokenCount: treasuryTokens.size,
  };
}

export async function getHootpotGroupPayoutState(): Promise<HootpotGroupPayoutState> {
  if (!isConfiguredAddress(GROUP_ADDRESS) || !isConfiguredAddress(POT_ADDRESS)) {
    return {
      potGroupTokenBalanceAtto: "0",
      potMaxRedeemableAtto: "0",
      redeemableCollateralTokenCount: 0,
      treasuryCollateralTokenCount: 0,
    };
  }

  const potGroupTokenBalance = await getHootpotGroupTokenBalance(POT_ADDRESS);
  let potMaxRedeemableAtto = "0";
  let redeemableCollateralTokenCount = 0;
  let treasuryCollateralTokenCount = 0;

  try {
    const context = await getGroupRedeemContext(POT_ADDRESS);
    redeemableCollateralTokenCount = context.expectedToTokens.length;
    treasuryCollateralTokenCount = context.treasuryCollateralTokenCount;
    if (context.expectedToTokens.length > 0) {
      const maxRedeemable = await context.sdk.rpc.pathfinder.findMaxFlow({
        from: POT_ADDRESS.toLowerCase() as `0x${string}`,
        to: POT_ADDRESS.toLowerCase() as `0x${string}`,
        useWrappedBalances: false,
        fromTokens: [GROUP_ADDRESS.toLowerCase() as `0x${string}`],
        toTokens: context.expectedToTokens,
      });
      potMaxRedeemableAtto = BigInt(maxRedeemable).toString();
    }
  } catch (error) {
    console.warn("[hootpot] could not calculate HOOT redemption state", error);
  }

  return {
    potGroupTokenBalanceAtto: potGroupTokenBalance.toString(),
    potMaxRedeemableAtto,
    redeemableCollateralTokenCount,
    treasuryCollateralTokenCount,
  };
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

export async function buildGroupDonationTransactions(input: {
  participantAddress: string;
  amount: string;
}): Promise<MiniappTransaction[]> {
  if (!isConfiguredAddress(GROUP_ADDRESS)) {
    throw new Error("group_not_configured");
  }
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

  const amountAtto = crcToAtto(normalizedAmount);
  const [tokenId, currentBalance] = await Promise.all([
    groupTokenId(),
    getHootpotGroupTokenBalance(input.participantAddress),
  ]);
  if (currentBalance < amountAtto) {
    throw new Error("group_token_balance_too_low");
  }

  const { hub } = await groupContracts();
  const transferData = encodeHootpotTransferData(
    `hootpot:group-donation:${ROUND_ID}`,
  ) as `0x${string}`;
  return [
    mapTransaction(
      hub.safeTransferFrom(
        input.participantAddress as `0x${string}`,
        POT_ADDRESS as `0x${string}`,
        tokenId,
        amountAtto,
        transferData,
      ),
    ),
  ];
}

export async function buildGroupRedeemTransactions(input: {
  operatorAddress: string;
  amount: string;
}): Promise<MiniappTransaction[]> {
  if (!isConfiguredAddress(GROUP_ADDRESS)) {
    throw new Error("group_not_configured");
  }
  if (!isConfiguredAddress(POT_ADDRESS)) {
    throw new Error("pot_not_configured");
  }
  if (!isConfiguredAddress(input.operatorAddress)) {
    throw new Error("operator_required");
  }
  if (input.operatorAddress.toLowerCase() !== POT_ADDRESS.toLowerCase()) {
    throw new Error("pot_owner_required");
  }
  const normalizedAmount = normalizeAmount(input.amount);
  if (!normalizedAmount) {
    throw new Error("invalid_amount");
  }

  const amountAtto = crcToAtto(normalizedAmount);
  const [potGroupTokenBalance, context, { TransferBuilder }] = await Promise.all([
    getHootpotGroupTokenBalance(POT_ADDRESS),
    getGroupRedeemContext(POT_ADDRESS),
    import("@aboutcircles/sdk-transfers"),
  ]);
  if (potGroupTokenBalance < amountAtto) {
    throw new Error("group_token_balance_too_low");
  }
  if (context.expectedToTokens.length === 0) {
    throw new Error("no_redeemable_collateral_trust");
  }

  const maxRedeemable = await context.sdk.rpc.pathfinder.findMaxFlow({
    from: POT_ADDRESS.toLowerCase() as `0x${string}`,
    to: POT_ADDRESS.toLowerCase() as `0x${string}`,
    useWrappedBalances: false,
    fromTokens: [GROUP_ADDRESS.toLowerCase() as `0x${string}`],
    toTokens: context.expectedToTokens,
  });
  if (BigInt(maxRedeemable) < amountAtto) {
    throw new Error("no_group_redeem_path");
  }

  const transferBuilder = new TransferBuilder(context.sdk.circlesConfig);
  const transferData = encodeHootpotTransferData(
    `hootpot:group-redeem:${ROUND_ID}`,
  );
  const transactions = await transferBuilder.constructAdvancedTransfer(
    POT_ADDRESS.toLowerCase() as `0x${string}`,
    POT_ADDRESS.toLowerCase() as `0x${string}`,
    amountAtto,
    {
      txData: hexToBytes(transferData),
      useWrappedBalances: false,
      fromTokens: [GROUP_ADDRESS.toLowerCase() as `0x${string}`],
      toTokens: context.expectedToTokens,
    },
  );

  return transactions.map(mapTransaction);
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
