"use client";

import {
  ArrowRight,
  Check,
  Coins,
  ExternalLink,
  ReceiptText,
  RotateCw,
  Store,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";
import {
  cashbackForAmount,
  formatAddress,
  GROUP_URL,
  isConfiguredAddress,
  MAX_CASHBACK_CRC,
  normalizeAmount,
  POT_ADDRESS,
  type HootpotMerchant,
} from "@/lib/hootpot/config";
import {
  circlesPlaygroundUrl,
  directCheckoutUrl,
  merchantCheckoutUrl,
} from "@/lib/hootpot/urls";
import { cn } from "@/lib/utils";
import type {
  HootpotState,
  HootpotTicket,
} from "@/lib/server/hootpot/store";

type PaymentVerification = {
  status: "verified" | "pending" | "failed";
  reason?: string;
};

function formatCrcAmount(value: string | number): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(parsed);
}

function statusLabel(ticket: HootpotTicket | null): string {
  if (!ticket) return "new";
  if (ticket.status === "eligible") return "eligible";
  if (ticket.status === "reimbursed") return "paid back";
  if (ticket.status === "payment_submitted") return "verifying";
  return "ready to pay";
}

export function MerchantCheckoutPage({
  merchant,
  initialAmount,
  directMode = false,
}: {
  merchant: HootpotMerchant;
  initialAmount: string;
  directMode?: boolean;
}) {
  const { address, isConnected, isMiniappHost } = useWallet();
  const [amount, setAmount] = useState(initialAmount);
  const [ticket, setTicket] = useState<HootpotTicket | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const normalizedAmount = normalizeAmount(amount);
  const merchantConfigured = isConfiguredAddress(merchant.address);
  const checkoutUrl = directMode
    ? directCheckoutUrl({
        merchantAddress: merchant.address,
        merchantName: merchant.name,
        amount: normalizedAmount ?? initialAmount,
      })
    : merchantCheckoutUrl(merchant.id, normalizedAmount ?? initialAmount);
  const playgroundUrl = circlesPlaygroundUrl(checkoutUrl);

  async function createTicket() {
    if (!normalizedAmount || isCreating) return;
    setIsCreating(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        directMode ? "/api/hootpot/direct-checkout" : "/api/hootpot/checkout",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            directMode
              ? {
                  merchantAddress: merchant.address,
                  merchantName: merchant.name,
                  amount: normalizedAmount,
                  participantAddress: address,
                }
              : {
                  merchantId: merchant.id,
                  amount: normalizedAmount,
                  participantAddress: address,
                },
          ),
        },
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        ticket?: HootpotTicket;
        error?: string;
      };
      if (!response.ok || !payload.ticket) {
        throw new Error(payload.error ?? "Could not create receipt.");
      }
      setTicket(payload.ticket);
      setMessage("Receipt created. Pay the merchant to enter the cashback round.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create receipt.");
    } finally {
      setIsCreating(false);
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
        ticket?: HootpotTicket | null;
        state?: HootpotState;
        verification?: PaymentVerification;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not verify payment.");
      }
      const updatedTicket =
        payload.ticket ??
        payload.state?.tickets.find((item) => item.ticketId === ticketId) ??
        null;
      if (updatedTicket) setTicket(updatedTicket);
      setMessage(
        payload.verification?.status === "verified"
          ? "Payment verified on Gnosis Chain. Your receipt is eligible."
          : "Payment submitted. Try verify again after Gnosis Chain indexing.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify payment.");
    } finally {
      setIsVerifying(false);
    }
  }

  async function payTicket() {
    if (!ticket || isPaying) return;
    if (!address || !isConnected) {
      setError("Open this checkout inside the Circles host with a connected account.");
      return;
    }
    if (!isMiniappHost) {
      window.location.assign(playgroundUrl);
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

  async function retryVerification() {
    if (!ticket) return;
    const txHashes = ticket.txHashes ?? (ticket.txHash ? [ticket.txHash] : []);
    await submitTicketTxHashes(ticket.ticketId, txHashes);
  }

  return (
    <main className="min-h-screen bg-[#fbf8f2] text-[#171428]">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
        <section className="rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-4 shadow-[0_8px_0_#251d3f]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Badge className="rounded-[6px] bg-[#ff7a1a] text-[#1c140b]">
                CRC checkout
              </Badge>
              <h1 className="mt-3 text-4xl font-black leading-none">
                {merchant.name}
              </h1>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-5 text-[#746b80]">
                Pay this merchant in CRC. Once the on-chain payment is verified,
                the receipt enters Hootpot cashback.
              </p>
            </div>
            <div className="flex size-16 shrink-0 items-center justify-center rounded-[8px] bg-[#d8f36a] text-[#1f2a0a]">
              <Store className="size-8" />
            </div>
          </div>
        </section>

        <section className="grid gap-3 rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-4 md:grid-cols-3">
          <CheckoutMetric label="Merchant" value={merchant.category} icon={Store} />
          <CheckoutMetric
            label="Recipient"
            value={
              merchantConfigured ? formatAddress(merchant.address) : "not configured"
            }
            icon={Wallet}
          />
          <CheckoutMetric
            label="Max payback"
            value={`${MAX_CASHBACK_CRC} CRC`}
            icon={Coins}
          />
        </section>

        <section className="rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-4">
          <div className="grid gap-4">
            <label className="grid gap-2 text-sm font-semibold">
              Amount
              <div className="flex h-12 overflow-hidden rounded-[8px] border border-[#d8cfbe] bg-white focus-within:border-[#251d3f]">
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  className="min-w-0 flex-1 px-3 text-lg font-black outline-none"
                />
                <span className="flex items-center border-l border-[#e9dfce] px-3 text-sm font-black text-[#746b80]">
                  CRC
                </span>
              </div>
            </label>

            <div className="grid gap-2 rounded-[8px] border border-[#e9dfce] bg-[#f7f1e8] p-3 text-sm sm:grid-cols-3">
              <ProofRow
                label="Receipt"
                value={ticket ? formatAddress(ticket.ticketId) : "not created"}
              />
              <ProofRow
                label="Cashback"
                value={`${formatCrcAmount(cashbackForAmount(normalizedAmount ?? "0"))} CRC`}
              />
              <ProofRow label="Status" value={statusLabel(ticket)} />
            </div>

            {!merchantConfigured ? (
              <Notice tone="error">
                This merchant does not have a configured payout address yet.
              </Notice>
            ) : !isMiniappHost ? (
              <Notice>
                Open this checkout in the Circles host so Hootpot can submit the
                CRC payment and capture the tx hash automatically.
              </Notice>
            ) : null}

            {message || error ? (
              <Notice tone={error ? "error" : "success"}>{error ?? message}</Notice>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2">
              {!ticket ? (
                <Button
                  type="button"
                  disabled={!normalizedAmount || !merchantConfigured || isCreating}
                  onClick={createTicket}
                  className="h-12 rounded-[8px] bg-[#251d3f] text-[#fffdf8] hover:bg-[#382b66]"
                >
                  <ReceiptText className="size-4" />
                  {isCreating ? "Creating..." : "Create Receipt"}
                </Button>
              ) : ticket.status === "pending_payment" ? (
                <Button
                  type="button"
                  disabled={!merchantConfigured || isPaying}
                  onClick={payTicket}
                  className="h-12 rounded-[8px] bg-[#0d7f5f] text-white hover:bg-[#0b6b51]"
                >
                  <Wallet className="size-4" />
                  {isPaying ? "Sending..." : "Pay In Circles"}
                </Button>
              ) : ticket.status === "payment_submitted" ? (
                <Button
                  type="button"
                  disabled={isVerifying}
                  onClick={retryVerification}
                  className="h-12 rounded-[8px] bg-[#ff7a1a] text-[#1c140b] hover:bg-[#ff8f3f]"
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
                  className="h-12 rounded-[8px] bg-[#0d7f5f] text-white"
                >
                  <Check className="size-4" />
                  Receipt Eligible
                </Button>
              )}

              <a
                href={playgroundUrl}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] border border-[#251d3f] bg-white px-4 text-sm font-black text-[#251d3f]"
              >
                Open In Circles
                <ExternalLink className="size-4" />
              </a>
            </div>
          </div>
        </section>

        <section className="grid gap-3 rounded-[8px] border border-[#251d3f] bg-[#251d3f] p-4 text-[#fffdf8] sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#c9c1dc]">
              Cashback pot
            </p>
            <p className="mt-1 text-sm font-semibold leading-5 text-[#d9d1ea]">
              Paybacks are funded from the Hootpot Safe. Supporters can star HOOT
              or donate HOOT to increase the pot.
            </p>
            <p className="mt-2 font-mono text-xs text-[#c9c1dc]">
              Safe {formatAddress(POT_ADDRESS)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <a
              href="/pot"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#d8f36a] px-3 text-sm font-black text-[#1f2a0a]"
            >
              View Pot
              <ArrowRight className="size-4" />
            </a>
            <a
              href={GROUP_URL}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#706095] bg-[#31264f] px-3 text-sm font-black text-[#fffdf8]"
            >
              Star HOOT
              <ExternalLink className="size-4" />
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}

function CheckoutMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Store;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[8px] border border-[#e9dfce] bg-[#f7f1e8] p-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-[#d8f36a] text-[#1f2a0a]">
        <Icon className="size-5" />
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

function ProofRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#746b80]">
        {label}
      </p>
      <p className="mt-1 truncate font-mono text-xs font-black">{value}</p>
    </div>
  );
}

function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "success" | "error";
}) {
  return (
    <div
      className={cn(
        "rounded-[8px] border p-3 text-sm font-bold leading-5",
        tone === "success" && "border-[#0d7f5f] bg-[#e7fbf4] text-[#075640]",
        tone === "error" && "border-[#b42318] bg-[#fff0ed] text-[#8a1f14]",
        tone === "info" && "border-[#e9dfce] bg-[#f7f1e8] text-[#746b80]",
      )}
    >
      {children}
    </div>
  );
}
