# Hootpot Production Setup

## Why Gnosis Pay Sync Failed

`SIWE domain not allowed` means Gnosis Pay rejected the Sign-In with Ethereum
message because `hootpot.vercel.app` is not registered for SIWE yet.

Gnosis Pay allows `localhost` for development, but production and staging domains
must be registered through the Gnosis Pay partner settings. Register:

```text
hootpot.vercel.app
```

For continuous card receipt ingestion, also configure this webhook URL:

```text
https://hootpot.vercel.app/api/hootpot/gnosis-pay/webhook
```

Hootpot already verifies Gnosis Pay webhook signatures with
`X-Webhook-Timestamp` and `X-Webhook-Signature`.

## Vercel Environment Variables

Set these in Vercel Project Settings -> Environment Variables for Production.
Redeploy after changing them.

### Admin Secret

`HOOTPOT_ADMIN_SECRET` protects operator-only mutations:

- draw winner
- record payout
- clear tickets

Generate one locally:

```bash
openssl rand -hex 32
```

Set it as:

```text
HOOTPOT_ADMIN_SECRET=<generated-secret>
```

The public app does not show the operator field. To run operator actions from
the UI, open:

```text
https://hootpot.vercel.app/?operator=1
```

Paste the admin secret there. Ordinary users do not need this key.

### Durable Ledger

Without durable storage, Vercel serverless storage can disappear. The preferred
production store is Neon/Postgres. Create a Neon database and connect it to the
`hootpot` project. The app will use any of these connection strings:

```text
DATABASE_URL=
POSTGRES_URL=
POSTGRES_PRISMA_URL=
NEON_DATABASE_URL=
```

If no Postgres URL exists, the app falls back to Vercel KV / Upstash Redis REST.
Those stores usually provide:

```text
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

The app also accepts the native Upstash names if the Marketplace integration
injects those instead:

```text
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Optional custom ledger key:

```text
HOOTPOT_LEDGER_KEY=hootpot:ledger
```

### HOOT Open Join

Users can star the HOOT group without this, but they cannot self-serve group
membership and mint/support HOOT until the group has an open service.

Current deployed open service:

```text
0xd268CF0FB4E32d090C22EbeD82B2B7d145ec95df
```

Deploy the service:

```bash
HOOTPOT_GROUP=0xa31676f40EED5eA91664AB0ac188c48F6CCb54c0 \
forge script script/DeployHootpotOpenGroupService.s.sol:DeployHootpotOpenGroupService \
  --rpc-url "$GNOSIS_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast
```

Set the deployed address in Vercel and redeploy:

```text
NEXT_PUBLIC_HOOTPOT_GROUP_OPEN_SERVICE_ADDRESS=0xd268CF0FB4E32d090C22EbeD82B2B7d145ec95df
```

Then open Hootpot with the HOOT owner Safe selected:

```text
https://hootpot.vercel.app/?operator=1
```

Click `Enable Open Join`. After that, normal users can click `Join HOOT` in the
miniapp before minting/supporting HOOT.

### Gnosis Pay Webhooks

Normally Hootpot fetches the Gnosis Pay webhook public key from:

```text
https://webhooks.gnosispay.com/api/v1/public-key
```

Optional overrides:

```text
GNOSIS_PAY_WEBHOOK_PUBLIC_KEY=
GNOSIS_PAY_WEBHOOK_PUBLIC_KEY_URL=
GNOSIS_PAY_WEBHOOK_MAX_SKEW_SECONDS=300
```

## CLI Helpers

You can set Vercel env vars from the project directory:

```bash
printf '%s' '<secret>' | pnpm dlx vercel@latest env add HOOTPOT_ADMIN_SECRET production
printf '%s' '<postgres-url>' | pnpm dlx vercel@latest env add DATABASE_URL production
printf '%s' '<url>' | pnpm dlx vercel@latest env add KV_REST_API_URL production
printf '%s' '<token>' | pnpm dlx vercel@latest env add KV_REST_API_TOKEN production
pnpm dlx vercel@latest deploy --prod -y
```

If the Vercel account has the Neon Marketplace integration available, the free
Postgres resource can be provisioned from the CLI:

```bash
pnpm dlx vercel@latest integration add neon \
  --name hootpot-ledger \
  --plan free_v3 \
  --metadata region=fra1 \
  --metadata auth=false \
  --environment production
```

If the Vercel account has the Marketplace terms accepted, the Redis resource can
also be provisioned from the CLI. This creates a billable Upstash pay-as-you-go
resource:

```bash
pnpm dlx vercel@latest integration add upstash/upstash-kv \
  --name hootpot-ledger \
  --plan paid \
  --metadata primaryRegion=fra1 \
  --metadata prodPack=false \
  --metadata autoUpgrade=false \
  --environment production
```
