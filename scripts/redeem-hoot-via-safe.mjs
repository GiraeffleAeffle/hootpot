#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appUrl = process.env.HOOTPOT_APP_URL ?? "https://hootpot.vercel.app";
const safe = process.env.HOOTPOT_SAFE;
const amount = process.env.HOOTPOT_REDEEM_AMOUNT ?? "1";
const rpcUrl = process.env.GNOSIS_RPC_URL ?? "https://rpc.gnosischain.com";
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

if (!safe) {
  console.error("Set HOOTPOT_SAFE to the Hootpot Safe address.");
  process.exit(1);
}
if (!process.env.PRIVATE_KEY) {
  console.error("Set PRIVATE_KEY to a 1-of-1 owner key for HOOTPOT_SAFE.");
  process.exit(1);
}

const response = await fetch(`${appUrl}/api/hootpot/group/redeem/transactions`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ operatorAddress: safe, amount }),
});
const payload = await response.json();

if (!response.ok || !Array.isArray(payload.transactions)) {
  console.error(
    `Could not build redemption transactions: ${payload.error ?? response.status}`,
  );
  if (payload.error === "no_redeemable_collateral_trust") {
    console.error(
      "First run TrustHootpotCollateralViaSafe for the donor/collateral avatar.",
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

console.log(`Redeemed ${amount} HOOT through ${safe}.`);
