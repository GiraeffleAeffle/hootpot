import { notFound } from "next/navigation";

import { MerchantCheckoutPage } from "@/components/hootpot/MerchantCheckoutPage";
import {
  DEFAULT_CHECKOUT_AMOUNT,
  isConfiguredAddress,
  normalizeAmount,
  type HootpotMerchant,
} from "@/lib/hootpot/config";

export const dynamic = "force-dynamic";

function readQueryString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

export default async function DirectPayPage({
  searchParams,
}: {
  searchParams: Promise<{
    merchantAddress?: string | string[];
    merchantName?: string | string[];
    amount?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const merchantAddress = readQueryString(query.merchantAddress);
  if (!isConfiguredAddress(merchantAddress)) notFound();

  const merchantName =
    readQueryString(query.merchantName).slice(0, 80) || "Circles Merchant";
  const initialAmount =
    normalizeAmount(readQueryString(query.amount)) ?? DEFAULT_CHECKOUT_AMOUNT;
  const merchant: HootpotMerchant = {
    id: "direct",
    name: merchantName,
    category: "Self-serve merchant",
    address: merchantAddress,
    boost: "checkout QR",
  };

  return (
    <MerchantCheckoutPage
      merchant={merchant}
      initialAmount={initialAmount}
      directMode
    />
  );
}
