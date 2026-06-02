import { ExternalLink, QrCode, Store, Wallet } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { QrCodeSvg } from "@/components/hootpot/QrCodeSvg";
import {
  DEFAULT_CHECKOUT_AMOUNT,
  findConfiguredMerchant,
  formatAddress,
  isConfiguredAddress,
  normalizeAmount,
} from "@/lib/hootpot/config";
import { merchantCheckoutPath, merchantCheckoutUrl } from "@/lib/hootpot/urls";

export const dynamic = "force-dynamic";

export default async function MerchantProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ merchantId: string }>;
  searchParams: Promise<{ amount?: string }>;
}) {
  const [{ merchantId }, query] = await Promise.all([params, searchParams]);
  const merchant = findConfiguredMerchant(merchantId);
  if (!merchant) notFound();

  const amount =
    typeof query.amount === "string"
      ? normalizeAmount(query.amount) ?? DEFAULT_CHECKOUT_AMOUNT
      : DEFAULT_CHECKOUT_AMOUNT;
  const checkoutPath = merchantCheckoutPath(merchant.id, amount);
  const checkoutUrl = merchantCheckoutUrl(merchant.id, amount);
  const configured = isConfiguredAddress(merchant.address);

  return (
    <main className="min-h-screen bg-[#fbf8f2] text-[#171428]">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-5">
        <section className="grid gap-5 rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-4 shadow-[0_8px_0_#251d3f] md:grid-cols-[1fr_280px]">
          <div className="flex flex-col justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#746b80]">
                Merchant profile
              </p>
              <h1 className="mt-2 text-4xl font-black leading-none">
                {merchant.name}
              </h1>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-5 text-[#746b80]">
                Scan the QR code to pay this merchant in CRC. Verified receipts
                enter the Hootpot cashback round.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <MerchantFact
                label="Type"
                value={merchant.category}
                icon={Store}
              />
              <MerchantFact
                label="Address"
                value={configured ? formatAddress(merchant.address) : "pending"}
                icon={Wallet}
              />
              <MerchantFact label="QR" value={`${amount} CRC`} icon={QrCode} />
            </div>
          </div>
          <div className="grid gap-3">
            <QrCodeSvg value={checkoutUrl} label={checkoutUrl} />
            <Link
              href={checkoutPath}
              className={[
                "inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#251d3f] px-4 text-sm font-black text-[#fffdf8]",
                configured ? "" : "pointer-events-none opacity-50",
              ].join(" ")}
            >
              Open Checkout
              <ExternalLink className="size-4" />
            </Link>
          </div>
        </section>

        <section className="rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-4">
          <h2 className="text-xl font-black">Counter setup</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {["Show profile", "Scan QR", "Pay CRC"].map((label, index) => (
              <div
                key={label}
                className="rounded-[8px] border border-[#e9dfce] bg-[#f7f1e8] p-3"
              >
                <span className="flex size-8 items-center justify-center rounded-[8px] bg-[#d8f36a] text-sm font-black text-[#1f2a0a]">
                  {index + 1}
                </span>
                <p className="mt-3 font-black">{label}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function MerchantFact({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Store;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[8px] border border-[#e9dfce] bg-[#f7f1e8] p-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-[#d8f36a] text-[#1f2a0a]">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#746b80]">
          {label}
        </p>
        <p className="truncate text-sm font-black">{value}</p>
      </div>
    </div>
  );
}
