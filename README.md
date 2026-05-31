# Hootpot

Hootpot is a Circles miniapp for community-funded receipt cashback.

The first version connects three Circles-native loops:

- Affiliate flow: users can support the Hootpot group, routing 2 CRC/day from their daily Circles creation.
- Merchant receipts: a CRC checkout intent creates a receipt ticket for weekly cashback.
- Pot top-ups: sponsors or merchants can add CRC to the operational pot wallet.

The merchant payment goes to the merchant. Hootpot uses the verified receipt as eligibility, while cashback is funded separately by group flow, merchant boosts, and sponsor top-ups.

## Current Scope

- Embedded Circles miniapp shell from `aboutcircles/embedded-miniapp-boilerplate`
- Host-injected wallet status through `@aboutcircles/miniapp-sdk`
- Connected Circles account/profile/balance lookup through `@aboutcircles/sdk`
- Merchant checkout intent builder with real Circles pathfinding transactions
- Host wallet submission through `sendTransactions`
- On-chain transaction hash verification for Hootpot receipt references
- Preconfigured merchant payout addresses, no shopper address entry
- Operator draw and payout-recording flow for the live demo loop
- Merchant registry, prize pool, and receipt/draw registry contracts
- Gnosis Pay card transaction import as an external receipt source
- Server-backed receipt/ticket ledger in `.data/hootpot-ledger.json`
- Pot top-up transfer link
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
NEXT_PUBLIC_HOOTPOT_POT_ADDRESS=
NEXT_PUBLIC_HOOTPOT_REGISTRY_ADDRESS=
NEXT_PUBLIC_HOOTPOT_POOL_ADDRESS=
NEXT_PUBLIC_HOOTPOT_MERCHANT_REGISTRY_ADDRESS=
NEXT_PUBLIC_HOOTPOT_MERCHANT_ONE=
NEXT_PUBLIC_HOOTPOT_MERCHANT_TWO=
NEXT_PUBLIC_HOOTPOT_MERCHANT_THREE=
GNOSIS_RPC_URL=
GNOSIS_PAY_API_BASE_URL=
```

Without configured addresses, payment and top-up links stay guarded in the UI.

For the hackathon demo, merchant payout addresses should be preconfigured before the app is shown. A shopper should only choose a merchant, pay, and see the receipt enter the Hootpot round.

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

Latest real-checkout preview:

```text
https://hootpot-pt95md22l-giraeffleaeffles-projects.vercel.app
https://circles.gnosis.io/playground?url=https://hootpot-pt95md22l-giraeffleaeffles-projects.vercel.app
```

The current ledger is prototype storage. Locally it writes to `.data/`; on Vercel it writes to `/tmp/hootpot` so serverless functions can run, but that storage is not durable. For a real public round, replace the ledger with a durable store such as Vercel KV/Postgres or an on-chain watcher-backed API.

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

## Gnosis Pay Receipt Import

Hootpot can also import recent card receipts from the Gnosis Pay API:

1. The connected wallet provides a short-lived Gnosis Pay JWT for the preview import.
2. The server checks that the connected miniapp wallet matches the Gnosis Pay Safe, Safe owner, or authenticated wallet returned by the Gnosis Pay account APIs.
3. Hootpot fetches `/api/v1/cards/transactions`, keeps eligible `Payment` events, and stores them as `gnosis_pay` receipt tickets.
4. Imported receipts enter the same cashback draw as Circles checkout receipts.

This is useful for hackathon testing because it uses real Gnosis Pay card transaction metadata. It is not the desired consumer UX. A production integration should replace the pasted JWT with SIWE inside the miniapp or partner webhooks with Ed25519 signature verification.

Relevant Gnosis Pay surfaces:

- `GET /api/v1/cards/transactions` for card transaction history and merchant metadata.
- `GET /api/v1/safe-config`, `GET /api/v1/user`, `GET /api/v1/eoa-accounts`, and `GET /api/v1/owners` for account/address checks.
- Webhooks for production partner ingestion of `card.transaction.*` events.

## Live Demo Script

The useful hackathon demo is the small real loop:

1. Open Hootpot in the Circles playground.
2. Pick a preconfigured merchant.
3. Create a small CRC receipt.
4. Pay the merchant through the host wallet.
5. Let Hootpot verify the Gnosis Chain transaction hash.
6. Fund the Hootpot pot from the preconfigured pot card.
7. Draw the winner in the Cashback panel.
8. Pay the winner back from the Hootpot Safe or pool.
9. Record the payout tx hash to mark the receipt as paid back.

This proves the core mechanism with real Circles transactions. The Gnosis Pay import panel can additionally ingest real card transaction metadata for accounts that can provide a short-lived API JWT.

## Hackathon Contract Direction

The proposed hackathon contract surface is split into three small pieces:

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
need an operator for the prototype.

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
The current demo contract does not use Chainlink VRF. HootpotReceiptRegistry closes a round against a future Gnosis block and derives the winner from that block hash. That is transparent and prevents the owner from choosing the seed, but it is not oracle-grade randomness. For production, replace this with Chainlink VRF where supported or a stricter commit/reveal/randomness flow.
```

The safest demo flow is:

1. Payer pays a configured merchant through the Circles host.
2. Backend verifies the receipt reference on Gnosis Chain.
3. Backend or operator registers that receipt on the registry contract.
4. Registry closes the round against a future Gnosis block and derives the winner from that block hash.
5. Hootpot Safe sends the cashback and records the payout tx hash.

Gnosis Pay can be added later as another receipt source through an official API or webhook. Raw card settlement transactions alone are not enough for a clean merchant-level Hootpot receipt, so the current app labels that path as a future extension.

## Current Limitations

Hootpot is a hackathon prototype, not a live merchant product yet. The deployed app and contracts prove the receipt/cashback mechanism, but ordinary users cannot use it meaningfully until real merchant and payout infrastructure exists.

Missing pieces:

- Real Circles merchant onboarding or an official merchant directory / payout address registry.
- A Hootpot Circles group/org/Safe that can receive and distribute CRC.
- Durable storage instead of the current prototype serverless ledger.
- A continuous Circles event watcher instead of only verifying submitted tx hashes.
- Production randomness, such as Chainlink VRF where supported or a stricter commit/reveal flow.
- A production Gnosis Pay integration if card transactions should become eligible receipts without a preview JWT import.

The Gnosis Pay path now has a prototype API importer. Raw card settlement transactions alone are still not enough for clean merchant-level receipt context, so the useful product path is official card transaction metadata, SIWE auth, or partner webhooks.

See `docs/hootpot-contract-plan.md` for the safety model and upgrade path.

## Next Production Slice

- Configure a real merchant recipient and Hootpot pot address for a complete live Circles checkout demo.
- Replace `/tmp` prototype storage with durable storage.
- Watch `CrcV2_TransferData` events continuously instead of only verifying submitted hashes.
- Verify receipt amount from decoded event logs, not just the transfer reference.
- Freeze ticket lists per round and publish draw proof.
- Pay cashback recipients from the Hootpot org/Safe.
- Replace the Gnosis Pay JWT preview with SIWE or verified partner webhooks.
