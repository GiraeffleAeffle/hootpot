export type HootpotMerchant = {
  id: string;
  name: string;
  category: string;
  address: string;
  boost: string;
};

export const ROUND_ID = "garage-cycle-02";
export const DEFAULT_ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const DEFAULT_CHECKOUT_AMOUNT = "1";
export const MAX_CASHBACK_CRC = 50;

export const POT_ADDRESS =
  process.env.NEXT_PUBLIC_HOOTPOT_POT_ADDRESS ?? DEFAULT_ZERO_ADDRESS;

export const GROUP_ADDRESS =
  process.env.NEXT_PUBLIC_HOOTPOT_GROUP_ADDRESS ??
  "0xa31676f40EED5eA91664AB0ac188c48F6CCb54c0";

export const GROUP_OPEN_SERVICE_ADDRESS =
  process.env.NEXT_PUBLIC_HOOTPOT_GROUP_OPEN_SERVICE_ADDRESS ??
  "0xd268CF0FB4E32d090C22EbeD82B2B7d145ec95df";

export const GROUP_URL =
  process.env.NEXT_PUBLIC_HOOTPOT_GROUP_URL ??
  `https://app.aboutcircles.com/groups/members/${GROUP_ADDRESS}`;

export const GROUP_METRICS_URL =
  process.env.NEXT_PUBLIC_HOOTPOT_GROUP_METRICS_URL ??
  `https://app.aboutcircles.com/groups/metrics/${GROUP_ADDRESS}`;

export const GROUP_MINT_HANDLER_ADDRESS =
  process.env.NEXT_PUBLIC_HOOTPOT_GROUP_MINT_HANDLER_ADDRESS ??
  DEFAULT_ZERO_ADDRESS;

export const GROUP_TREASURY_ADDRESS =
  process.env.NEXT_PUBLIC_HOOTPOT_GROUP_TREASURY_ADDRESS ??
  DEFAULT_ZERO_ADDRESS;

export const REGISTRY_ADDRESS =
  process.env.NEXT_PUBLIC_HOOTPOT_REGISTRY_ADDRESS ?? DEFAULT_ZERO_ADDRESS;

export const POOL_ADDRESS =
  process.env.NEXT_PUBLIC_HOOTPOT_POOL_ADDRESS ?? DEFAULT_ZERO_ADDRESS;

export const MERCHANT_REGISTRY_ADDRESS =
  process.env.NEXT_PUBLIC_HOOTPOT_MERCHANT_REGISTRY_ADDRESS ??
  DEFAULT_ZERO_ADDRESS;

export const MERCHANTS: HootpotMerchant[] = [
  {
    id: "owl-coffee",
    name: "Owl Coffee",
    category: "Cafe",
    address:
      process.env.NEXT_PUBLIC_HOOTPOT_MERCHANT_ONE ?? DEFAULT_ZERO_ADDRESS,
    boost: "3 CRC/day",
  },
  {
    id: "kiez-market",
    name: "Kiez Market",
    category: "Groceries",
    address:
      process.env.NEXT_PUBLIC_HOOTPOT_MERCHANT_TWO ?? DEFAULT_ZERO_ADDRESS,
    boost: "1 ticket per receipt",
  },
  {
    id: "repair-table",
    name: "Repair Table",
    category: "Services",
    address:
      process.env.NEXT_PUBLIC_HOOTPOT_MERCHANT_THREE ?? DEFAULT_ZERO_ADDRESS,
    boost: "weekly top-up",
  },
];

export function isConfiguredAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address) && !/^0x0{40}$/i.test(address);
}

export function normalizeAmount(value: string | number): string | null {
  const raw = typeof value === "number" ? String(value) : value.trim();
  const normalized = raw.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  if (Number(normalized) <= 0) return null;
  return normalized;
}

export function formatAddress(address: string | null): string {
  if (!address) return "No wallet";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function cashbackForAmount(amount: string): number {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(parsed, MAX_CASHBACK_CRC);
}
