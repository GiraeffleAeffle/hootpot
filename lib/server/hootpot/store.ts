import { createHash, randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  AFFILIATE_DRIP_CRC,
  cashbackForAmount,
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

const STORE_FILE = "hootpot-ledger.json";
const MAX_TICKETS = 500;

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

async function readLedger(): Promise<HootpotLedger> {
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

function hashText(value: string): bigint {
  return BigInt(`0x${createHash("sha256").update(value).digest("hex")}`);
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
  };

  await writeLedger({ ...ledger, tickets: [ticket, ...ledger.tickets] });
  return ticket;
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
