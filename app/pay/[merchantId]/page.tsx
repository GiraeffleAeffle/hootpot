import { notFound } from "next/navigation";

import { MerchantCheckoutPage } from "@/components/hootpot/MerchantCheckoutPage";
import {
  DEFAULT_CHECKOUT_AMOUNT,
  findConfiguredMerchant,
  normalizeAmount,
} from "@/lib/hootpot/config";

export const dynamic = "force-dynamic";

export default async function PayMerchantPage({
  params,
  searchParams,
}: {
  params: Promise<{ merchantId: string }>;
  searchParams: Promise<{ amount?: string }>;
}) {
  const [{ merchantId }, query] = await Promise.all([params, searchParams]);
  const merchant = findConfiguredMerchant(merchantId);
  if (!merchant) notFound();

  const initialAmount =
    typeof query.amount === "string"
      ? normalizeAmount(query.amount) ?? DEFAULT_CHECKOUT_AMOUNT
      : DEFAULT_CHECKOUT_AMOUNT;

  return (
    <MerchantCheckoutPage merchant={merchant} initialAmount={initialAmount} />
  );
}
