"use client";

import {
  ArrowRight,
  Check,
  Coins,
  Copy,
  CreditCard,
  ExternalLink,
  Gift,
  ReceiptText,
  RotateCw,
  ShieldCheck,
  Star,
  Store,
  Ticket,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWallet } from "@/hooks/use-wallet";
import {
  cashbackForAmount,
  DEFAULT_CHECKOUT_AMOUNT,
  formatAddress,
  GROUP_ADDRESS,
  GROUP_METRICS_URL,
  GROUP_MINT_HANDLER_ADDRESS,
  GROUP_TREASURY_ADDRESS,
  GROUP_URL,
  isConfiguredAddress,
  MAX_CASHBACK_CRC,
  MERCHANT_REGISTRY_ADDRESS,
  MERCHANTS,
  normalizeAmount,
  POOL_ADDRESS,
  POT_ADDRESS,
  REGISTRY_ADDRESS,
  ROUND_ID,
} from "@/lib/hootpot/config";
import {
  buildGnosisCrcTransferUrl,
  encodeHootpotTransferData,
} from "@/lib/hootpot/transferData";
import { cn } from "@/lib/utils";

type TicketStatus =
  | "pending_payment"
  | "payment_submitted"
  | "eligible"
  | "reimbursed";

type HootpotTicket = {
  ticketId: string;
  intentId: string;
  roundId: string;
  merchantId: string;
  merchantName: string;
  merchantAddress: string;
  participantAddress: string | null;
  amount: string;
  cashbackAmount: string;
  status: TicketStatus;
  transferDataPayload: string;
  transferData: string;
  paymentUrl: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  txHash?: string;
  txHashes?: string[];
  verificationError?: string;
  source?: "circles_checkout" | "gnosis_pay";
  externalStatus?: string;
  externalMerchantCity?: string;
  externalMerchantCountry?: string;
  externalMerchantMcc?: string;
  paymentAmount?: string;
  paymentCurrency?: string;
  sourceAmountLabel?: string;
};

type HootpotDraw = {
  roundId: string;
  seed: string;
  winnerTicketId: string;
  winnerAddress: string;
  payoutAmount: string;
  drawnAt: string;
  payoutTxHash?: string;
  payoutRecordedAt?: string;
};

type HootpotGroupState = {
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

type HootpotState = {
  roundId: string;
  tickets: HootpotTicket[];
  eligibleTickets: HootpotTicket[];
  pendingTickets: HootpotTicket[];
  potTotalCrc: number;
  group: HootpotGroupState | null;
  availableCashbackCrc: number;
  winnerTicket: HootpotTicket | null;
  draw: HootpotDraw | null;
};

type CirclesAccountState =
  | { status: "idle"; address: null }
  | { status: "loading"; address: string }
  | {
      status: "found";
      address: string;
      name?: string;
      balance: string | null;
      avatarType?: string;
      trustsCount: number;
      trustedByCount: number;
    }
  | { status: "not_registered"; address: string }
  | { status: "error"; address: string; error: string };

type ProfileView = {
  avatarInfo?: {
    type?: string;
    isHuman?: boolean;
    name?: string;
  };
  profile?: {
    name?: string;
  };
  trustStats?: {
    trustsCount?: number;
    trustedByCount?: number;
  };
  v1Balance?: string;
  v2Balance?: string;
};

const EMPTY_TICKETS: HootpotTicket[] = [];

type HootSupportState = {
  groupAddress: string;
  mintHandler: string;
  participantTrustsGroup: boolean;
  groupTrustsParticipant: boolean;
  maxMintableAtto: string;
};

function isValidAmount(value: string): boolean {
  return normalizeAmount(value) !== null;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: TicketStatus): string {
  if (status === "eligible") return "eligible";
  if (status === "reimbursed") return "paid back";
  if (status === "payment_submitted") return "verifying";
  return "waiting";
}

function winnerCopy(
  ticket: HootpotTicket | null,
  availableCashbackCrc: number,
): string {
  if (!ticket) return "No eligible receipts yet.";
  if (availableCashbackCrc <= 0) {
    return `${ticket.merchantName} receipt is eligible once the pot is funded.`;
  }
  return `${ticket.merchantName} receipt can get ${formatCrcAmount(availableCashbackCrc)} CRC back.`;
}

function ticketSourceLabel(ticket: HootpotTicket): string {
  return ticket.source === "gnosis_pay" ? "Gnosis Pay" : "Circles";
}

function ticketAmountLabel(ticket: HootpotTicket): string {
  if (ticket.source === "gnosis_pay") {
    return `${ticket.sourceAmountLabel ?? `${ticket.amount} ${ticket.paymentCurrency ?? ""}`.trim()} card receipt`;
  }
  return `${ticket.amount} CRC`;
}

function formatCrcAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "0";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
  }).format(parsed);
}

function formatCrcBalance(value: string | number | null | undefined): string {
  return `${formatCrcAmount(value)} CRC`;
}

function formatAttoCrc(value: string | null | undefined): string {
  if (!value) return "0";
  try {
    const atto = BigInt(value);
    const attoPerCrc = BigInt("1000000000000000000");
    const twoDecimalScale = BigInt("10000000000000000");
    const whole = atto / attoPerCrc;
    const fractional = atto % attoPerCrc;
    const decimals = (fractional / twoDecimalScale)
      .toString()
      .padStart(2, "0")
      .replace(/0+$/, "");
    return decimals ? `${whole}.${decimals}` : whole.toString();
  } catch {
    return "0";
  }
}

function isPositiveAtto(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    return BigInt(value) > BigInt(0);
  } catch {
    return false;
  }
}

function crcStringToAtto(value: string | null): bigint | null {
  if (!value) return null;
  const [whole, fractional = ""] = value.split(".");
  try {
    const attoPerCrc = BigInt("1000000000000000000");
    return (
      BigInt(whole) * attoPerCrc +
      BigInt(fractional.padEnd(18, "0").slice(0, 18) || "0")
    );
  } catch {
    return null;
  }
}

function avatarTypeLabel(type?: string): string {
  if (!type) return "Registered";
  if (type.includes("Human") || type === "CrcV1_Signup") return "Human";
  if (type.includes("Group")) return "Group";
  if (type.includes("Organization")) return "Org";
  return "Registered";
}

function accountDisplayName(
  account: CirclesAccountState,
  address: string | null,
): string {
  if (account.status === "found") return account.name ?? formatAddress(address);
  if (account.status === "loading") return "Loading";
  if (account.status === "not_registered") return "Not registered";
  if (account.status === "error") return "Profile error";
  return address ? formatAddress(address) : "Waiting";
}

function accountBalanceLabel(
  account: CirclesAccountState,
  isConnected: boolean,
): string {
  if (account.status === "found") return formatCrcBalance(account.balance);
  if (account.status === "loading") return "Checking";
  if (account.status === "not_registered") return "0 CRC";
  if (account.status === "error") return "Unknown";
  return isConnected ? "Checking" : "Preview";
}

function accountStatusLabel(account: CirclesAccountState): string {
  if (account.status === "found") return avatarTypeLabel(account.avatarType);
  if (account.status === "loading") return "Checking";
  if (account.status === "not_registered") return "No avatar";
  if (account.status === "error") return "RPC error";
  return "Preview";
}

export function HootpotApp() {
  const { address, isConnected, isMiniappHost } = useWallet();
  const [account, setAccount] = useState<CirclesAccountState>({
    status: "idle",
    address: null,
  });
  const [state, setState] = useState<HootpotState | null>(null);
  const [operatorMode] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("operator") === "1",
  );
  const [selectedMerchantId, setSelectedMerchantId] = useState(MERCHANTS[0].id);
  const [amount, setAmount] = useState(DEFAULT_CHECKOUT_AMOUNT);
  const [topUpAmount, setTopUpAmount] = useState("25");
  const [operatorSecret, setOperatorSecret] = useState("");
  const [payoutTxHash, setPayoutTxHash] = useState("");
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSyncingGnosisPay, setIsSyncingGnosisPay] = useState(false);
  const [isFundingPot, setIsFundingPot] = useState(false);
  const [supportAmount, setSupportAmount] = useState("5");
  const [supportState, setSupportState] = useState<HootSupportState | null>(null);
  const [supportRefreshNonce, setSupportRefreshNonce] = useState(0);
  const [isLoadingSupport, setIsLoadingSupport] = useState(false);
  const [isTrustingHoot, setIsTrustingHoot] = useState(false);
  const [isSupportingHoot, setIsSupportingHoot] = useState(false);
  const [trustedSenderAddress, setTrustedSenderAddress] = useState("");
  const [groupMemberAddress, setGroupMemberAddress] = useState("");
  const [isAddingGroupMember, setIsAddingGroupMember] = useState(false);
  const [isTrustingSender, setIsTrustingSender] = useState(false);
  const [isEnablingOpenJoin, setIsEnablingOpenJoin] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isRecordingPayout, setIsRecordingPayout] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function refreshState(options: { preserveSelection?: boolean } = {}) {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/hootpot/state", { cache: "no-store" });
      const payload = (await response.json()) as {
        ok?: boolean;
        state?: HootpotState;
        error?: string;
      };
      if (!response.ok || !payload.state) {
        throw new Error(payload.error ?? "Could not load Hootpot state.");
      }
      setState(payload.state);
      if (!options.preserveSelection && !activeTicketId) {
        setActiveTicketId(payload.state.tickets[0]?.ticketId ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Hootpot state.");
    } finally {
      setIsRefreshing(false);
    }
  }

  const groupConfigured = isConfiguredAddress(GROUP_ADDRESS);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshState();
    }, 0);
    return () => window.clearTimeout(timer);
    // The initial load should run once; user-triggered refreshes use the same function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!address) {
        setAccount({ status: "idle", address: null });
        return;
      }

      setAccount({ status: "loading", address });
      void (async () => {
        try {
          const { Sdk } = await import("@aboutcircles/sdk");
          const sdk = new Sdk();
          const view = (await sdk.rpc.profile.getProfileView(
            address as `0x${string}`,
          )) as ProfileView;

          if (cancelled) return;
          if (!view.avatarInfo) {
            setAccount({ status: "not_registered", address });
            return;
          }

          setAccount({
            status: "found",
            address,
            name: view.profile?.name ?? view.avatarInfo.name,
            balance: view.v2Balance ?? view.v1Balance ?? null,
            avatarType: view.avatarInfo.type,
            trustsCount: view.trustStats?.trustsCount ?? 0,
            trustedByCount: view.trustStats?.trustedByCount ?? 0,
          });
        } catch (err) {
          if (cancelled) return;
          setAccount({
            status: "error",
            address,
            error:
              err instanceof Error
                ? err.message
                : "Could not load Circles profile.",
          });
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [address]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!address || !groupConfigured) {
        setSupportState(null);
        return;
      }

      setIsLoadingSupport(true);
      void (async () => {
        try {
          const response = await fetch(
            `/api/hootpot/group/support/state?participantAddress=${encodeURIComponent(address)}`,
            { cache: "no-store" },
          );
          const payload = (await response.json()) as {
            ok?: boolean;
            support?: HootSupportState;
            error?: string;
          };
          if (!response.ok || !payload.support) {
            throw new Error(payload.error ?? "Could not load HOOT support state.");
          }
          if (!cancelled) setSupportState(payload.support);
        } catch (err) {
          if (!cancelled) {
            console.warn("[hootpot] could not load HOOT support state", err);
            setSupportState(null);
          }
        } finally {
          if (!cancelled) setIsLoadingSupport(false);
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [address, groupConfigured, supportRefreshNonce]);

  const tickets = state?.tickets ?? EMPTY_TICKETS;
  const eligibleTickets = state?.eligibleTickets ?? EMPTY_TICKETS;
  const pendingTickets = state?.pendingTickets ?? EMPTY_TICKETS;
  const potTotal = state?.potTotalCrc ?? 0;
  const group = state?.group ?? null;
  const winnerTicket = state?.winnerTicket ?? null;
  const availableCashback = state?.availableCashbackCrc ?? 0;
  const draw = state?.draw ?? null;

  const selectedMerchant = useMemo(
    () =>
      MERCHANTS.find((merchant) => merchant.id === selectedMerchantId) ??
      MERCHANTS[0],
    [selectedMerchantId],
  );

  const activeTicket = useMemo(
    () => tickets.find((ticket) => ticket.ticketId === activeTicketId) ?? null,
    [activeTicketId, tickets],
  );

  const potConfigured = isConfiguredAddress(POT_ADDRESS);
  const registryConfigured = isConfiguredAddress(REGISTRY_ADDRESS);
  const poolConfigured = isConfiguredAddress(POOL_ADDRESS);
  const merchantRegistryConfigured = isConfiguredAddress(MERCHANT_REGISTRY_ADDRESS);
  const groupMintHandlerAddress = isConfiguredAddress(group?.mintHandler ?? "")
    ? (group?.mintHandler ?? null)
    : isConfiguredAddress(GROUP_MINT_HANDLER_ADDRESS)
      ? GROUP_MINT_HANDLER_ADDRESS
      : null;
  const groupTreasuryAddress = isConfiguredAddress(group?.treasury ?? "")
    ? (group?.treasury ?? null)
    : isConfiguredAddress(GROUP_TREASURY_ADDRESS)
      ? GROUP_TREASURY_ADDRESS
      : null;
  const openJoinServiceConfigured = isConfiguredAddress(
    group?.configuredOpenService ?? "",
  );
  const openJoinEnabled = Boolean(group?.openJoinEnabled);
  const isGroupOwnerOrServiceConnected =
    Boolean(address && group) &&
    (address?.toLowerCase() === group?.owner.toLowerCase() ||
      address?.toLowerCase() === group?.service.toLowerCase());
  const hasHootMintPath = Boolean(
    supportState?.participantTrustsGroup &&
      supportState?.groupTrustsParticipant &&
      isPositiveAtto(supportState.maxMintableAtto),
  );
  const normalizedSupportAmount = normalizeAmount(supportAmount);
  const requestedSupportAtto = crcStringToAtto(normalizedSupportAmount);
  const canMintRequestedSupport =
    hasHootMintPath &&
    requestedSupportAtto !== null &&
    BigInt(supportState?.maxMintableAtto ?? "0") >= requestedSupportAtto;
  const normalizedTrustedSenderAddress = trustedSenderAddress.trim();
  const normalizedGroupMemberAddress = groupMemberAddress.trim();
  const isPotOwnerConnected =
    potConfigured &&
    Boolean(address) &&
    address?.toLowerCase() === POT_ADDRESS.toLowerCase();
  const canTrustSender =
    operatorMode &&
    isMiniappHost &&
    isConnected &&
    isPotOwnerConnected &&
    isConfiguredAddress(normalizedTrustedSenderAddress) &&
    normalizedTrustedSenderAddress.toLowerCase() !== POT_ADDRESS.toLowerCase();
  const canAddGroupMember =
    operatorMode &&
    isMiniappHost &&
    isConnected &&
    isGroupOwnerOrServiceConnected &&
    isConfiguredAddress(normalizedGroupMemberAddress) &&
    normalizedGroupMemberAddress.toLowerCase() !== GROUP_ADDRESS.toLowerCase();
  const canSupportHoot =
    isConnected &&
    isMiniappHost &&
    groupConfigured &&
    Boolean(normalizedSupportAmount) &&
    canMintRequestedSupport &&
    !isSupportingHoot;
  const canEnableOpenJoin =
    operatorMode &&
    isMiniappHost &&
    isConnected &&
    Boolean(group) &&
    openJoinServiceConfigured &&
    !openJoinEnabled &&
    address?.toLowerCase() === group?.owner.toLowerCase() &&
    !isEnablingOpenJoin;
  const topUpTransferData = encodeHootpotTransferData(`hootpot:topup:${ROUND_ID}`);
  const normalizedTopUpAmount = normalizeAmount(topUpAmount);
  const topUpUrl =
    potConfigured && normalizedTopUpAmount
      ? buildGnosisCrcTransferUrl(POT_ADDRESS, normalizedTopUpAmount, topUpTransferData)
      : "#";

  async function createTicket() {
    const normalized = normalizeAmount(amount);
    if (!normalized || isCreating) return;
    setIsCreating(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/hootpot/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantId: selectedMerchantId,
          amount: normalized,
          participantAddress: address,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        ticket?: HootpotTicket;
        error?: string;
      };
      if (!response.ok || !payload.ticket) {
        throw new Error(
          payload.error === "demo_amount_too_high"
            ? "Demo checkout is capped at 1 CRC."
            : payload.error ?? "Could not create receipt.",
        );
      }
      setActiveTicketId(payload.ticket.ticketId);
      setMessage("Receipt created. Pay the merchant, then check the receipt.");
      await refreshState({ preserveSelection: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create receipt.");
    } finally {
      setIsCreating(false);
    }
  }

  function jsonHeaders(extra: Record<string, string> = {}): HeadersInit {
    const trimmedOperatorSecret = operatorSecret.trim();
    return {
      "Content-Type": "application/json",
      ...(trimmedOperatorSecret
        ? { "X-Hootpot-Admin-Secret": trimmedOperatorSecret }
        : {}),
      ...extra,
    };
  }

  async function syncGnosisPayReceipts() {
    if (!address || !isConnected) {
      setError("Connect the Gnosis/Circles account that owns the card receipts.");
      return;
    }
    if (!isMiniappHost) {
      setError("Gnosis Pay sync needs the Circles host wallet signature flow.");
      return;
    }
    if (isSyncingGnosisPay) return;

    setIsSyncingGnosisPay(true);
    setError(null);
    setMessage(null);
    try {
      const sessionResponse = await fetch("/api/hootpot/gnosis-pay/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantAddress: address,
        }),
      });
      const sessionPayload = (await sessionResponse.json()) as {
        ok?: boolean;
        message?: string;
        signatureType?: "erc1271" | "raw";
        error?: string;
        detail?: string;
      };
      if (!sessionResponse.ok || !sessionPayload.message) {
        throw new Error(
          sessionPayload.detail ??
            sessionPayload.error ??
            "Could not start Gnosis Pay sign-in.",
        );
      }

      const { signMessage } = await import("@aboutcircles/miniapp-sdk");
      const signed = await signMessage(
        sessionPayload.message,
        sessionPayload.signatureType ?? "erc1271",
      );

      const response = await fetch("/api/hootpot/gnosis-pay/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantAddress: address,
          message: sessionPayload.message,
          signature: signed.signature,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        importedCount?: number;
        updatedCount?: number;
        skippedCount?: number;
        state?: HootpotState;
        error?: string;
        detail?: string;
      };
      if (!response.ok || !payload.state) {
        const message =
          payload.error === "gnosis_pay_domain_not_allowed"
            ? "Gnosis Pay has not allowed this domain for SIWE yet. Register hootpot.vercel.app in the Gnosis Pay partner dashboard, then try again."
            : payload.error === "participant_not_linked_to_gnosis_pay_account"
            ? "Connected wallet does not match the Gnosis Pay Safe, owner, or authenticated wallet."
            : payload.detail ?? payload.error ?? "Could not sync Gnosis Pay receipts.";
        throw new Error(message);
      }

      setState(payload.state);
      const imported = payload.importedCount ?? 0;
      const updated = payload.updatedCount ?? 0;
      setMessage(
        imported + updated > 0
          ? `Synced ${imported} new and refreshed ${updated} Gnosis Pay receipts.`
          : "No new eligible Gnosis Pay card receipts found.",
      );
      setActiveTicketId(payload.state.tickets[0]?.ticketId ?? null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not sync Gnosis Pay receipts.",
      );
    } finally {
      setIsSyncingGnosisPay(false);
    }
  }

  async function submitPayment(ticket: HootpotTicket) {
    if (!address || !isConnected) {
      setError("Open Hootpot inside the Circles host with a connected wallet.");
      return;
    }
    if (!isMiniappHost) {
      setError("Real checkout runs inside the Circles playground host.");
      return;
    }
    if (!isConfiguredAddress(ticket.merchantAddress)) {
      setError("Configure a real merchant address before taking payments.");
      return;
    }

    setIsPaying(true);
    setError(null);
    setMessage(null);
    try {
      const txResponse = await fetch(
        `/api/hootpot/tickets/${ticket.ticketId}/transactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantAddress: address }),
        },
      );
      const txPayload = (await txResponse.json()) as {
        ok?: boolean;
        transactions?: { to: string; data?: string; value?: string }[];
        error?: string;
      };
      if (!txResponse.ok || !txPayload.transactions?.length) {
        throw new Error(txPayload.error ?? "Could not build Circles payment.");
      }

      const { sendTransactions } = await import("@aboutcircles/miniapp-sdk");
      const txHashes = await sendTransactions(txPayload.transactions);
      await submitTicketTxHashes(ticket.ticketId, txHashes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send payment.");
    } finally {
      setIsPaying(false);
    }
  }

  async function submitTicketTxHashes(ticketId: string, txHashes: string[]) {
    setIsVerifying(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/hootpot/tickets/${ticketId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHashes }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        state?: HootpotState;
        verification?: { status: string; reason?: string };
        error?: string;
      };
      if (!response.ok || !payload.state) {
        throw new Error(payload.error ?? "Could not verify payment.");
      }
      setState(payload.state);
      if (payload.verification?.status === "verified") {
        setMessage("Payment verified on Gnosis Chain. Receipt is eligible.");
      } else {
        setMessage(
          "Payment submitted. The tx is not indexed with the receipt reference yet.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify payment.");
    } finally {
      setIsVerifying(false);
    }
  }

  async function retryPaymentVerification(ticket: HootpotTicket) {
    const txHashes = ticket.txHashes ?? (ticket.txHash ? [ticket.txHash] : []);
    await submitTicketTxHashes(ticket.ticketId, txHashes);
  }

  async function drawRound() {
    setIsDrawing(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/hootpot/draw", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        state?: HootpotState;
        error?: string;
      };
      if (!response.ok || !payload.state) {
        throw new Error(
          payload.error === "pot_empty"
            ? "Fund the Hootpot Safe before drawing cashback."
            : payload.error ?? "Could not draw a winner.",
        );
      }
      setState(payload.state);
      setMessage("Winner drawn. Pay the cashback from the Hootpot Safe, then record the tx.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draw a winner.");
    } finally {
      setIsDrawing(false);
    }
  }

  async function fundPot() {
    const normalized = normalizeAmount(topUpAmount);
    if (!potConfigured || !normalized || isFundingPot) return;

    if (!address || !isConnected || !isMiniappHost) {
      window.location.assign(topUpUrl);
      return;
    }

    setIsFundingPot(true);
    setError(null);
    setMessage(null);
    try {
      const txResponse = await fetch("/api/hootpot/topup/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantAddress: address,
          amount: normalized,
        }),
      });
      const txPayload = (await txResponse.json()) as {
        ok?: boolean;
        transactions?: { to: string; data?: string; value?: string }[];
        error?: string;
      };
      if (!txResponse.ok || !txPayload.transactions?.length) {
        const message =
          txPayload.error === "no_transfer_path"
            ? "No Circles transfer path to the pot yet. For admin top-ups, the Hootpot Safe must trust the funder first."
            : txPayload.error === "pot_not_configured"
              ? "The Hootpot pot address is not configured."
              : txPayload.error === "invalid_amount"
                ? "Enter a valid CRC amount."
                : txPayload.error ?? "Could not build the pot funding transaction.";
        throw new Error(message);
      }

      const { sendTransactions } = await import("@aboutcircles/miniapp-sdk");
      await sendTransactions(txPayload.transactions);
      setMessage(
        `Sent ${normalized} CRC toward the Hootpot pot. The displayed balance updates after Circles indexing.`,
      );
      await refreshState({ preserveSelection: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fund the pot.");
    } finally {
      setIsFundingPot(false);
    }
  }

  async function joinHootGroup() {
    if (!address || !isConnected || !isMiniappHost) {
      setError("Open Hootpot inside the Circles host with a connected wallet.");
      return;
    }
    if (isTrustingHoot) return;

    setIsTrustingHoot(true);
    setError(null);
    setMessage(null);
    try {
      const txResponse = await fetch("/api/hootpot/group/join/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantAddress: address }),
      });
      const txPayload = (await txResponse.json()) as {
        ok?: boolean;
        transactions?: { to: string; data?: string; value?: string }[];
        error?: string;
      };
      if (!txResponse.ok || !txPayload.transactions?.length) {
        const message =
          txPayload.error === "open_join_not_enabled"
            ? "HOOT open join is not enabled yet. The group owner Safe must set the open join service once."
            : txPayload.error ?? "Could not build the HOOT join transaction.";
        throw new Error(message);
      }

      const { sendTransactions } = await import("@aboutcircles/miniapp-sdk");
      await sendTransactions(txPayload.transactions);
      setMessage("Submitted HOOT join. Refresh after Circles indexing.");
      await refreshState({ preserveSelection: true });
      setSupportRefreshNonce((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join HOOT.");
    } finally {
      setIsTrustingHoot(false);
    }
  }

  async function supportHoot() {
    const normalized = normalizeAmount(supportAmount);
    if (!address || !isConnected || !isMiniappHost) {
      setError("Open Hootpot inside the Circles host with a connected wallet.");
      return;
    }
    if (!normalized) {
      setError("Enter a valid CRC amount for HOOT support.");
      return;
    }
    if (isSupportingHoot) return;

    setIsSupportingHoot(true);
    setError(null);
    setMessage(null);
    try {
      const txResponse = await fetch("/api/hootpot/group/fund/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantAddress: address,
          amount: normalized,
        }),
      });
      const txPayload = (await txResponse.json()) as {
        ok?: boolean;
        transactions?: { to: string; data?: string; value?: string }[];
        error?: string;
      };
      if (!txResponse.ok || !txPayload.transactions?.length) {
        const message =
          txPayload.error === "no_group_mint_path"
            ? "No HOOT mint path yet. Join HOOT first, then try again after Circles indexing."
            : txPayload.error === "invalid_amount"
              ? "Enter a valid CRC amount."
              : txPayload.error ?? "Could not build HOOT support transaction.";
        throw new Error(message);
      }

      const { sendTransactions } = await import("@aboutcircles/miniapp-sdk");
      await sendTransactions(txPayload.transactions);
      setMessage(
        `Submitted ${normalized} CRC through the HOOT mint handler. The treasury updates after Circles indexing.`,
      );
      await refreshState({ preserveSelection: true });
      setSupportRefreshNonce((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not support HOOT.");
    } finally {
      setIsSupportingHoot(false);
    }
  }

  async function addGroupMember() {
    const memberAddress = normalizedGroupMemberAddress;
    if (!isConfiguredAddress(memberAddress)) {
      setError("Enter the Circles account that should become a HOOT member.");
      return;
    }
    if (!address || !isConnected || !isMiniappHost) {
      setError("Open Hootpot inside the Circles host and select the HOOT owner Safe.");
      return;
    }
    if (isAddingGroupMember) return;

    setIsAddingGroupMember(true);
    setError(null);
    setMessage(null);
    try {
      const txResponse = await fetch("/api/hootpot/group/members/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operatorAddress: address,
          memberAddress,
        }),
      });
      const txPayload = (await txResponse.json()) as {
        ok?: boolean;
        transactions?: { to: string; data?: string; value?: string }[];
        error?: string;
      };
      if (!txResponse.ok || !txPayload.transactions?.length) {
        const message =
          txPayload.error === "group_owner_or_service_required"
            ? "The active account must be the HOOT group owner/service Safe to add members."
            : txPayload.error ?? "Could not build the HOOT member transaction.";
        throw new Error(message);
      }

      const { sendTransactions } = await import("@aboutcircles/miniapp-sdk");
      await sendTransactions(txPayload.transactions);
      setMessage(`${formatAddress(memberAddress)} was submitted as a HOOT member.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not add the HOOT member.",
      );
    } finally {
      setIsAddingGroupMember(false);
    }
  }

  async function enableOpenJoinService() {
    if (!address || !isConnected || !isMiniappHost) {
      setError("Open Hootpot inside the Circles host and select the HOOT owner Safe.");
      return;
    }
    if (isEnablingOpenJoin) return;

    setIsEnablingOpenJoin(true);
    setError(null);
    setMessage(null);
    try {
      const txResponse = await fetch("/api/hootpot/group/service/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operatorAddress: address }),
      });
      const txPayload = (await txResponse.json()) as {
        ok?: boolean;
        transactions?: { to: string; data?: string; value?: string }[];
        error?: string;
      };
      if (!txResponse.ok) {
        const message =
          txPayload.error === "open_service_not_configured"
            ? "Set NEXT_PUBLIC_HOOTPOT_GROUP_OPEN_SERVICE_ADDRESS first."
            : txPayload.error === "group_owner_required"
              ? "The active account must be the HOOT group owner Safe."
              : txPayload.error ?? "Could not build open join setup transaction.";
        throw new Error(message);
      }
      if (!txPayload.transactions?.length) {
        setMessage("HOOT open join service is already enabled.");
        return;
      }

      const { sendTransactions } = await import("@aboutcircles/miniapp-sdk");
      await sendTransactions(txPayload.transactions);
      setMessage("Submitted HOOT open join service setup. Refresh after indexing.");
      await refreshState({ preserveSelection: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not enable the HOOT open join service.",
      );
    } finally {
      setIsEnablingOpenJoin(false);
    }
  }

  async function trustSenderForPot() {
    if (isTrustingSender) return;
    const trustedAddress = normalizedTrustedSenderAddress;
    if (!isConfiguredAddress(trustedAddress)) {
      setError("Enter the test funder account that should be allowed to top up the pot.");
      return;
    }
    if (!address || !isConnected || !isMiniappHost) {
      setError("Open Hootpot inside the Circles host and select the Hootpot Safe.");
      return;
    }
    if (!isPotOwnerConnected) {
      setError(
        `Select the Hootpot Safe ${formatAddress(POT_ADDRESS)} as the active Circles account. A normal user cannot grant trust for the pot.`,
      );
      return;
    }

    setIsTrustingSender(true);
    setError(null);
    setMessage(null);
    try {
      const txResponse = await fetch("/api/hootpot/pot/trust/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operatorAddress: address,
          trustedAddress,
        }),
      });
      const txPayload = (await txResponse.json()) as {
        ok?: boolean;
        transactions?: { to: string; data?: string; value?: string }[];
        error?: string;
      };
      if (!txResponse.ok || !txPayload.transactions?.length) {
        const message =
          txPayload.error === "pot_owner_required"
            ? "The active Circles account must be the Hootpot Safe to trust a sender."
            : txPayload.error === "trusted_address_is_pot"
              ? "Enter a payer address, not the pot Safe itself."
              : txPayload.error ?? "Could not build the pot trust transaction.";
        throw new Error(message);
      }

      const { sendTransactions } = await import("@aboutcircles/miniapp-sdk");
      await sendTransactions(txPayload.transactions);
      setMessage(
        `${formatAddress(trustedAddress)} was submitted as a trusted test funder. After indexing, switch back to that account for an admin top-up.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not trust the pot sender.",
      );
    } finally {
      setIsTrustingSender(false);
    }
  }

  async function recordPayout() {
    setIsRecordingPayout(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/hootpot/payout", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ payoutTxHash }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        state?: HootpotState;
        error?: string;
      };
      if (!response.ok || !payload.state) {
        throw new Error(payload.error ?? "Could not record payout.");
      }
      setState(payload.state);
      setPayoutTxHash("");
      setMessage("Payout recorded. The winning receipt is marked paid back.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record payout.");
    } finally {
      setIsRecordingPayout(false);
    }
  }

  async function clearTickets() {
    setError(null);
    setMessage(null);
    const response = await fetch("/api/hootpot/tickets", {
      method: "DELETE",
      headers: jsonHeaders(),
    });
    const payload = (await response.json()) as {
      state?: HootpotState;
      error?: string;
    };
    if (!response.ok || !payload.state) {
      setError(payload.error ?? "Could not clear receipts.");
      return;
    }
    setState(payload.state ?? null);
    setActiveTicketId(null);
  }

  async function copyText(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1400);
  }

  return (
    <main className="min-h-screen bg-[#fbf8f2] text-[#171428]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-4 sm:px-5 sm:py-5">
        <section className="grid gap-4 rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-4 shadow-[0_8px_0_#251d3f] md:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col justify-between gap-6">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-12 rounded-[8px] border border-[#251d3f] object-cover"
                  style={{
                    backgroundImage: "url('/assets/hootpot-group-avatar-v2.png')",
                    backgroundPosition: "center",
                    backgroundSize: "cover",
                  }}
                />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#746b80]">
                    Circles receipt cashback
                  </p>
                  <h1 className="text-4xl font-black leading-none tracking-normal">
                    Hootpot
                  </h1>
                </div>
              </div>
              <p className="max-w-xl text-base font-medium leading-6 text-[#4f475c]">
                Pay local with CRC. Every verified receipt can be paid back by
                the community pot.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="rounded-[6px] bg-[#ff7a1a] px-3 py-1 text-[#1c140b]">
                {eligibleTickets.length} eligible receipts
              </Badge>
              <Badge className="rounded-[6px] bg-[#d8f36a] px-3 py-1 text-[#1f2a0a]">
                {formatCrcBalance(potTotal)} pot
              </Badge>
              <Badge className="rounded-[6px] bg-[#e9e2ff] px-3 py-1 text-[#2a2064]">
                cashback Sunday
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
            <Metric
              label="Wallet"
              value={accountDisplayName(account, address)}
              icon={Wallet}
            />
            <Metric
              label="CRC balance"
              value={accountBalanceLabel(account, isConnected)}
              icon={Coins}
            />
            <Metric
              label="Host"
              value={isMiniappHost ? "Circles" : "Preview"}
              icon={Check}
            />
            <Metric
              label="Max cashback"
              value={`${MAX_CASHBACK_CRC} CRC`}
              icon={Coins}
            />
          </div>
        </section>

        {isConnected ? (
          <section className="grid gap-3 rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-[#e9e2ff] text-[#2a2064]">
                <Wallet className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#746b80]">
                  Circles account
                </p>
                <p className="truncate text-base font-black">
                  {accountDisplayName(account, address)}
                </p>
                <p className="truncate font-mono text-xs text-[#746b80]">
                  {address}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Badge className="rounded-[6px] bg-[#e9e2ff] px-3 py-1 text-[#2a2064]">
                {accountStatusLabel(account)}
              </Badge>
              <Badge className="rounded-[6px] bg-[#d8f36a] px-3 py-1 text-[#1f2a0a]">
                {accountBalanceLabel(account, isConnected)}
              </Badge>
              {account.status === "found" ? (
                <Badge className="rounded-[6px] bg-[#f7f1e8] px-3 py-1 text-[#251d3f]">
                  {account.trustsCount}/{account.trustedByCount} trust
                </Badge>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-4 shadow-[0_6px_0_#251d3f] md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <span
              aria-hidden="true"
              className="size-16 shrink-0 rounded-[8px] border border-[#251d3f] object-cover"
              style={{
                backgroundImage: "url('/assets/hootpot-group-avatar-v2.png')",
                backgroundPosition: "center",
                backgroundSize: "cover",
              }}
            />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#746b80]">
                Circles group
              </p>
              <h2 className="text-2xl font-black leading-tight">HOOT Group</h2>
              <p className="mt-1 max-w-2xl text-sm font-semibold leading-5 text-[#746b80]">
                Star HOOT in Circles Core to route affiliate CRC support to the
                group over time. Cashback payouts still come from the Hootpot
                Safe balance.
              </p>
              <p className="mt-2 font-mono text-xs font-bold text-[#746b80]">
                {formatAddress(GROUP_ADDRESS)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <a
              href={GROUP_URL}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#d8f36a] px-3 text-sm font-black text-[#1f2a0a]",
                !groupConfigured && "pointer-events-none opacity-50",
              )}
            >
              <Star className="size-4" />
              Star HOOT
            </a>
            <a
              href={GROUP_METRICS_URL}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#251d3f] bg-white px-3 text-sm font-black text-[#251d3f]",
                !groupConfigured && "pointer-events-none opacity-50",
              )}
            >
              <Users className="size-4" />
              Group Stats
            </a>
          </div>
        </section>

        <section className="grid gap-4 rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-4 md:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="flex items-center gap-2">
              <Star className="size-5 text-[#ff7a1a]" />
              <h2 className="text-xl font-black">Join And Fund HOOT</h2>
            </div>
            <p className="mt-2 text-sm font-semibold leading-5 text-[#746b80]">
              Join HOOT once, then mint HOOT through the group mint handler.
              Your CRC becomes treasury collateral and you receive HOOT group
              tokens. Starring HOOT is separate recurring affiliate support.
            </p>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <ProofRow
                label="You accept HOOT"
                value={
                  supportState?.participantTrustsGroup
                    ? "yes"
                    : isLoadingSupport
                      ? "checking"
                      : "not yet"
                }
              />
              <ProofRow
                label="HOOT accepts you"
                value={
                  supportState?.groupTrustsParticipant
                    ? "yes"
                    : isLoadingSupport
                      ? "checking"
                      : "not yet"
                }
              />
              <ProofRow
                label="Open join"
                value={
                  openJoinEnabled
                    ? "enabled"
                    : openJoinServiceConfigured
                      ? "setup pending"
                      : "service missing"
                }
              />
              <ProofRow
                label="Mintable now"
                value={`${formatAttoCrc(supportState?.maxMintableAtto)} CRC`}
              />
              <ProofRow
                label="Mint handler"
                value={formatAddress(
                  supportState?.mintHandler ?? groupMintHandlerAddress ?? null,
                )}
              />
              <ProofRow
                label="Treasury"
                value={formatAddress(groupTreasuryAddress)}
              />
              <ProofRow
                label="Treasury backing"
                value={formatCrcBalance(group?.treasuryBalanceCrc ?? 0)}
              />
              <ProofRow
                label="HOOT supply"
                value={formatCrcBalance(group?.totalSupplyCrc ?? 0)}
              />
            </div>
          </div>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <a
                href={GROUP_URL}
                className={cn(
                  "inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#d8f36a] px-3 text-sm font-black text-[#1f2a0a]",
                  !groupConfigured && "pointer-events-none opacity-50",
                )}
              >
                <Star className="size-4" />
                Star HOOT
              </a>
              <Button
                type="button"
                disabled={!isConnected || !isMiniappHost || !groupConfigured || isTrustingHoot}
                onClick={joinHootGroup}
                className="h-10 rounded-[8px] bg-[#251d3f] text-[#fffdf8] hover:bg-[#382b66]"
              >
                <ShieldCheck className="size-4" />
                {isTrustingHoot ? "Submitting..." : "Join HOOT"}
              </Button>
            </div>
            <label className="grid gap-2 text-sm font-semibold">
              Fund HOOT
              <div className="flex h-10 overflow-hidden rounded-[8px] border border-[#d8cfbe] bg-white text-[#171428]">
                <input
                  value={supportAmount}
                  onChange={(event) => setSupportAmount(event.target.value)}
                  inputMode="decimal"
                  className="min-w-0 flex-1 px-3 font-bold outline-none"
                />
                <span className="flex items-center border-l border-[#e9dfce] px-3 text-sm font-black text-[#746b80]">
                  CRC
                </span>
              </div>
            </label>
            <Button
              type="button"
              disabled={!canSupportHoot}
              onClick={supportHoot}
              className="h-10 rounded-[8px] bg-[#ff7a1a] text-[#1c140b] hover:bg-[#ff8f3f]"
            >
              <Coins className="size-4" />
              {isSupportingHoot ? "Submitting..." : "Mint HOOT"}
            </Button>
            {!supportState?.groupTrustsParticipant ? (
              <p className="rounded-[8px] border border-[#e9dfce] bg-[#f7f1e8] p-3 text-xs font-semibold leading-4 text-[#746b80]">
                {openJoinEnabled
                  ? "Click Join HOOT first. After indexing, this mint path should open."
                  : "HOOT open join is not enabled yet. The owner Safe needs a one-time service setup."}
              </p>
            ) : supportState?.participantTrustsGroup &&
              !isPositiveAtto(supportState.maxMintableAtto) ? (
              <p className="rounded-[8px] border border-[#e9dfce] bg-[#f7f1e8] p-3 text-xs font-semibold leading-4 text-[#746b80]">
                No mintable CRC flow to HOOT right now. This usually means there
                is not enough trusted CRC balance or the Circles pathfinder has
                not indexed the latest join yet.
              </p>
            ) : hasHootMintPath && !canMintRequestedSupport ? (
              <p className="rounded-[8px] border border-[#e9dfce] bg-[#f7f1e8] p-3 text-xs font-semibold leading-4 text-[#746b80]">
                The entered amount is above the current mint path. Try at most{" "}
                {formatAttoCrc(supportState?.maxMintableAtto)} CRC.
              </p>
            ) : null}
          </div>
        </section>

        {(message || error) && (
          <section
            className={cn(
              "rounded-[8px] border p-3 text-sm font-bold",
              error
                ? "border-[#b42318] bg-[#fff0ed] text-[#8a1f14]"
                : "border-[#0d7f5f] bg-[#e7fbf4] text-[#075640]",
            )}
          >
            {error ?? message}
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card className="rounded-[8px] border-[#251d3f] bg-[#fffdf8] shadow-none ring-[#251d3f]">
            <CardHeader className="border-b border-[#e9dfce]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl font-black">
                    <Store className="size-5 text-[#ff7a1a]" />
                    Merchant Checkout
                  </CardTitle>
                  <p className="mt-1 text-sm text-[#746b80]">
                    The shop gets paid now. Hootpot can reimburse the receipt later.
                  </p>
                </div>
                <Badge variant="outline" className="rounded-[6px]">
                  CRC
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4">
              <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
                <label className="grid gap-2 text-sm font-semibold">
                  Shop
                  <select
                    value={selectedMerchantId}
                    onChange={(event) => setSelectedMerchantId(event.target.value)}
                    className="h-11 rounded-[8px] border border-[#d8cfbe] bg-white px-3 text-base font-bold outline-none focus:border-[#251d3f]"
                  >
                    {MERCHANTS.map((merchant) => (
                      <option key={merchant.id} value={merchant.id}>
                        {merchant.name} · {merchant.category}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Receipt amount
                  <div className="flex h-11 overflow-hidden rounded-[8px] border border-[#d8cfbe] bg-white focus-within:border-[#251d3f]">
                    <input
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      inputMode="decimal"
                      className="min-w-0 flex-1 px-3 text-base font-bold outline-none"
                    />
                    <span className="flex items-center border-l border-[#e9dfce] px-3 text-sm font-black text-[#746b80]">
                      CRC
                    </span>
                  </div>
                </label>
              </div>

              <div className="grid gap-2 rounded-[8px] border border-[#e9dfce] bg-[#f7f1e8] p-3 text-sm text-[#4f475c] sm:grid-cols-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#746b80]">
                    Recipient
                  </p>
                  <p className="font-mono text-xs font-bold">
                    {formatAddress(selectedMerchant.address)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#746b80]">
                    Cashback
                  </p>
                  <p className="font-bold">
                    up to {cashbackForAmount(normalizeAmount(amount) ?? "0")} CRC
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#746b80]">
                    Status
                  </p>
                  <p className="font-bold">
                    {isConfiguredAddress(selectedMerchant.address)
                      ? "configured"
                      : "needs env"}
                  </p>
                </div>
              </div>

              {!isConfiguredAddress(selectedMerchant.address) ? (
                <div className="rounded-[8px] border border-[#e9dfce] bg-white p-3 text-sm font-semibold text-[#746b80]">
                  Merchant registry pending. Checkout unlocks when Hootpot
                  deploys and configures merchant payout addresses.
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="lg"
                  disabled={
                    !isValidAmount(amount) ||
                    isCreating ||
                    !isConfiguredAddress(selectedMerchant.address)
                  }
                  onClick={createTicket}
                  className="h-11 rounded-[8px] bg-[#251d3f] px-4 text-[#fffdf8] hover:bg-[#382b66]"
                >
                  <ReceiptText className="size-4" />
                  {isCreating ? "Creating..." : "Create Receipt"}
                </Button>
                {activeTicket && isConfiguredAddress(activeTicket.merchantAddress) ? (
                  <span className="inline-flex h-11 items-center rounded-[8px] border border-[#251d3f] bg-[#d8f36a] px-4 text-sm font-black text-[#171428]">
                    Host payment ready
                  </span>
                ) : activeTicket ? (
                  <span className="inline-flex h-11 items-center rounded-[8px] border border-[#d8cfbe] px-4 text-sm font-black text-[#746b80]">
                    Payment recipient pending
                  </span>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[8px] border-[#251d3f] bg-[#251d3f] text-[#fffdf8] shadow-none ring-[#251d3f]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-black">
                <Gift className="size-5 text-[#d8f36a]" />
                Hootpot
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#c9c1dc]">
                  Pot Safe balance
                </p>
                <p className="mt-1 text-5xl font-black">
                  {formatCrcBalance(potTotal)}
                </p>
              </div>
              <div className="grid gap-2 text-sm">
                <PotRow
                  label="Pot Safe"
                  value={potConfigured ? formatAddress(POT_ADDRESS) : "needs env"}
                />
                <PotRow
                  label="Actual balance"
                  value={formatCrcBalance(potTotal)}
                />
                <PotRow
                  label="Max receipt payback"
                  value={`${MAX_CASHBACK_CRC} CRC`}
                />
              </div>
              <div className="rounded-[8px] border border-[#706095] bg-[#31264f] p-3 text-sm font-semibold leading-5 text-[#d9d1ea]">
                Users can support HOOT by starring the group. Cashback itself is
                paid from this Safe after operator, merchant, sponsor, or future
                HOOT treasury funding.
              </div>
              {operatorMode ? (
                <>
                  <div className="grid gap-3 rounded-[8px] border border-[#706095] bg-[#fffdf8] p-3 text-[#171428]">
                    <div className="flex gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-[#d8f36a] text-[#1f2a0a]">
                        <ShieldCheck className="size-5" />
                      </span>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#746b80]">
                          Test funding setup
                        </p>
                        <p className="text-sm font-semibold leading-5 text-[#4f475c]">
                          Only for admin testing: select the Hootpot Safe, then
                          trust a test funder before sending direct CRC top-ups.
                        </p>
                      </div>
                    </div>
                    <label className="grid gap-2 text-sm font-semibold">
                      Test funder address
                      <input
                        value={trustedSenderAddress}
                        onChange={(event) =>
                          setTrustedSenderAddress(event.target.value)
                        }
                        placeholder="0x funder"
                        className="h-10 min-w-0 rounded-[8px] border border-[#d8cfbe] bg-white px-3 font-mono text-xs outline-none focus:border-[#251d3f]"
                      />
                    </label>
                    <div className="grid gap-2">
                      <Button
                        type="button"
                        disabled={!canTrustSender || isTrustingSender}
                        onClick={trustSenderForPot}
                        className="h-10 rounded-[8px] bg-[#d8f36a] text-[#1f2a0a] hover:bg-[#e2f77d]"
                      >
                        <ShieldCheck className="size-4" />
                        {isTrustingSender ? "Submitting..." : "Trust Test Funder"}
                      </Button>
                      <p className="text-xs font-semibold leading-4 text-[#746b80]">
                        {isPotOwnerConnected
                          ? "This writes trust from the Hootpot Safe on Circles Hub v2."
                          : `Active account must be the Hootpot Safe ${formatAddress(POT_ADDRESS)}.`}
                      </p>
                    </div>
                    </div>
                    <div className="grid gap-3 rounded-[8px] border border-[#706095] bg-[#fffdf8] p-3 text-[#171428]">
                      <div className="flex gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-[#d8f36a] text-[#1f2a0a]">
                          <Users className="size-5" />
                        </span>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#746b80]">
                            Open join setup
                          </p>
                          <p className="text-sm font-semibold leading-5 text-[#4f475c]">
                            One-time owner action: set the HOOT group service so
                            users can join themselves from the app.
                          </p>
                        </div>
                      </div>
                      <div className="grid gap-2 text-xs font-semibold leading-4 text-[#746b80]">
                        <p>
                          Service:{" "}
                          {openJoinServiceConfigured
                            ? formatAddress(group?.configuredOpenService ?? null)
                            : "env required"}
                        </p>
                        <p>Status: {openJoinEnabled ? "enabled" : "not enabled"}</p>
                      </div>
                      <Button
                        type="button"
                        disabled={!canEnableOpenJoin}
                        onClick={enableOpenJoinService}
                        className="h-10 rounded-[8px] bg-[#d8f36a] text-[#1f2a0a] hover:bg-[#e2f77d]"
                      >
                        <ShieldCheck className="size-4" />
                        {isEnablingOpenJoin ? "Submitting..." : "Enable Open Join"}
                      </Button>
                    </div>
                    <div className="grid gap-3 rounded-[8px] border border-[#706095] bg-[#fffdf8] p-3 text-[#171428]">
                      <div className="flex gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-[#e9e2ff] text-[#2a2064]">
                        <Users className="size-5" />
                      </span>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#746b80]">
                            Fallback member invite
                          </p>
                          <p className="text-sm font-semibold leading-5 text-[#4f475c]">
                            Manual backup only. Normal users should use Join HOOT
                            after open join is enabled.
                          </p>
                      </div>
                    </div>
                    <label className="grid gap-2 text-sm font-semibold">
                      Member address
                      <input
                        value={groupMemberAddress}
                        onChange={(event) => setGroupMemberAddress(event.target.value)}
                        placeholder="0x member"
                        className="h-10 min-w-0 rounded-[8px] border border-[#d8cfbe] bg-white px-3 font-mono text-xs outline-none focus:border-[#251d3f]"
                      />
                    </label>
                    <Button
                      type="button"
                      disabled={!canAddGroupMember || isAddingGroupMember}
                      onClick={addGroupMember}
                      className="h-10 rounded-[8px] bg-[#251d3f] text-[#fffdf8] hover:bg-[#382b66]"
                    >
                      <Users className="size-4" />
                      {isAddingGroupMember ? "Submitting..." : "Add HOOT Member"}
                    </Button>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold">
                      Admin top-up
                      <div className="mt-2 flex h-10 overflow-hidden rounded-[8px] border border-[#706095] bg-[#fffdf8] text-[#171428]">
                        <input
                          value={topUpAmount}
                          onChange={(event) => setTopUpAmount(event.target.value)}
                          inputMode="decimal"
                          className="min-w-0 flex-1 px-3 font-bold outline-none"
                        />
                        <span className="flex items-center border-l border-[#d8cfbe] px-3 text-sm font-black text-[#746b80]">
                          CRC
                        </span>
                      </div>
                    </label>
                    <Button
                      type="button"
                      disabled={!potConfigured || !normalizedTopUpAmount || isFundingPot}
                      onClick={fundPot}
                      className={cn(
                        "h-10 rounded-[8px] bg-[#ff7a1a] px-3 text-sm font-black text-[#1c140b] hover:bg-[#ff8c3d]",
                        (!potConfigured || !normalizedTopUpAmount || isFundingPot) &&
                          "opacity-50",
                      )}
                    >
                      {isFundingPot
                        ? "Funding..."
                        : isMiniappHost
                          ? "Admin Fund In App"
                          : "Open Admin Transfer"}
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <section className="rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="flex items-center gap-2 text-xl font-black">
                  <CreditCard className="size-5 text-[#0d7f5f]" />
                  Gnosis Pay Receipts
                </h2>
                <Badge variant="outline" className="rounded-[6px]">
                  SIWE sync
                </Badge>
              </div>
              <p className="mt-1 max-w-2xl text-sm font-semibold leading-5 text-[#746b80]">
                Sign once with the connected Safe owner to sync recent card purchases.
                Hootpot never stores a Gnosis Pay access token.
              </p>
            </div>
            <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
              <Button
                type="button"
                disabled={!isConnected || !isMiniappHost || isSyncingGnosisPay}
                onClick={syncGnosisPayReceipts}
                className="h-11 rounded-[8px] bg-[#0d7f5f] px-4 text-white hover:bg-[#0b6b51]"
              >
                <CreditCard className="size-4" />
                {isSyncingGnosisPay ? "Syncing..." : "Sync Receipts"}
              </Button>
            </div>
          </div>
        </section>

        {activeTicket ? (
          <section className="rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#746b80]">
                  {activeTicket.source === "gnosis_pay"
                    ? "External receipt"
                    : "Checkout intent"}
                </p>
                <h2 className="mt-1 text-xl font-black">
                  {activeTicket.merchantName} · {ticketAmountLabel(activeTicket)}
                </h2>
                <p className="mt-1 font-mono text-xs text-[#746b80]">
                  {activeTicket.intentId}
                </p>
                <p className="mt-2 text-sm font-semibold text-[#746b80]">
                  Holder: {formatAddress(activeTicket.participantAddress)}
                </p>
                {activeTicket.source === "gnosis_pay" ? (
                  <p className="mt-1 text-sm font-semibold text-[#746b80]">
                    {activeTicket.externalStatus ?? "Gnosis Pay card payment"}
                  </p>
                ) : null}
                {activeTicket.txHash ? (
                  <p className="mt-1 font-mono text-xs text-[#746b80]">
                    Tx: {formatAddress(activeTicket.txHash)}
                  </p>
                ) : null}
                {activeTicket.verificationError ? (
                  <p className="mt-1 text-sm font-semibold text-[#8a1f14]">
                    {activeTicket.verificationError}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {activeTicket.source !== "gnosis_pay" ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => copyText("data", activeTicket.transferData)}
                    className="rounded-[8px]"
                  >
                    <Copy className="size-4" />
                    {copied === "data" ? "Copied" : "Data"}
                  </Button>
                ) : null}
                {activeTicket.status === "pending_payment" ? (
                  <Button
                    type="button"
                    disabled={
                      isPaying ||
                      !isConnected ||
                      !isMiniappHost ||
                      !isConfiguredAddress(activeTicket.merchantAddress)
                    }
                    onClick={() => submitPayment(activeTicket)}
                    className="rounded-[8px] bg-[#0d7f5f] text-white hover:bg-[#0b6b51]"
                  >
                    <Wallet className="size-4" />
                    {isPaying ? "Sending..." : "Pay in Circles"}
                  </Button>
                ) : activeTicket.status === "payment_submitted" ? (
                  <Button
                    type="button"
                    disabled={isVerifying}
                    onClick={() => retryPaymentVerification(activeTicket)}
                    className="rounded-[8px] bg-[#ff7a1a] text-[#1c140b] hover:bg-[#ff8f3f]"
                  >
                    <RotateCw
                      className={cn("size-4", isVerifying && "animate-spin")}
                    />
                    {isVerifying ? "Verifying..." : "Verify Payment"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled
                    className="rounded-[8px] bg-[#0d7f5f] text-white"
                  >
                    <Check className="size-4" />
                    Eligible
                  </Button>
                )}
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card className="rounded-[8px] border-[#251d3f] bg-[#fffdf8] shadow-none ring-[#251d3f]">
            <CardHeader className="border-b border-[#e9dfce]">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-xl font-black">
                  <Ticket className="size-5 text-[#0d7f5f]" />
                  Receipts
                </CardTitle>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => refreshState({ preserveSelection: true })}
                    className="rounded-[8px]"
                  >
                    <RotateCw className={cn("size-4", isRefreshing && "animate-spin")} />
                  </Button>
                  {operatorMode && tickets.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearTickets}
                      className="rounded-[8px]"
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 pt-4">
              {tickets.length === 0 ? (
                <EmptyState />
              ) : (
                tickets.map((ticket) => (
                  <button
                    key={ticket.ticketId}
                    type="button"
                    onClick={() => setActiveTicketId(ticket.ticketId)}
                    className={cn(
                      "grid gap-3 rounded-[8px] border p-3 text-left transition sm:grid-cols-[1fr_auto]",
                      activeTicketId === ticket.ticketId
                        ? "border-[#251d3f] bg-[#f7f1e8]"
                        : "border-[#e9dfce] bg-white hover:border-[#a99fbd]",
                    )}
                  >
                    <span>
                      <span className="block font-black">{ticket.merchantName}</span>
                      <span className="block text-sm text-[#746b80]">
                        {ticketSourceLabel(ticket)} · {ticketAmountLabel(ticket)} ·{" "}
                        {formatTime(ticket.createdAt)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "inline-flex h-7 items-center justify-center rounded-[6px] px-2 text-xs font-black",
                        ticket.status === "eligible"
                          ? "bg-[#d8f36a] text-[#1f2a0a]"
                          : ticket.status === "reimbursed"
                            ? "bg-[#0d7f5f] text-white"
                            : ticket.status === "payment_submitted"
                              ? "bg-[#ffdfc2] text-[#6a2b00]"
                              : "bg-[#e9e2ff] text-[#2a2064]",
                      )}
                    >
                      {statusLabel(ticket.status)}
                    </span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[8px] border-[#251d3f] bg-[#fffdf8] shadow-none ring-[#251d3f]">
            <CardHeader className="border-b border-[#e9dfce]">
              <CardTitle className="flex items-center gap-2 text-xl font-black">
                <Trophy className="size-5 text-[#ff7a1a]" />
                Cashback
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4">
              <div className="grid grid-cols-3 gap-2">
                <DrawMetric label="Eligible" value={`${eligibleTickets.length}`} />
                <DrawMetric label="Pending" value={`${pendingTickets.length}`} />
                <DrawMetric
                  label="Payback"
                  value={formatCrcBalance(availableCashback)}
                />
              </div>
              <div className="rounded-[8px] border border-[#e9dfce] bg-[#f7f1e8] p-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#746b80]">
                  {draw ? "Drawn cashback" : "Current cashback preview"}
                </p>
                {winnerTicket ? (
                  <>
                    <p className="mt-2 text-lg font-black">
                      {winnerTicket.merchantName}
                    </p>
                    <p className="text-sm text-[#746b80]">
                      {winnerCopy(winnerTicket, availableCashback)}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm font-semibold text-[#746b80]">
                    No eligible receipts yet.
                  </p>
                )}
              </div>
              <div className="grid gap-2 rounded-[8px] border border-[#e9dfce] bg-white p-3 text-sm">
                <ProofRow label="Round" value={state?.roundId ?? ROUND_ID} />
                <ProofRow
                  label="Draw"
                  value={draw ? formatTime(draw.drawnAt) : "not drawn"}
                />
                <ProofRow label="Seed" value={draw?.seed ?? "generated at draw"} />
              </div>
              <div className="grid gap-3 rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-3">
                {operatorMode ? (
                  <label className="grid gap-2 text-sm font-semibold">
                    Operator key
                    <input
                      value={operatorSecret}
                      onChange={(event) => setOperatorSecret(event.target.value)}
                      type="password"
                      className="h-10 min-w-0 rounded-[8px] border border-[#d8cfbe] bg-white px-3 font-mono text-xs outline-none focus:border-[#251d3f]"
                    />
                  </label>
                ) : null}
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#746b80]">
                    Round draw
                  </p>
                  {draw ? (
                    <>
                      <p className="mt-2 text-base font-black">
                        {formatAddress(draw.winnerAddress)} wins {draw.payoutAmount} CRC
                      </p>
                      <p className="mt-1 font-mono text-xs text-[#746b80]">
                        Ticket {formatAddress(draw.winnerTicketId)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm font-semibold text-[#746b80]">
                      Draw after at least one receipt is eligible and the pot has CRC.
                    </p>
                  )}
                </div>
                {!operatorMode ? (
                  <div className="rounded-[8px] border border-[#e9dfce] bg-white p-3 text-sm font-semibold text-[#746b80]">
                    Cashback operations are run by the Hootpot operator after the
                    round closes.
                  </div>
                ) : draw ? (
                  draw.payoutTxHash ? (
                    <ProofRow
                      label="Payout"
                      value={formatAddress(draw.payoutTxHash)}
                    />
                  ) : (
                    <div className="grid gap-2">
                      <input
                        value={payoutTxHash}
                        onChange={(event) => setPayoutTxHash(event.target.value)}
                        placeholder="0x payout tx hash"
                        className="h-10 min-w-0 rounded-[8px] border border-[#d8cfbe] bg-white px-3 font-mono text-xs outline-none focus:border-[#251d3f]"
                      />
                      <Button
                        type="button"
                        disabled={isRecordingPayout || !payoutTxHash}
                        onClick={recordPayout}
                        className="h-10 rounded-[8px] bg-[#0d7f5f] text-white hover:bg-[#0b6b51]"
                      >
                        {isRecordingPayout ? "Recording..." : "Record Payout"}
                      </Button>
                    </div>
                  )
                ) : (
                  <Button
                    type="button"
                    disabled={
                      isDrawing ||
                      eligibleTickets.length === 0 ||
                      availableCashback <= 0
                    }
                    onClick={drawRound}
                    className="h-10 rounded-[8px] bg-[#251d3f] text-[#fffdf8] hover:bg-[#382b66]"
                  >
                    <Trophy className="size-4" />
                    {isDrawing ? "Drawing..." : "Draw Winner"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <InfoPanel
            title="HOOT Support Group"
            body="Star HOOT in Circles Core to route affiliate support. Circles currently sends 2 of 24 daily CRC to the selected affiliate group."
            action={
              GROUP_URL ? (
                <a
                  href={GROUP_URL}
                  className="inline-flex items-center gap-1 text-sm font-black text-[#251d3f]"
                >
                  Star HOOT
                  <ExternalLink className="size-4" />
                </a>
              ) : (
                <span className="text-sm font-black text-[#746b80]">group pending</span>
              )
            }
          />
          <InfoPanel
            title="Merchant Registry"
            body="Merchant payout addresses are preconfigured before shoppers see checkout."
            action={
              merchantRegistryConfigured ? (
                <a
                  href={`https://gnosisscan.io/address/${MERCHANT_REGISTRY_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-black text-[#251d3f]"
                >
                  Open Registry
                  <ExternalLink className="size-4" />
                </a>
              ) : (
                <span className="text-sm font-black text-[#746b80]">
                  registry pending
                </span>
              )
            }
          />
          <InfoPanel
            title="Draw Registry"
            body="The receipt registry records eligible receipts and the winning payer."
            action={
              registryConfigured ? (
                <a
                  href={`https://gnosisscan.io/address/${REGISTRY_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-black text-[#251d3f]"
                >
                  Open Contract
                  <ExternalLink className="size-4" />
                </a>
              ) : (
                <span className="text-sm font-black text-[#746b80]">
                  contract pending
                </span>
              )
            }
          />
          <InfoPanel
            title="Prize Pool"
            body="The Hootpot pool can be funded before the draw and referenced from the app."
            action={
              poolConfigured ? (
                <a
                  href={`https://gnosisscan.io/address/${POOL_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-black text-[#251d3f]"
                >
                  Open Pool
                  <ExternalLink className="size-4" />
                </a>
              ) : (
                <span className="text-sm font-black text-[#ff7a1a]">
                  pool pending
                </span>
              )
            }
          />
          <InfoPanel
            title="Gnosis Pay Receipts"
            body="Card receipts can enter Hootpot through the Gnosis Pay transaction API; webhooks are the production path."
            action={
              <span className="text-sm font-black text-[#0d7f5f]">
                SIWE + webhook
              </span>
            }
          />
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[8px] border border-[#e9dfce] bg-[#f7f1e8] p-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-[#d8f36a] text-[#1f2a0a]">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#746b80]">
          {label}
        </p>
        <p className="truncate text-sm font-black">{value}</p>
      </div>
    </div>
  );
}

function PotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#706095] py-2 last:border-0">
      <span className="text-[#c9c1dc]">{label}</span>
      <span className="font-black">{value}</span>
    </div>
  );
}

function DrawMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[#e9dfce] bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#746b80]">
        {label}
      </p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function ProofRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[#746b80]">{label}</span>
      <span className="text-right font-mono text-xs font-bold">{value}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[8px] border border-dashed border-[#bcb1c8] bg-white p-6 text-center">
      <ReceiptText className="mx-auto mb-2 size-8 text-[#746b80]" />
      <p className="font-black">No receipts yet</p>
      <p className="mt-1 text-sm text-[#746b80]">
        Create a merchant checkout to start this week&apos;s cashback round.
      </p>
    </div>
  );
}

function InfoPanel({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: ReactNode;
}) {
  return (
    <div className="rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-4">
      <h3 className="font-black">{title}</h3>
      <p className="mt-2 min-h-12 text-sm leading-5 text-[#746b80]">{body}</p>
      <div className="mt-3">{action}</div>
    </div>
  );
}
