import {
  ExternalLink,
  Gift,
  ReceiptText,
  Star,
  Store,
  Trophy,
  Wallet,
} from "lucide-react";
import Link from "next/link";

import {
  DEFAULT_CHECKOUT_AMOUNT,
  formatAddress,
  GROUP_METRICS_URL,
  GROUP_URL,
  isConfiguredAddress,
  MAX_CASHBACK_CRC,
  MERCHANTS,
  POT_ADDRESS,
  ROUND_ID,
} from "@/lib/hootpot/config";
import { getHootpotState } from "@/lib/server/hootpot/store";

export const dynamic = "force-dynamic";

function formatCrcAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "0";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(parsed);
}

function formatCrcBalance(value: string | number | null | undefined): string {
  return `${formatCrcAmount(value)} CRC`;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function PotPage() {
  const state = await getHootpotState();
  const recentReceipts = state.tickets.slice(0, 6);
  const activeMerchants = MERCHANTS.filter((merchant) =>
    isConfiguredAddress(merchant.address),
  );
  const configuredMerchantCount = activeMerchants.length;
  const group = state.group;

  return (
    <main className="min-h-screen bg-[#fbf8f2] text-[#171428]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5">
        <section className="grid gap-4 rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-4 shadow-[0_8px_0_#251d3f] md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#746b80]">
              Public pot
            </p>
            <h1 className="mt-1 text-4xl font-black leading-none">
              Hootpot Cashback
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-5 text-[#746b80]">
              Real CRC receipts enter this round after on-chain payment
              verification. Paybacks are funded from the Hootpot Safe.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <a
              href={GROUP_URL}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#d8f36a] px-3 text-sm font-black text-[#1f2a0a]"
            >
              <Star className="size-4" />
              Star HOOT
            </a>
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#251d3f] bg-white px-3 text-sm font-black text-[#251d3f]"
            >
              Open App
            </Link>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <Metric
            label="Safe balance"
            value={formatCrcBalance(state.potTotalCrc)}
            icon={Gift}
          />
          <Metric
            label="Eligible receipts"
            value={String(state.eligibleTickets.length)}
            icon={ReceiptText}
          />
          <Metric
            label="Pending receipts"
            value={String(state.pendingTickets.length)}
            icon={Trophy}
          />
          <Metric
            label="Max payback"
            value={`${MAX_CASHBACK_CRC} CRC`}
            icon={Wallet}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black">
                  <Store className="size-5 text-[#ff7a1a]" />
                  Merchant checkout links
                </h2>
                <p className="mt-1 text-sm font-semibold text-[#746b80]">
                  These links create real Circles receipt intents.
                </p>
              </div>
              <span className="rounded-[6px] bg-[#e9e2ff] px-3 py-1 text-xs font-black text-[#2a2064]">
                {configuredMerchantCount}/{MERCHANTS.length} active
              </span>
            </div>
            <div className="mt-4 grid gap-2">
              {MERCHANTS.map((merchant) => {
                const configured = isConfiguredAddress(merchant.address);
                return (
                  <Link
                    key={merchant.id}
                    href={
                      configured
                        ? `/merchant/${merchant.id}?amount=${DEFAULT_CHECKOUT_AMOUNT}`
                        : "#"
                    }
                    className={[
                      "grid gap-2 rounded-[8px] border p-3 text-left sm:grid-cols-[1fr_auto] sm:items-center",
                      configured
                        ? "border-[#e9dfce] bg-white hover:border-[#251d3f]"
                        : "pointer-events-none border-[#e9dfce] bg-[#f7f1e8] opacity-60",
                    ].join(" ")}
                  >
                    <span>
                      <span className="block font-black">{merchant.name}</span>
                      <span className="block text-sm font-semibold text-[#746b80]">
                        {merchant.category} ·{" "}
                        {configured
                          ? formatAddress(merchant.address)
                          : "payout address pending"}
                      </span>
                    </span>
                    <span className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] bg-[#251d3f] px-3 text-sm font-black text-[#fffdf8]">
                      Profile
                      <ExternalLink className="size-4" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[8px] border border-[#251d3f] bg-[#251d3f] p-4 text-[#fffdf8]">
              <h2 className="text-xl font-black">HOOT support</h2>
              <div className="mt-3 grid gap-2 text-sm">
                <PotRow label="Round" value={ROUND_ID} />
                <PotRow label="Safe" value={formatAddress(POT_ADDRESS)} />
                <PotRow
                  label="Treasury"
                  value={formatAddress(group?.treasury ?? null)}
                />
                <PotRow
                  label="HOOT supply"
                  value={formatCrcBalance(group?.totalSupplyCrc ?? 0)}
                />
                <PotRow
                  label="Treasury backing"
                  value={formatCrcBalance(group?.treasuryBalanceCrc ?? 0)}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={GROUP_URL}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#d8f36a] px-3 text-sm font-black text-[#1f2a0a]"
                >
                  <Star className="size-4" />
                  Star HOOT
                </a>
                <a
                  href={GROUP_METRICS_URL}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#706095] bg-[#31264f] px-3 text-sm font-black text-[#fffdf8]"
                >
                  Stats
                  <ExternalLink className="size-4" />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <ReceiptText className="size-5 text-[#0d7f5f]" />
              Recent receipts
            </h2>
            <span className="rounded-[6px] bg-[#f7f1e8] px-3 py-1 text-xs font-black text-[#746b80]">
              {state.tickets.length} total
            </span>
          </div>
          <div className="mt-4 grid gap-2">
            {recentReceipts.length === 0 ? (
              <div className="rounded-[8px] border border-dashed border-[#bcb1c8] bg-white p-6 text-center">
                <p className="font-black">No receipts yet</p>
                <p className="mt-1 text-sm font-semibold text-[#746b80]">
                  Use a merchant checkout link to create the first verified CRC
                  receipt.
                </p>
              </div>
            ) : (
              recentReceipts.map((ticket) => (
                <div
                  key={ticket.ticketId}
                  className="grid gap-2 rounded-[8px] border border-[#e9dfce] bg-white p-3 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <span>
                    <span className="block font-black">{ticket.merchantName}</span>
                    <span className="block text-sm font-semibold text-[#746b80]">
                      {formatCrcBalance(ticket.amount)} ·{" "}
                      {formatTime(ticket.createdAt)} ·{" "}
                      {formatAddress(ticket.participantAddress)}
                    </span>
                  </span>
                  <span className="inline-flex h-8 items-center justify-center rounded-[6px] bg-[#f7f1e8] px-3 text-xs font-black text-[#251d3f]">
                    {ticket.status.replace("_", " ")}
                  </span>
                </div>
              ))
            )}
          </div>
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
  icon: typeof Gift;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-[#d8f36a] text-[#1f2a0a]">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#746b80]">
          {label}
        </p>
        <p className="truncate text-lg font-black">{value}</p>
      </div>
    </div>
  );
}

function PotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#706095] py-2 last:border-0">
      <span className="text-[#c9c1dc]">{label}</span>
      <span className="truncate text-right font-mono text-xs font-black">
        {value}
      </span>
    </div>
  );
}
