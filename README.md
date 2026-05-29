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

This proves the core mechanism with real Circles transactions. Gnosis Pay remains the extension path once an official receipt API or webhook is available.

## Hackathon Contract Direction

The proposed hackathon contract surface is split into three small pieces:

- `contracts/HootpotMerchantRegistry.sol` stores allowed merchant payout addresses.
- `contracts/HootpotPrizePool.sol` can be funded and can send non-CRC prize payouts.
- `contracts/HootpotReceiptRegistry.sol` records verified receipts, draws a winner, and records payout proof.

The contracts deliberately do not route the customer checkout payment. The merchant still gets paid directly by the Circles transfer path.

CRC pot funding should point at `NEXT_PUBLIC_HOOTPOT_POT_ADDRESS`, ideally a Hootpot org/Safe/avatar that can receive Circles transfers. `HootpotPrizePool` is useful for native/ERC20 prize funding and payout proofs.

The safest demo flow is:

1. Payer pays a configured merchant through the Circles host.
2. Backend verifies the receipt reference on Gnosis Chain.
3. Backend or operator registers that receipt on the registry contract.
4. Registry draws one payer address for the round.
5. Hootpot Safe sends the cashback and records the payout tx hash.

Gnosis Pay can be added later as another receipt source through an official API or webhook. Raw card settlement transactions alone are not enough for a clean merchant-level Hootpot receipt, so the current app labels that path as a future extension.

See `docs/hootpot-contract-plan.md` for the safety model and upgrade path.

## Next Production Slice

- Replace `/tmp` prototype storage with durable storage.
- Watch `CrcV2_TransferData` events continuously instead of only verifying submitted hashes.
- Verify receipt amount from decoded event logs, not just the transfer reference.
- Freeze ticket lists per round and publish draw proof.
- Deploy the merchant registry, prize pool, and receipt registry.
- Pay cashback recipients from the Hootpot org/Safe.
