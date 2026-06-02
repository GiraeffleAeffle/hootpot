"use client";

import {
  ExternalLink,
  QrCode,
  ScanLine,
  Star,
  Store,
  User,
  Wallet,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";
import {
  DEFAULT_CHECKOUT_AMOUNT,
  formatAddress,
  GROUP_URL,
  normalizeAmount,
} from "@/lib/hootpot/config";
import { circlesPlaygroundUrl, directCheckoutUrl } from "@/lib/hootpot/urls";

export function MyHootpotProfile() {
  const { address, isConnected, isMiniappHost } = useWallet();
  const [merchantName, setMerchantName] = useState("My Circles Shop");
  const [amount, setAmount] = useState(DEFAULT_CHECKOUT_AMOUNT);

  const normalizedAmount = normalizeAmount(amount) ?? DEFAULT_CHECKOUT_AMOUNT;
  const directUrl = address
    ? directCheckoutUrl({
        merchantAddress: address,
        merchantName,
        amount: normalizedAmount,
      })
    : "";
  const qrSrc = directUrl
    ? `/api/qr?value=${encodeURIComponent(directUrl)}`
    : "";

  return (
    <main className="min-h-screen bg-[#fbf8f2] text-[#171428]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5">
        <section className="grid gap-4 rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-4 shadow-[0_8px_0_#251d3f] md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#746b80]">
              My Hootpot profile
            </p>
            <h1 className="mt-1 text-4xl font-black leading-none">
              {isConnected ? "Ready for CRC receipts" : "Connect in Circles"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-5 text-[#746b80]">
              Use the same Circles account as a shopper or as a test merchant.
              Hootpot can create receipt QR links, but account creation still
              happens in the Gnosis/Circles app.
            </p>
          </div>
          <a
            href={
              isMiniappHost
                ? GROUP_URL
                : circlesPlaygroundUrl("https://hootpot.vercel.app/me")
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#251d3f] px-4 text-sm font-black text-[#fffdf8]"
          >
            {isMiniappHost ? "Star HOOT" : "Open In Circles"}
            <ExternalLink className="size-4" />
          </a>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-4">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <User className="size-5 text-[#0d7f5f]" />
              Shopper
            </h2>
            <div className="mt-4 grid gap-3">
              <ProfileFact
                label="Account"
                value={isConnected ? formatAddress(address) : "not connected"}
                icon={Wallet}
              />
              <ProfileFact
                label="HOOT group"
                value="join / star"
                icon={Star}
              />
              <ProfileFact
                label="Checkout"
                value="scan merchant QR"
                icon={ScanLine}
              />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <a
                href="/scan"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#d8f36a] px-3 text-sm font-black text-[#1f2a0a]"
              >
                <ScanLine className="size-4" />
                Scan QR
              </a>
              <a
                href={GROUP_URL}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#251d3f] bg-white px-3 text-sm font-black text-[#251d3f]"
              >
                <Star className="size-4" />
                Star HOOT
              </a>
            </div>
          </div>

          <div className="rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-4">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <Store className="size-5 text-[#ff7a1a]" />
              Merchant QR
            </h2>
            <p className="mt-1 text-sm font-semibold leading-5 text-[#746b80]">
              For testing, your connected Circles account can act as a merchant.
              Put this QR on a counter; the shopper scans it and pays you in CRC.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_260px]">
              <div className="grid content-start gap-3">
                <label className="grid gap-2 text-sm font-semibold">
                  Merchant name
                  <input
                    value={merchantName}
                    onChange={(event) => setMerchantName(event.target.value)}
                    className="h-11 rounded-[8px] border border-[#d8cfbe] bg-white px-3 font-bold outline-none focus:border-[#251d3f]"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  QR amount
                  <div className="flex h-11 overflow-hidden rounded-[8px] border border-[#d8cfbe] bg-white focus-within:border-[#251d3f]">
                    <input
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      inputMode="decimal"
                      className="min-w-0 flex-1 px-3 font-bold outline-none"
                    />
                    <span className="flex items-center border-l border-[#e9dfce] px-3 text-sm font-black text-[#746b80]">
                      CRC
                    </span>
                  </div>
                </label>
                {directUrl ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <a
                      href={directUrl}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#251d3f] px-3 text-sm font-black text-[#fffdf8]"
                    >
                      Open Checkout
                      <ExternalLink className="size-4" />
                    </a>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigator.clipboard.writeText(directUrl)}
                      className="h-10 rounded-[8px]"
                    >
                      Copy Link
                    </Button>
                  </div>
                ) : (
                  <a
                    href={circlesPlaygroundUrl("https://hootpot.vercel.app/me")}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#251d3f] px-3 text-sm font-black text-[#fffdf8]"
                  >
                    Open In Circles
                    <ExternalLink className="size-4" />
                  </a>
                )}
              </div>
              <div className="grid gap-3">
                {qrSrc ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrSrc}
                      alt="Merchant checkout QR code"
                      className="w-full rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-3"
                    />
                    <p className="break-all text-center font-mono text-xs font-bold text-[#746b80]">
                      {formatAddress(address)}
                    </p>
                  </>
                ) : (
                  <div className="flex aspect-square items-center justify-center rounded-[8px] border border-dashed border-[#bcb1c8] bg-[#f7f1e8] text-[#746b80]">
                    <QrCode className="size-10" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function ProfileFact({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
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
