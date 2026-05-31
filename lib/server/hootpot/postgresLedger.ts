import { neon } from "@neondatabase/serverless";

import type { HootpotDraw, HootpotLedger, HootpotTicket } from "@/lib/server/hootpot/store";

const CONNECTION_ENV_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "NEON_DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
] as const;

type SqlClient = ReturnType<typeof neon>;

type TicketRow = {
  ticket_id: string;
  intent_id: string;
  round_id: string;
  merchant_id: string;
  merchant_name: string;
  merchant_address: string;
  participant_address: string | null;
  amount: string;
  cashback_amount: string;
  status: HootpotTicket["status"];
  transfer_data_payload: string;
  transfer_data: string;
  payment_url: string;
  created_at: string | Date;
  updated_at: string | Date;
  paid_at: string | Date | null;
  tx_hash: string | null;
  tx_hashes: unknown;
  verification_error: string | null;
  source: HootpotTicket["source"] | null;
  external_receipt_id: string | null;
  external_transaction_id: string | null;
  source_payload_hash: string | null;
  external_status: string | null;
  external_merchant_city: string | null;
  external_merchant_country: string | null;
  external_merchant_mcc: string | null;
  payment_amount: string | null;
  payment_currency: string | null;
  source_amount_label: string | null;
};

type DrawRow = {
  round_id: string;
  seed: string;
  winner_ticket_id: string;
  winner_address: string;
  payout_amount: string;
  drawn_at: string | Date;
  payout_tx_hash: string | null;
  payout_recorded_at: string | Date | null;
};

let schemaReady = false;

export function postgresConnectionString(): string | null {
  for (const key of CONNECTION_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

function sqlClient(): SqlClient | null {
  const connectionString = postgresConnectionString();
  if (!connectionString) return null;
  return neon(connectionString);
}

function toIsoString(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function optionalString(value: string | null | undefined): string | undefined {
  return value ?? undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.filter((entry): entry is string => typeof entry === "string");
  return values.length > 0 ? values : undefined;
}

function toTicket(row: TicketRow): HootpotTicket {
  return {
    ticketId: row.ticket_id,
    intentId: row.intent_id,
    roundId: row.round_id,
    merchantId: row.merchant_id,
    merchantName: row.merchant_name,
    merchantAddress: row.merchant_address,
    participantAddress: row.participant_address,
    amount: row.amount,
    cashbackAmount: row.cashback_amount,
    status: row.status,
    transferDataPayload: row.transfer_data_payload,
    transferData: row.transfer_data,
    paymentUrl: row.payment_url,
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updated_at) ?? new Date().toISOString(),
    paidAt: toIsoString(row.paid_at),
    txHash: optionalString(row.tx_hash),
    txHashes: stringArray(row.tx_hashes),
    verificationError: optionalString(row.verification_error),
    source: row.source ?? undefined,
    externalReceiptId: optionalString(row.external_receipt_id),
    externalTransactionId: optionalString(row.external_transaction_id),
    sourcePayloadHash: optionalString(row.source_payload_hash),
    externalStatus: optionalString(row.external_status),
    externalMerchantCity: optionalString(row.external_merchant_city),
    externalMerchantCountry: optionalString(row.external_merchant_country),
    externalMerchantMcc: optionalString(row.external_merchant_mcc),
    paymentAmount: optionalString(row.payment_amount),
    paymentCurrency: optionalString(row.payment_currency),
    sourceAmountLabel: optionalString(row.source_amount_label),
  };
}

function toDraw(row: DrawRow): HootpotDraw {
  return {
    roundId: row.round_id,
    seed: row.seed,
    winnerTicketId: row.winner_ticket_id,
    winnerAddress: row.winner_address,
    payoutAmount: row.payout_amount,
    drawnAt: toIsoString(row.drawn_at) ?? new Date().toISOString(),
    payoutTxHash: optionalString(row.payout_tx_hash),
    payoutRecordedAt: toIsoString(row.payout_recorded_at),
  };
}

async function ensureSchema(sql: SqlClient) {
  if (schemaReady) return;
  await sql.transaction([
    sql`
      CREATE TABLE IF NOT EXISTS hootpot_tickets (
        ticket_id text PRIMARY KEY,
        intent_id text NOT NULL,
        round_id text NOT NULL,
        merchant_id text NOT NULL,
        merchant_name text NOT NULL,
        merchant_address text NOT NULL,
        participant_address text,
        amount text NOT NULL,
        cashback_amount text NOT NULL,
        status text NOT NULL,
        transfer_data_payload text NOT NULL,
        transfer_data text NOT NULL,
        payment_url text NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        paid_at timestamptz,
        tx_hash text,
        tx_hashes jsonb,
        verification_error text,
        source text,
        external_receipt_id text,
        external_transaction_id text,
        source_payload_hash text,
        external_status text,
        external_merchant_city text,
        external_merchant_country text,
        external_merchant_mcc text,
        payment_amount text,
        payment_currency text,
        source_amount_label text
      )
    `,
    sql`
      CREATE UNIQUE INDEX IF NOT EXISTS hootpot_tickets_source_receipt_uidx
      ON hootpot_tickets (source, external_receipt_id)
      WHERE source IS NOT NULL AND external_receipt_id IS NOT NULL
    `,
    sql`
      CREATE INDEX IF NOT EXISTS hootpot_tickets_round_status_idx
      ON hootpot_tickets (round_id, status)
    `,
    sql`
      CREATE TABLE IF NOT EXISTS hootpot_draws (
        round_id text PRIMARY KEY,
        seed text NOT NULL,
        winner_ticket_id text NOT NULL,
        winner_address text NOT NULL,
        payout_amount text NOT NULL,
        drawn_at timestamptz NOT NULL,
        payout_tx_hash text,
        payout_recorded_at timestamptz
      )
    `,
  ]);
  schemaReady = true;
}

export async function readPostgresLedger(maxTickets: number): Promise<HootpotLedger | null> {
  const sql = sqlClient();
  if (!sql) return null;
  await ensureSchema(sql);

  const [ticketRows, drawRows] = (await Promise.all([
    sql`
      SELECT *
      FROM hootpot_tickets
      ORDER BY created_at DESC
      LIMIT ${maxTickets}
    `,
    sql`
      SELECT *
      FROM hootpot_draws
      ORDER BY drawn_at DESC
      LIMIT 1
    `,
  ])) as unknown as [TicketRow[], DrawRow[]];

  return {
    tickets: ticketRows.map(toTicket),
    draw: drawRows[0] ? toDraw(drawRows[0]) : null,
  };
}

export async function writePostgresLedger(ledger: HootpotLedger): Promise<boolean> {
  const sql = sqlClient();
  if (!sql) return false;
  await ensureSchema(sql);

  const ticketIds = ledger.tickets.map((ticket) => ticket.ticketId);
  const queries = [
    sql.query("DELETE FROM hootpot_tickets WHERE NOT (ticket_id = ANY($1::text[]))", [
      ticketIds,
    ]),
    ...ledger.tickets.map((ticket) =>
      sql.query(
        `
          INSERT INTO hootpot_tickets (
            ticket_id, intent_id, round_id, merchant_id, merchant_name,
            merchant_address, participant_address, amount, cashback_amount,
            status, transfer_data_payload, transfer_data, payment_url,
            created_at, updated_at, paid_at, tx_hash, tx_hashes,
            verification_error, source, external_receipt_id,
            external_transaction_id, source_payload_hash, external_status,
            external_merchant_city, external_merchant_country,
            external_merchant_mcc, payment_amount, payment_currency,
            source_amount_label
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12, $13,
            $14::timestamptz, $15::timestamptz, $16::timestamptz, $17, $18::jsonb,
            $19, $20, $21,
            $22, $23, $24,
            $25, $26,
            $27, $28, $29,
            $30
          )
          ON CONFLICT (ticket_id) DO UPDATE SET
            intent_id = EXCLUDED.intent_id,
            round_id = EXCLUDED.round_id,
            merchant_id = EXCLUDED.merchant_id,
            merchant_name = EXCLUDED.merchant_name,
            merchant_address = EXCLUDED.merchant_address,
            participant_address = EXCLUDED.participant_address,
            amount = EXCLUDED.amount,
            cashback_amount = EXCLUDED.cashback_amount,
            status = EXCLUDED.status,
            transfer_data_payload = EXCLUDED.transfer_data_payload,
            transfer_data = EXCLUDED.transfer_data,
            payment_url = EXCLUDED.payment_url,
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at,
            paid_at = EXCLUDED.paid_at,
            tx_hash = EXCLUDED.tx_hash,
            tx_hashes = EXCLUDED.tx_hashes,
            verification_error = EXCLUDED.verification_error,
            source = EXCLUDED.source,
            external_receipt_id = EXCLUDED.external_receipt_id,
            external_transaction_id = EXCLUDED.external_transaction_id,
            source_payload_hash = EXCLUDED.source_payload_hash,
            external_status = EXCLUDED.external_status,
            external_merchant_city = EXCLUDED.external_merchant_city,
            external_merchant_country = EXCLUDED.external_merchant_country,
            external_merchant_mcc = EXCLUDED.external_merchant_mcc,
            payment_amount = EXCLUDED.payment_amount,
            payment_currency = EXCLUDED.payment_currency,
            source_amount_label = EXCLUDED.source_amount_label
        `,
        [
          ticket.ticketId,
          ticket.intentId,
          ticket.roundId,
          ticket.merchantId,
          ticket.merchantName,
          ticket.merchantAddress,
          ticket.participantAddress,
          ticket.amount,
          ticket.cashbackAmount,
          ticket.status,
          ticket.transferDataPayload,
          ticket.transferData,
          ticket.paymentUrl,
          ticket.createdAt,
          ticket.updatedAt,
          ticket.paidAt ?? null,
          ticket.txHash ?? null,
          JSON.stringify(ticket.txHashes ?? null),
          ticket.verificationError ?? null,
          ticket.source ?? null,
          ticket.externalReceiptId ?? null,
          ticket.externalTransactionId ?? null,
          ticket.sourcePayloadHash ?? null,
          ticket.externalStatus ?? null,
          ticket.externalMerchantCity ?? null,
          ticket.externalMerchantCountry ?? null,
          ticket.externalMerchantMcc ?? null,
          ticket.paymentAmount ?? null,
          ticket.paymentCurrency ?? null,
          ticket.sourceAmountLabel ?? null,
        ],
      ),
    ),
  ];

  if (ledger.draw) {
    queries.push(
      sql.query("DELETE FROM hootpot_draws WHERE round_id <> $1", [ledger.draw.roundId]),
      sql.query(
        `
          INSERT INTO hootpot_draws (
            round_id, seed, winner_ticket_id, winner_address, payout_amount,
            drawn_at, payout_tx_hash, payout_recorded_at
          )
          VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8::timestamptz)
          ON CONFLICT (round_id) DO UPDATE SET
            seed = EXCLUDED.seed,
            winner_ticket_id = EXCLUDED.winner_ticket_id,
            winner_address = EXCLUDED.winner_address,
            payout_amount = EXCLUDED.payout_amount,
            drawn_at = EXCLUDED.drawn_at,
            payout_tx_hash = EXCLUDED.payout_tx_hash,
            payout_recorded_at = EXCLUDED.payout_recorded_at
        `,
        [
          ledger.draw.roundId,
          ledger.draw.seed,
          ledger.draw.winnerTicketId,
          ledger.draw.winnerAddress,
          ledger.draw.payoutAmount,
          ledger.draw.drawnAt,
          ledger.draw.payoutTxHash ?? null,
          ledger.draw.payoutRecordedAt ?? null,
        ],
      ),
    );
  } else {
    queries.push(sql`DELETE FROM hootpot_draws`);
  }

  await sql.transaction(queries);
  return true;
}
