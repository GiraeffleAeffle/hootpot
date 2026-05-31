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
Hootpot turns CRC merchant payments and Gnosis Pay card receipts into eligible receipts for a community-funded cashback pot. Users can support the HOOT Circles group, where starring the group routes 2 CRC/day into the Hootpot community loop; verified receipts can then be paid back by the pot.
```

## 02 Contracts

Contract status:

```text
Prototype contracts deployed on Gnosis Chain.
```

Contracts:

```text
HootpotMerchantRegistry.sol - stores allowed merchant payout addresses for hackathon merchants.
HootpotReceiptRegistry.sol - records verified receipts, closes a round against a future Gnosis block, derives the winner from that block hash, and records payout proof.
HootpotPrizePool.sol - fundable pool for native/ERC20 prizes and payout events; CRC pot funding still points to a Circles-capable Hootpot org/Safe/avatar.
```

Notes:

```text
There does not appear to be an official Circles merchant registry today. Hootpot therefore ships a small project-owned merchant registry pattern for the hackathon. Merchant addresses are preconfigured before checkout; shoppers never paste recipient addresses.
```

Deployed contract addresses:

```text
HootpotMerchantRegistry: 0x0FdAAb2F122493c08260042d6109E38AF101C189
HootpotReceiptRegistry: 0xDf977829358499a735D9e05C4A32b1C1C5e64Ae8
HootpotPrizePool: 0x0e0cd3B2f2e48B31c813a64814E35215634c5290

Deployment block: 46439728 on Gnosis Chain
Owner: 0x98f44DA4653D92F44f2b7cd328f37D2c199E077A

GnosisScan:
https://gnosisscan.io/address/0x0FdAAb2F122493c08260042d6109E38AF101C189
https://gnosisscan.io/address/0xDf977829358499a735D9e05C4A32b1C1C5e64Ae8
https://gnosisscan.io/address/0x0e0cd3B2f2e48B31c813a64814E35215634c5290

Tests:
forge test

Deploy script:
script/DeployHootpot.s.sol

Randomness note:
The current demo contract does not use Chainlink VRF. It closes a round against a future Gnosis block and derives the winner from that block hash. This prevents the operator from choosing the winning seed, but it is still demo-grade randomness. Production should use Chainlink VRF where supported or a stricter commit/reveal/randomness flow.
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

Repo:

```text
https://github.com/GiraeffleAeffle/hootpot
```

Notes:

```text
Open the live link directly or through the Circles playground. Current public build shows the Hootpot group link, contract architecture, Neon-backed receipt ledger, SIWE-based Gnosis Pay receipt sync, and a signed webhook endpoint for partner ingestion. Circles merchant checkout is guarded until a real merchant recipient and Hootpot pot address are configured. For judging, use a second Circles/Gnosis account as the merchant recipient, because the Circles checkout docs recommend a separate test recipient and sending to yourself is blocked.
```

Demo limitation:

```text
The live deployment is ready, but merchant checkout remains guarded until at least one real Circles recipient is configured as NEXT_PUBLIC_HOOTPOT_MERCHANT_ONE and one Hootpot pot/org/Safe address is configured as NEXT_PUBLIC_HOOTPOT_POT_ADDRESS. Gnosis Pay receipt sync also needs hootpot.vercel.app to be enabled for SIWE in the Gnosis Pay partner setup.
```

Hootpot group:

```text
HOOT Circles group: 0xa31676f40EED5eA91664AB0ac188c48F6CCb54c0
Group metrics: https://app.aboutcircles.com/groups/metrics/0xa31676f40eed5ea91664ab0ac188c48f6ccb54c0
Group members/support route: https://app.aboutcircles.com/groups/members/0xa31676f40eed5ea91664ab0ac188c48f6ccb54c0
Owner Safe: 0x7c1eF6b21C030a6eC6c765fCE9b4F6599B4Aafb5
```

Limitations / what is missing:

```text
Hootpot is not yet usable by ordinary people as a live merchant product. The app now has production-shaped receipt ingestion and admin-protected operator routes, but it still needs real merchant onboarding and external platform configuration:

- a real Circles merchant or shop directory, or an official way to discover approved merchant payout addresses
- configured merchant recipients and a Hootpot pot/org/Safe address for live CRC payouts
- an on-chain/event watcher for Circles transfer data instead of only submitted tx hashes
- production randomness, ideally Chainlink VRF where supported or a stronger commit/reveal flow
- Gnosis Pay partner domain/webhook registration for continuous card receipt ingestion

Hootpot can sync real card transaction metadata through Gnosis Pay SIWE and can ingest signed `card.transaction.*` webhooks once the endpoint is configured in the Gnosis Pay partner settings.
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
The same receipt model ingests Gnosis Pay card receipts through SIWE-authenticated card transaction API calls and a signed partner webhook endpoint. Imported card purchases become eligible without exposing Gnosis Pay access tokens to the browser.
```

Public post:

```text
I built Hootpot for the Circles Garage hackathon: a miniapp that turns a CRC merchant payment into a receipt for a community cashback pool.

The demo has a deployed miniapp, a HOOT Circles group, Gnosis Chain contracts, a Neon-backed receipt ledger, a tested receipt/draw flow, SIWE-based Gnosis Pay receipt sync, and a signed webhook endpoint. It is still not a ready consumer product: there is no official Circles merchant registry wired in and no real merchant network. For now merchants have to be preconfigured by address.

What I would need to make this useful in the real world:
- official merchant metadata / payout address discovery for Circles shops
- Gnosis Pay SIWE domain allowlisting and webhook activation for card transaction and merchant receipt data
- a pot/org/Safe payout setup wired to the HOOT group
- an event watcher for verified receipt indexing
- production-grade randomness for bigger payouts

Live app: https://hootpot.vercel.app
Repo: https://github.com/GiraeffleAeffle/hootpot
HOOT group: https://app.aboutcircles.com/groups/metrics/0xa31676f40eed5ea91664ab0ac188c48f6ccb54c0
Contracts are deployed on Gnosis Chain.
```
