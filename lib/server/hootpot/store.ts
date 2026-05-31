import { createHash, randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  AFFILIATE_DRIP_CRC,
  cashbackForAmount,
  DEFAULT_ZERO_ADDRESS,
  MERCHANTS,
  POT_SEED_CRC,
  RECEIPT_BOOST_CRC,
  ROUND_ID,
  type HootpotMerchant,
} from "@/lib/hootpot/config";
import {
  buildGnosisCrcTransferUrl,
  encodeHootpotTransferData,
} from "@/lib/hootpot/transferData";

export type HootpotTicketStatus =
  | "pending_payment"
  | "payment_submitted"
  | "eligible"
  | "reimbursed";

export type HootpotTicketSource = "circles_checkout" | "gnosis_pay";

export type HootpotTicket = {
  ticketId: string;
  intentId: string;
  roundId: string;
  merchantId: string;
  merchantName: string;
  merchantAddress: string;
  participantAddress: string | null;
  amount: string;
  cashbackAmount: string;
  status: HootpotTicketStatus;
  transferDataPayload: string;
  transferData: string;
  paymentUrl: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  txHash?: string;
  txHashes?: string[];
  verificationError?: string;
  source?: HootpotTicketSource;
  externalReceiptId?: string;
  externalTransactionId?: string;
  sourcePayloadHash?: string;
  externalStatus?: string;
  externalMerchantCity?: string;
  externalMerchantCountry?: string;
  externalMerchantMcc?: string;
  paymentAmount?: string;
  paymentCurrency?: string;
  sourceAmountLabel?: string;
};

export type HootpotDraw = {
  roundId: string;
  seed: string;
  winnerTicketId: string;
  winnerAddress: string;
  payoutAmount: string;
  drawnAt: string;
  payoutTxHash?: string;
  payoutRecordedAt?: string;
};

export type HootpotState = {
  roundId: string;
  tickets: HootpotTicket[];
  eligibleTickets: HootpotTicket[];
  pendingTickets: HootpotTicket[];
  potTotalCrc: number;
  availableCashbackCrc: number;
  winnerTicket: HootpotTicket | null;
  draw: HootpotDraw | null;
};

type HootpotLedger = {
  tickets: HootpotTicket[];
  draw: HootpotDraw | null;
};

export type ExternalHootpotReceiptInput = {
  source: Extract<HootpotTicketSource, "gnosis_pay">;
  externalReceiptId: string;
  externalTransactionId?: string;
  sourcePayloadHash: string;
  merchantName: string;
  participantAddress: string;
  amount: string;
  paymentAmount: string;
  paymentCurrency: string;
  sourceAmountLabel: string;
  externalStatus?: string;
  externalMerchantCity?: string;
  externalMerchantCountry?: string;
  externalMerchantMcc?: string;
  paidAt?: string;
  txHash?: string;
  txHashes?: string[];
};

const STORE_FILE = "hootpot-ledger.json";
const MAX_TICKETS = 500;
const DEFAULT_LEDGER_KEY = "hootpot:ledger";

type KvConfig = {
  url: string;
  token: string;
  key: string;
};

function kvConfig(): KvConfig | null {
  const url = process.env.KV_REST_API_URL?.trim();
  const token = process.env.KV_REST_API_TOKEN?.trim();
  if (!url || !token) return null;
  return {
    url: url.replace(/\/+$/, ""),
    token,
    key: process.env.HOOTPOT_LEDGER_KEY?.trim() || DEFAULT_LEDGER_KEY,
  };
}

function storeDir(): string {
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), "hootpot");
  }
  return path.join(process.cwd(), ".data");
}

function storePath(): string {
  return path.join(storeDir(), STORE_FILE);
}

async function ensureStoreDir() {
  await fs.mkdir(storeDir(), { recursive: true });
}

function emptyLedger(): HootpotLedger {
  return { tickets: [], draw: null };
}

async function kvCommand<T>(config: KvConfig, command: unknown[]): Promise<T> {
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | { result?: T; error?: string }
    | null;

  if (!response.ok || payload?.error) {
    throw new Error(payload?.error ?? `kv_command_failed_${response.status}`);
  }
  return payload?.result as T;
}

async function readKvLedger(config: KvConfig): Promise<HootpotLedger> {
  const raw = await kvCommand<string | null>(config, ["GET", config.key]);
  if (!raw) return emptyLedger();
  const parsed = JSON.parse(raw) as Partial<HootpotLedger>;
  if (!Array.isArray(parsed.tickets)) return emptyLedger();
  return {
    tickets: parsed.tickets.filter(isTicket).slice(0, MAX_TICKETS),
    draw: isDraw(parsed.draw) ? parsed.draw : null,
  };
}

async function writeKvLedger(config: KvConfig, ledger: HootpotLedger) {
  await kvCommand(config, [
    "SET",
    config.key,
    JSON.stringify({
      tickets: ledger.tickets.slice(0, MAX_TICKETS),
      draw: ledger.draw,
    }),
  ]);
}

async function readLedger(): Promise<HootpotLedger> {
  const config = kvConfig();
  if (config) {
    return readKvLedger(config);
  }

  try {
    const raw = await fs.readFile(storePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<HootpotLedger>;
    if (!Array.isArray(parsed.tickets)) return emptyLedger();
    return {
      tickets: parsed.tickets.filter(isTicket).slice(0, MAX_TICKETS),
      draw: isDraw(parsed.draw) ? parsed.draw : null,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyLedger();
    throw error;
  }
}

async function writeLedger(ledger: HootpotLedger) {
  const config = kvConfig();
  if (config) {
    await writeKvLedger(config, ledger);
    return;
  }

  await ensureStoreDir();
  await fs.writeFile(
    storePath(),
    `${JSON.stringify(
      {
        tickets: ledger.tickets.slice(0, MAX_TICKETS),
        draw: ledger.draw,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function isTicket(value: unknown): value is HootpotTicket {
  if (!value || typeof value !== "object") return false;
  const ticket = value as Partial<HootpotTicket>;
  return (
    typeof ticket.ticketId === "string" &&
    typeof ticket.intentId === "string" &&
    typeof ticket.roundId === "string" &&
    typeof ticket.merchantId === "string" &&
    typeof ticket.merchantName === "string" &&
    typeof ticket.merchantAddress === "string" &&
    typeof ticket.amount === "string" &&
    typeof ticket.cashbackAmount === "string" &&
    typeof ticket.transferData === "string" &&
    typeof ticket.paymentUrl === "string" &&
    typeof ticket.createdAt === "string" &&
    (ticket.status === "pending_payment" ||
      ticket.status === "payment_submitted" ||
      ticket.status === "eligible" ||
      ticket.status === "reimbursed")
  );
}

function isDraw(value: unknown): value is HootpotDraw {
  if (!value || typeof value !== "object") return false;
  const draw = value as Partial<HootpotDraw>;
  return (
    typeof draw.roundId === "string" &&
    typeof draw.seed === "string" &&
    typeof draw.winnerTicketId === "string" &&
    typeof draw.winnerAddress === "string" &&
    typeof draw.payoutAmount === "string" &&
    typeof draw.drawnAt === "string" &&
    (draw.payoutTxHash === undefined || typeof draw.payoutTxHash === "string") &&
    (draw.payoutRecordedAt === undefined ||
      typeof draw.payoutRecordedAt === "string")
  );
}

function createIntentId(): string {
  return `hp-${ROUND_ID}-${randomBytes(8).toString("hex")}`;
}

function hashHex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashText(value: string): bigint {
  return BigInt(`0x${hashHex(value)}`);
}

function selectWinner(tickets: HootpotTicket[], seed = ROUND_ID): HootpotTicket | null {
  if (tickets.length === 0) return null;
  const digest = hashText(`${seed}:${tickets.map((ticket) => ticket.ticketId).join(":")}`);
  return tickets[Number(digest % BigInt(tickets.length))];
}

function findMerchant(merchantId: string): HootpotMerchant | null {
  return MERCHANTS.find((merchant) => merchant.id === merchantId) ?? null;
}

export async function getHootpotState(): Promise<HootpotState> {
  const ledger = await readLedger();
  const tickets = ledger.tickets.filter((ticket) => ticket.roundId === ROUND_ID);
  const eligibleTickets = tickets.filter((ticket) => ticket.status === "eligible");
  const pendingTickets = tickets.filter(
    (ticket) =>
      ticket.status === "pending_payment" || ticket.status === "payment_submitted",
  );
  const activeDraw = ledger.draw?.roundId === ROUND_ID ? ledger.draw : null;
  const potTotalCrc =
    POT_SEED_CRC + 4 * AFFILIATE_DRIP_CRC + eligibleTickets.length * RECEIPT_BOOST_CRC;
  const drawnWinner =
    activeDraw === null
      ? null
      : tickets.find((ticket) => ticket.ticketId === activeDraw.winnerTicketId) ?? null;
  const winnerTicket = drawnWinner ?? selectWinner(eligibleTickets);
  const availableCashbackCrc = winnerTicket ? cashbackForAmount(winnerTicket.amount) : 0;

  return {
    roundId: ROUND_ID,
    tickets,
    eligibleTickets,
    pendingTickets,
    potTotalCrc,
    availableCashbackCrc,
    winnerTicket,
    draw: activeDraw,
  };
}

export async function getHootpotTicket(
  ticketId: string,
): Promise<HootpotTicket | null> {
  const ledger = await readLedger();
  return ledger.tickets.find((ticket) => ticket.ticketId === ticketId) ?? null;
}

export async function createHootpotCheckout(input: {
  merchantId: string;
  amount: string;
  participantAddress?: string | null;
}): Promise<HootpotTicket> {
  const ledger = await readLedger();
  const merchant = findMerchant(input.merchantId);
  if (!merchant) {
    throw new Error("merchant_not_found");
  }

  const intentId = createIntentId();
  const transferDataPayload = `hootpot:receipt:${intentId}`;
  const transferData = encodeHootpotTransferData(transferDataPayload);
  const paymentUrl = buildGnosisCrcTransferUrl(
    merchant.address,
    input.amount,
    transferData,
  );
  const now = new Date().toISOString();
  const ticket: HootpotTicket = {
    ticketId: randomUUID(),
    intentId,
    roundId: ROUND_ID,
    merchantId: merchant.id,
    merchantName: merchant.name,
    merchantAddress: merchant.address,
    participantAddress: input.participantAddress ?? null,
    amount: input.amount,
    cashbackAmount: String(cashbackForAmount(input.amount)),
    status: "pending_payment",
    transferDataPayload,
    transferData,
    paymentUrl,
    createdAt: now,
    updatedAt: now,
    source: "circles_checkout",
  };

  await writeLedger({ ...ledger, tickets: [ticket, ...ledger.tickets] });
  return ticket;
}

export async function upsertExternalHootpotReceipts(input: {
  receipts: ExternalHootpotReceiptInput[];
}): Promise<{ importedCount: number; updatedCount: number; tickets: HootpotTicket[] }> {
  const ledger = await readLedger();
  const now = new Date().toISOString();
  const tickets = [...ledger.tickets];
  let importedCount = 0;
  let updatedCount = 0;

  for (const receipt of input.receipts) {
    const receiptKey = `${receipt.source}:${receipt.externalReceiptId}`;
    const deterministicTicketId = `${receipt.source}-${hashHex(receiptKey).slice(0, 32)}`;
    const transferDataPayload = `hootpot:${receipt.source}:${receipt.externalReceiptId}`;
    const transferData = encodeHootpotTransferData(transferDataPayload);
    const ticketIndex = tickets.findIndex(
      (ticket) =>
        ticket.source === receipt.source &&
        ticket.externalReceiptId === receipt.externalReceiptId,
    );
    const existing = ticketIndex >= 0 ? tickets[ticketIndex] : null;
    const baseTicket: HootpotTicket = {
      ticketId: existing?.ticketId ?? deterministicTicketId,
      intentId: existing?.intentId ?? receiptKey,
      roundId: ROUND_ID,
      merchantId: receipt.source,
      merchantName: receipt.merchantName,
      merchantAddress: DEFAULT_ZERO_ADDRESS,
      participantAddress: receipt.participantAddress,
      amount: receipt.amount,
      cashbackAmount: String(cashbackForAmount(receipt.amount)),
      status: existing?.status === "reimbursed" ? "reimbursed" : "eligible",
      transferDataPayload,
      transferData,
      paymentUrl: "",
      createdAt: existing?.createdAt ?? receipt.paidAt ?? now,
      updatedAt: now,
      paidAt: existing?.paidAt ?? receipt.paidAt ?? now,
      txHash: receipt.txHash ?? existing?.txHash,
      txHashes: receipt.txHashes ?? existing?.txHashes,
      source: receipt.source,
      externalReceiptId: receipt.externalReceiptId,
      externalTransactionId: receipt.externalTransactionId,
      sourcePayloadHash: receipt.sourcePayloadHash,
      externalStatus: receipt.externalStatus,
      externalMerchantCity: receipt.externalMerchantCity,
      externalMerchantCountry: receipt.externalMerchantCountry,
      externalMerchantMcc: receipt.externalMerchantMcc,
      paymentAmount: receipt.paymentAmount,
      paymentCurrency: receipt.paymentCurrency,
      sourceAmountLabel: receipt.sourceAmountLabel,
    };

    if (ticketIndex >= 0) {
      tickets[ticketIndex] = baseTicket;
      updatedCount += 1;
    } else {
      tickets.unshift(baseTicket);
      importedCount += 1;
    }
  }

  tickets.sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
  await writeLedger({ ...ledger, tickets });
  return { importedCount, updatedCount, tickets };
}

export async function markHootpotTicketEligible(input: {
  ticketId: string;
  txHash?: string;
  txHashes?: string[];
}): Promise<HootpotTicket | null> {
  const ledger = await readLedger();
  let updatedTicket: HootpotTicket | null = null;
  const now = new Date().toISOString();
  const tickets = ledger.tickets.map((ticket) => {
    if (ticket.ticketId !== input.ticketId) return ticket;
    updatedTicket = {
      ...ticket,
      status: "eligible",
      txHash: input.txHash?.trim() || ticket.txHash,
      txHashes: input.txHashes ?? ticket.txHashes,
      verificationError: undefined,
      paidAt: ticket.paidAt ?? now,
      updatedAt: now,
    };
    return updatedTicket;
  });

  if (!updatedTicket) return null;
  await writeLedger({ ...ledger, tickets });
  return updatedTicket;
}

export async function recordHootpotPaymentSubmission(input: {
  ticketId: string;
  txHashes: string[];
  verificationError?: string;
}): Promise<HootpotTicket | null> {
  const ledger = await readLedger();
  let updatedTicket: HootpotTicket | null = null;
  const now = new Date().toISOString();
  const tickets = ledger.tickets.map((ticket) => {
    if (ticket.ticketId !== input.ticketId) return ticket;
    updatedTicket = {
      ...ticket,
      status: ticket.status === "eligible" ? "eligible" : "payment_submitted",
      txHash: input.txHashes[0] ?? ticket.txHash,
      txHashes: input.txHashes,
      verificationError: input.verificationError,
      updatedAt: now,
    };
    return updatedTicket;
  });

  if (!updatedTicket) return null;
  await writeLedger({ ...ledger, tickets });
  return updatedTicket;
}

export async function drawHootpotRound(input: {
  seed?: string;
} = {}): Promise<HootpotDraw> {
  const ledger = await readLedger();
  if (ledger.draw?.roundId === ROUND_ID) {
    return ledger.draw;
  }

  const eligibleTickets = ledger.tickets.filter(
    (ticket) => ticket.roundId === ROUND_ID && ticket.status === "eligible",
  );
  if (eligibleTickets.length === 0) {
    throw new Error("no_eligible_tickets");
  }

  const seed =
    input.seed?.trim() ||
    `0x${randomBytes(32).toString("hex")}`;
  const winner = selectWinner(eligibleTickets, seed);
  if (!winner?.participantAddress) {
    throw new Error("winner_missing_address");
  }

  const draw: HootpotDraw = {
    roundId: ROUND_ID,
    seed,
    winnerTicketId: winner.ticketId,
    winnerAddress: winner.participantAddress,
    payoutAmount: winner.cashbackAmount,
    drawnAt: new Date().toISOString(),
  };

  await writeLedger({ ...ledger, draw });
  return draw;
}

export async function recordHootpotPayout(input: {
  payoutTxHash: string;
}): Promise<HootpotDraw> {
  const ledger = await readLedger();
  const draw = ledger.draw?.roundId === ROUND_ID ? ledger.draw : null;
  if (!draw) {
    throw new Error("round_not_drawn");
  }

  const now = new Date().toISOString();
  const updatedDraw: HootpotDraw = {
    ...draw,
    payoutTxHash: input.payoutTxHash,
    payoutRecordedAt: now,
  };
  const tickets = ledger.tickets.map((ticket) =>
    ticket.ticketId === draw.winnerTicketId
      ? { ...ticket, status: "reimbursed" as const, updatedAt: now }
      : ticket,
  );

  await writeLedger({ ...ledger, draw: updatedDraw, tickets });
  return updatedDraw;
}

export async function clearHootpotTickets(): Promise<void> {
  const ledger = await readLedger();
  await writeLedger({ ...ledger, tickets: [], draw: null });
}
