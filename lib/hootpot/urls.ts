const DEFAULT_APP_URL = "https://hootpot.vercel.app";

export function hootpotBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_HOOTPOT_APP_URL?.trim().replace(/\/+$/, "") ||
    DEFAULT_APP_URL
  );
}

export function merchantCheckoutPath(merchantId: string, amount: string): string {
  const params = new URLSearchParams({ amount });
  return `/pay/${encodeURIComponent(merchantId)}?${params.toString()}`;
}

export function merchantCheckoutUrl(merchantId: string, amount: string): string {
  return `${hootpotBaseUrl()}${merchantCheckoutPath(merchantId, amount)}`;
}

export function directCheckoutPath(input: {
  merchantAddress: string;
  merchantName: string;
  amount: string;
}): string {
  const params = new URLSearchParams({
    merchantAddress: input.merchantAddress,
    merchantName: input.merchantName,
    amount: input.amount,
  });
  return `/pay/direct?${params.toString()}`;
}

export function directCheckoutUrl(input: {
  merchantAddress: string;
  merchantName: string;
  amount: string;
}): string {
  return `${hootpotBaseUrl()}${directCheckoutPath(input)}`;
}

export function circlesPlaygroundUrl(url: string): string {
  return `https://circles.gnosis.io/playground?url=${encodeURIComponent(url)}`;
}
