#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appUrl = process.env.HOOTPOT_APP_URL ?? "https://hootpot.vercel.app";
const safe = process.env.HOOTPOT_SAFE;
const amount = process.env.HOOTPOT_REDEEM_AMOUNT ?? "0.999999";
const rpcUrl = process.env.GNOSIS_RPC_URL ?? "https://rpc.gnosischain.com";
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ATTO_PER_CRC = BigInt("1000000000000000000");

if (!safe) {
  console.error("Set HOOTPOT_SAFE to the Hootpot Safe address.");
  process.exit(1);
}
if (!process.env.PRIVATE_KEY) {
  console.error("Set PRIVATE_KEY to a 1-of-1 owner key for HOOTPOT_SAFE.");
  process.exit(1);
}

function decimalToAtto(value) {
  const [whole, fractional = ""] = value.split(".");
  return (
    BigInt(whole) * ATTO_PER_CRC +
    BigInt(fractional.padEnd(18, "0").slice(0, 18) || "0")
  );
}

function attoToDecimal(value, maxDecimals = 6) {
  const atto = BigInt(value);
  if (atto <= BigInt(0)) return null;
  const whole = atto / ATTO_PER_CRC;
  const fractional = atto % ATTO_PER_CRC;
  const decimals = fractional
    .toString()
    .padStart(18, "0")
    .slice(0, maxDecimals)
    .replace(/0+$/, "");
  return decimals ? `${whole}.${decimals}` : whole.toString();
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

async function buildRedemptionTransactions(redeemAmount) {
  const response = await fetch(`${appUrl}/api/hootpot/group/redeem/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operatorAddress: safe, amount: redeemAmount }),
  });
  const payload = await readJson(response);
  return { response, payload };
}

async function loadIndexedMaxRedeemableAmount() {
  const url = new URL("/api/hootpot/group/support/state", appUrl);
  url.searchParams.set("participantAddress", safe);
  const response = await fetch(url);
  const payload = await readJson(response);
  if (!response.ok) return null;
  const maxAtto = payload.support?.potMaxRedeemableAtto;
  return typeof maxAtto === "string" ? attoToDecimal(maxAtto, 6) : null;
}

let usedAmount = amount;
let { response, payload } = await buildRedemptionTransactions(usedAmount);

if (!response.ok && payload.error === "no_group_redeem_path") {
  const maxAmount = await loadIndexedMaxRedeemableAmount();
  if (maxAmount && decimalToAtto(maxAmount) < decimalToAtto(usedAmount)) {
    console.error(
      `No redeem path for ${usedAmount} HOOT. Retrying with indexed max ${maxAmount} HOOT.`,
    );
    usedAmount = maxAmount;
    ({ response, payload } = await buildRedemptionTransactions(usedAmount));
  }
}

if (!response.ok || !Array.isArray(payload.transactions)) {
  console.error(
    `Could not build redemption transactions: ${payload.error ?? response.status}`,
  );
  if (payload.error === "no_redeemable_collateral_trust") {
    console.error(
      "First run TrustHootpotCollateralViaSafe for the donor/collateral avatar.",
    );
  }
  if (payload.error === "no_group_redeem_path") {
    console.error(
      "Try a slightly smaller amount such as 0.999999, or wait for Circles pathfinder indexing.",
    );
  }
  process.exit(1);
}
if (payload.transactions.length === 0) {
  console.log("No redemption transactions returned.");
  process.exit(0);
}

for (const [index, transaction] of payload.transactions.entries()) {
  console.log(
    `Executing Safe redemption tx ${index + 1}/${payload.transactions.length}: ${transaction.to}`,
  );
  const result = spawnSync(
    "forge",
    [
      "script",
      "script/HootpotSafeOps.s.sol:ExecHootpotSafeCall",
      "--rpc-url",
      rpcUrl,
      "--broadcast",
    ],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        HOOTPOT_SAFE: safe,
        SAFE_TX_TO: transaction.to,
        SAFE_TX_DATA: transaction.data ?? "0x",
        SAFE_TX_VALUE: transaction.value ?? "0",
      },
      stdio: "inherit",
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`Redeemed ${usedAmount} HOOT through ${safe}.`);
