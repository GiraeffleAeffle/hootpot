# Hootpot Contract Plan

## Hackathon Goal

Use small contracts for Hootpot infrastructure. They should make the demo accountable without becoming a general Circles payment router.

The safe first version is:

1. Customer pays a configured merchant in CRC through the Circles miniapp host.
2. Hootpot verifies the payment tx hash and receipt reference.
3. Hootpot registers the eligible receipt on-chain.
4. Hootpot closes the round against a future Gnosis block and draws one winner from registered receipts after that block exists.
5. The Hootpot Safe or pool pays the cashback separately.
6. Hootpot records the payout tx hash on the registry.

## Why Registry First

Mainnet Circles are real user funds. The checkout flow should not split money, redirect value, or send arbitrary amounts to arbitrary recipients for the hackathon. The merchant payment stays simple: payer to merchant. Hootpot only adds eligibility and a later cashback step.

This avoids the riskiest parts:

- no custody of user checkout payments
- no automatic random refund during checkout
- no free-form destination chosen by the frontend
- no need to solve Circles pathfinding inside Solidity
- no dependency on unofficial merchant or card infrastructure

## Contract Surface

The hackathon contract set is intentionally narrow:

- `contracts/HootpotMerchantRegistry.sol` stores merchant payout addresses.
- `contracts/HootpotPrizePool.sol` receives funding and can send non-CRC payouts.
- `contracts/HootpotReceiptRegistry.sol` records receipt and draw proofs.

CRC funding should still target the configured Hootpot pot address, ideally an org/Safe/avatar that the Circles transfer path can pay. `HootpotPrizePool` is for native/ERC20 prizes and for recording CRC funding proofs without pretending to solve Circles pathfinding in Solidity.

`HootpotReceiptRegistry` records:

It records:

- round id
- payer address
- merchant address
- amount in atto CRC
- payment transaction hash
- receipt reference hash
- winner receipt id
- winner address
- payout token/address marker
- payout amount
- payout transaction hash

The checkout path still pays merchants directly. None of these contracts pull funds from shoppers.

## Draw Model

The hackathon draw uses a future Gnosis block hash. The owner can register verified receipts and close the round with a future `drawBlock`; after that block exists, anyone can call `drawRound`. The contract stores the block hash seed and winner so the result can be recomputed.

This is good enough for a demo but is not Chainlink VRF. A production version should use a stronger public randomness source, such as Chainlink VRF where supported, or a commit/reveal process with stricter timing rules.

## Gnosis Pay Extension

Gnosis Pay can be a future receipt source, not the first integration.

The linked card payment looked like a CoW Protocol settlement using EURe/aGnoEURe on Gnosis Chain. That transaction is useful proof that card payments settle on-chain, but the raw settlement transaction alone does not expose a clean merchant address and receipt context for Hootpot.

The likely production path is:

- import card transactions from an official Gnosis Pay API or webhook
- hash the card receipt id into `receiptRefHash`
- register the Gnosis Pay receipt as an eligible Hootpot receipt
- keep payout from the Hootpot Safe or a capped prize vault

The app now labels this as "Gnosis Pay Later" so the demo does not imply active card integration.

## Production Upgrade Options

After the hackathon, the registry can grow in one of two directions:

- Safe-led payouts: keep the current registry and pay winners from a Hootpot Safe.
- Prize vault: add a capped custody contract that only pays the drawn winner for a closed round.

Safe-led payouts are the better first production slice because they are operationally simple and easier to stop if anything looks wrong.
