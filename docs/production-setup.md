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

Without durable storage, Vercel serverless storage can disappear. Create a
Vercel KV / Upstash Redis store and connect it to the `hootpot` project. Vercel
will provide:

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
printf '%s' '<url>' | pnpm dlx vercel@latest env add KV_REST_API_URL production
printf '%s' '<token>' | pnpm dlx vercel@latest env add KV_REST_API_TOKEN production
pnpm dlx vercel@latest deploy --prod -y
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
