# Hootpot

Hootpot is a Circles miniapp for community-funded receipt cashback.

The first version connects three Circles-native loops:

- HOOT support group: users can open the Hootpot group in Circles Core and set affiliate support.
- Merchant receipts: a CRC checkout intent creates a receipt ticket for weekly cashback.
- Pot top-ups: sponsors or merchants can add CRC to the operational pot wallet.

The merchant payment goes to the merchant. Hootpot uses the verified receipt as eligibility, while cashback is funded only by the current CRC balance of the configured Hootpot Safe. Affiliate support and direct pot funding are intentionally separate: a pot top-up still needs a valid Circles transfer path to the Safe.

## Current Scope

- Embedded Circles miniapp shell from `aboutcircles/embedded-miniapp-boilerplate`
- Host-injected wallet status through `@aboutcircles/miniapp-sdk`
- Connected Circles account/profile/balance lookup through `@aboutcircles/sdk`
- Merchant checkout intent builder with real Circles pathfinding transactions
- Host wallet submission through `sendTransactions`
- On-chain transaction hash verification for Hootpot receipt references
- Preconfigured merchant payout addresses, no shopper address entry
- Admin-protected operator draw and payout-recording flow
- Merchant registry, prize pool, and receipt/draw registry contracts
- Gnosis Pay SIWE sync and signed webhook ingestion as external receipt sources
- Durable ledger support through Vercel KV / Upstash Redis REST, with local file fallback
- Pot Safe balance lookup and in-app top-up transaction builder
- Weekly cashback preview with deterministic ticket selection

## Run

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

Standalone browser mode shows a preview wallet state. End-to-end wallet injection is tested in the Circles playground after deploying to HTTPS:

```text
https://circles.gnosis.io/playground?url=<your-deploy-url>
```

Inside the playground there is no separate Hootpot sign-up step. The Circles host injects the currently selected Gnosis/Circles Safe address. Hootpot listens to that wallet, stores it on new receipt tickets, and looks up the account's Circles profile and CRC balance.

## Configuration

Copy `.env.example` to `.env.local` and fill real recipients before using payment links:

```bash
NEXT_PUBLIC_HOOTPOT_GROUP_URL=
NEXT_PUBLIC_HOOTPOT_GROUP_ADDRESS=
NEXT_PUBLIC_HOOTPOT_GROUP_METRICS_URL=
NEXT_PUBLIC_HOOTPOT_POT_ADDRESS=
NEXT_PUBLIC_HOOTPOT_REGISTRY_ADDRESS=
NEXT_PUBLIC_HOOTPOT_POOL_ADDRESS=
NEXT_PUBLIC_HOOTPOT_MERCHANT_REGISTRY_ADDRESS=
NEXT_PUBLIC_HOOTPOT_MERCHANT_ONE=
NEXT_PUBLIC_HOOTPOT_MERCHANT_TWO=
NEXT_PUBLIC_HOOTPOT_MERCHANT_THREE=
GNOSIS_RPC_URL=
GNOSIS_PAY_API_BASE_URL=
GNOSIS_PAY_WEBHOOK_PUBLIC_KEY=
GNOSIS_PAY_WEBHOOK_PUBLIC_KEY_URL=
HOOTPOT_ADMIN_SECRET=
DATABASE_URL=
# or any Vercel/Neon Postgres URL:
POSTGRES_URL=
POSTGRES_PRISMA_URL=
NEON_DATABASE_URL=
KV_REST_API_URL=
KV_REST_API_TOKEN=
# or, if injected by the Upstash integration:
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
HOOTPOT_LEDGER_KEY=
```

Without configured addresses, payment and top-up links stay guarded in the UI.

Merchant payout addresses should be preconfigured before the app is shown. A shopper should only choose a merchant, pay, and see the receipt enter the Hootpot round.

## Deploying for Playground Tests

Vercel is enough for playground testing because the app is a standard Next.js app and the CSP already allows Gnosis/Circles iframe hosts plus Vercel previews. After deployment, open:

```text
https://circles.gnosis.io/playground?url=https://<your-vercel-domain>
```

Current hosted test deployment:

```text
https://hootpot.vercel.app
https://circles.gnosis.io/playground?url=https://hootpot.vercel.app
```

Ledger storage uses Neon/Postgres when `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, or `NEON_DATABASE_URL` is configured. If no Postgres URL exists, it falls back to Vercel KV / Upstash Redis REST via `KV_REST_API_URL` / `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`. Without those env vars it falls back to `.data/` locally and `/tmp/hootpot` on Vercel, which is only suitable for local development.

## Cashback Model

The first shippable model is deliberately simple:

1. Customer pays a participating merchant in CRC.
2. Hootpot builds a Circles advanced transfer with the receipt reference in transfer data.
3. The Circles host asks the connected Safe to submit the transaction.
4. Hootpot stores the returned tx hash and verifies the receipt reference on Gnosis Chain.
5. The receipt becomes eligible after verification.
6. The eligible receipt can be registered in the Hootpot receipt registry contract.
7. One eligible receipt can be reimbursed from the Hootpot pot.
8. The reimbursement is paid separately from the Hootpot org/Safe.
9. The payout transaction hash can be recorded on the registry.

This avoids split payments in the checkout path: the merchant gets paid immediately, and Hootpot only handles the later cashback.

## Gnosis Pay Receipt Ingestion

Hootpot supports two real Gnosis Pay receipt paths.

User-initiated SIWE sync:

1. The app requests a nonce from `GET /api/v1/auth/nonce`.
2. The Circles host wallet signs a standard SIWE message through `signMessage`.
3. The server exchanges the signed SIWE message at `POST /api/v1/auth/challenge`.
4. The server checks that the connected wallet matches the Gnosis Pay Safe, Safe owner, or authenticated wallet returned by the Gnosis Pay account APIs.
5. Hootpot fetches `/api/v1/cards/transactions`, keeps eligible `Payment` events, and stores them as `gnosis_pay` receipt tickets.

Partner webhook ingestion:

1. Gnosis Pay posts `card.transaction.*` events to `/api/hootpot/gnosis-pay/webhook`.
2. Hootpot verifies `X-Webhook-Timestamp` and `X-Webhook-Signature` with the Ed25519 public key from Gnosis Pay.
3. Hootpot maps the webhook's Safe/sign-in wallet and card transaction event into the same receipt ledger.
4. Duplicate webhook deliveries are idempotent because tickets are keyed by source and external receipt id.

The production webhook URL is:

```text
https://hootpot.vercel.app/api/hootpot/gnosis-pay/webhook
```

Relevant Gnosis Pay surfaces:

- `GET /api/v1/auth/nonce` and `POST /api/v1/auth/challenge` for SIWE sessions.
- `GET /api/v1/cards/transactions` for card transaction history and merchant metadata.
- `GET /api/v1/safe-config`, `GET /api/v1/user`, `GET /api/v1/eoa-accounts`, and `GET /api/v1/owners` for account/address checks.
- `card.transaction.created`, `card.transaction.cleared`, and `card.transaction.confirmed` webhooks for partner ingestion.

## Operating Flow

The end-to-end live loop is:

1. Open Hootpot in the Circles playground.
2. Pick a preconfigured merchant.
3. Create a small CRC receipt.
4. Pay the merchant through the host wallet.
5. Let Hootpot verify the Gnosis Chain transaction hash.
6. Fund the Hootpot pot from the preconfigured pot card.
7. Draw the winner in the Cashback panel.
8. Pay the winner back from the Hootpot Safe or pool.
9. Record the payout tx hash to mark the receipt as paid back.

This proves the core mechanism with real Circles transactions. The Gnosis Pay sync button can additionally ingest real card transaction metadata through SIWE without exposing access tokens to the browser.

## Contract Direction

The current contract surface is split into three small pieces:

- `contracts/HootpotMerchantRegistry.sol` stores allowed merchant payout addresses.
- `contracts/HootpotPrizePool.sol` can be funded and can send non-CRC prize payouts.
- `contracts/HootpotReceiptRegistry.sol` records verified receipts, closes a round against a future Gnosis block, draws the winner from that block hash, and records payout proof.

The contracts deliberately do not route the customer checkout payment. The merchant still gets paid directly by the Circles transfer path.

CRC pot funding should point at `NEXT_PUBLIC_HOOTPOT_POT_ADDRESS`, ideally a Hootpot org/Safe/avatar that can receive Circles transfers. `HootpotPrizePool` is useful for native/ERC20 prize funding and payout proofs.

Run contract checks:

```bash
forge test
```

Deploy the contract set after choosing an owner address:

```bash
HOOTPOT_OWNER=0xYourOwnerAddress \
forge script script/DeployHootpot.s.sol:DeployHootpot \
  --rpc-url "$GNOSIS_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --verify
```

Use a real owner address, ideally a Safe. Do not set `HOOTPOT_OWNER` to
`0x0000000000000000000000000000000000000000`: the contracts reject a zero owner
because merchant setup, receipt registration, round closing, and prize payouts all
need an operator in the current deployment.

After deployment, set these public app env vars and redeploy:

```bash
NEXT_PUBLIC_HOOTPOT_MERCHANT_REGISTRY_ADDRESS=0x0FdAAb2F122493c08260042d6109E38AF101C189
NEXT_PUBLIC_HOOTPOT_REGISTRY_ADDRESS=0xDf977829358499a735D9e05C4A32b1C1C5e64Ae8
NEXT_PUBLIC_HOOTPOT_POOL_ADDRESS=0x0e0cd3B2f2e48B31c813a64814E35215634c5290
```

Deployed on Gnosis Chain at block `46439728`:

- Merchant registry: `0x0FdAAb2F122493c08260042d6109E38AF101C189`
- Receipt registry: `0xDf977829358499a735D9e05C4A32b1C1C5e64Ae8`
- Prize pool: `0x0e0cd3B2f2e48B31c813a64814E35215634c5290`
- Owner: `0x98f44DA4653D92F44f2b7cd328f37D2c199E077A`

Winner selection:

```text
The current receipt registry does not use Chainlink VRF. HootpotReceiptRegistry closes a round against a future Gnosis block and derives the winner from that block hash. That is transparent and prevents the owner from choosing the seed, but it is not oracle-grade randomness. For production, replace this with Chainlink VRF where supported or a stricter commit/reveal/randomness flow.
```

The safe operating flow is:

1. Payer pays a configured merchant through the Circles host.
2. Backend verifies the receipt reference on Gnosis Chain.
3. Backend or operator registers that receipt on the registry contract.
4. Registry closes the round against a future Gnosis block and derives the winner from that block hash.
5. Hootpot Safe sends the cashback and records the payout tx hash.

Gnosis Pay card transactions are supported as another receipt source through SIWE sync and the signed webhook endpoint. Raw card settlement transactions alone are not enough for a clean merchant-level Hootpot receipt, so Hootpot relies on official Gnosis Pay transaction metadata.

## Current Limitations

Hootpot is not a live merchant product until real merchant and payout infrastructure exists. The deployed app and contracts now have production-shaped ingestion and operator security boundaries, but the external network still has to be configured.

Missing pieces:

- Real Circles merchant onboarding or an official merchant directory / payout address registry.
- A Hootpot Circles group/org/Safe that can receive and distribute CRC.
- A configured durable store, preferably Neon/Postgres via `DATABASE_URL` or `POSTGRES_URL`.
- A continuous Circles event watcher instead of only verifying submitted tx hashes.
- Production randomness, such as Chainlink VRF where supported or a stricter commit/reveal flow.
- Gnosis Pay partner domain/webhook registration for continuous card receipt ingestion.

Raw card settlement transactions alone are still not enough for clean merchant-level receipt context. Hootpot uses official card transaction metadata from SIWE-authenticated API calls or signed partner webhooks.

See `docs/hootpot-contract-plan.md` for the safety model and upgrade path.
See `docs/production-setup.md` for the Vercel, durable storage, and Gnosis Pay
partner setup steps.

## Next Production Slice

- Configure a real merchant recipient and Hootpot pot address for a complete live Circles checkout flow.
- Configure Neon/Postgres in Vercel so `DATABASE_URL` or `POSTGRES_URL` is available to production.
- Watch `CrcV2_TransferData` events continuously instead of only verifying submitted hashes.
- Verify receipt amount from decoded event logs, not just the transfer reference.
- Freeze ticket lists per round and publish draw proof.
- Pay cashback recipients from the Hootpot org/Safe.
- Register `hootpot.vercel.app` and the webhook endpoint with Gnosis Pay partner settings.
