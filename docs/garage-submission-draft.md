# Hootpot Garage Submission Draft

## 01 Identity

App name:

```text
Hootpot
```

Slug:

```text
hootpot
```

One-line pitch:

```text
Receipt cashback pools for Circles payments at local merchants.
```

Track:

```text
payments / social
```

Status:

```text
live prototype
```

Short description:

```text
Hootpot turns a CRC merchant payment into an eligible receipt for a community-funded cashback draw. A shopper pays a preconfigured merchant through the Circles/Gnosis app checkout flow; Hootpot verifies the Gnosis Chain transaction, records the receipt, and lets the Hootpot pool reimburse one winning receipt.
```

## 02 Contracts

Contract status:

```text
Prototype contracts included, not yet deployed.
```

Contracts:

```text
HootpotMerchantRegistry.sol - stores allowed merchant payout addresses for hackathon merchants.
HootpotReceiptRegistry.sol - records verified receipts, draw seed, winner, and payout proof.
HootpotPrizePool.sol - fundable pool for native/ERC20 prizes and payout events; CRC pot funding still points to a Circles-capable Hootpot org/Safe/avatar.
```

Notes:

```text
There does not appear to be an official Circles merchant registry today. Hootpot therefore ships a small project-owned merchant registry pattern for the hackathon. Merchant addresses are preconfigured before checkout; shoppers never paste recipient addresses.
```

## 03 Proof

Live app:

```text
https://hootpot.vercel.app
```

Circles playground:

```text
https://circles.gnosis.io/playground?url=https://hootpot.vercel.app
```

Demo limitation:

```text
The live deployment is ready, but merchant checkout remains guarded until at least one real Circles recipient is configured as NEXT_PUBLIC_HOOTPOT_MERCHANT_ONE and one Hootpot pot/org/Safe address is configured as NEXT_PUBLIC_HOOTPOT_POT_ADDRESS.
```

Demo script:

```text
1. Open Hootpot in the Circles playground.
2. Pick a preconfigured merchant.
3. Create a small CRC receipt.
4. Pay through the Circles/Gnosis host wallet.
5. Hootpot verifies the Gnosis Chain tx hash and marks the receipt eligible.
6. Fund the Hootpot pot.
7. Draw a cashback winner.
8. Pay the winner back and record the payout tx hash.
```

## 04 Review

Longer pitch:

```text
Hootpot is a local-commerce cashback layer for Circles. Instead of making merchants join a complicated lottery or yield product, the checkout remains normal: the customer pays the merchant directly in CRC. Hootpot only observes and verifies the receipt, then lets a separately funded community pool reimburse one eligible receipt. This keeps the merchant payment path simple, avoids redirecting user funds, and creates a visible reason for people to spend CRC at participating local shops.
```

Future extension:

```text
The same receipt model can later ingest Gnosis Pay card receipts through an official API or webhook. For the hackathon, Hootpot focuses on real Circles checkout receipts because raw card settlement transactions do not expose clean merchant-level receipt context.
```
