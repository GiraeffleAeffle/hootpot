import {
  ArrowRight,
  ExternalLink,
  Gift,
  QrCode,
  ScanLine,
  Star,
  Store,
  User,
} from "lucide-react";
import Link from "next/link";

import {
  DEFAULT_CHECKOUT_AMOUNT,
  GROUP_URL,
  isConfiguredAddress,
  MERCHANTS,
} from "@/lib/hootpot/config";

export function HootpotLandingPage() {
  const configuredMerchants = MERCHANTS.filter((merchant) =>
    isConfiguredAddress(merchant.address),
  );

  return (
    <main className="min-h-screen bg-[#fbf8f2] text-[#171428]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5">
        <section className="grid gap-5 rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-4 shadow-[0_8px_0_#251d3f] md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <span
                aria-hidden="true"
                className="size-12 rounded-[8px] border border-[#251d3f]"
                style={{
                  backgroundImage: "url('/assets/hootpot-group-avatar-v2.png')",
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                }}
              />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#746b80]">
                  Circles merchant cashback
                </p>
                <h1 className="text-4xl font-black leading-none">Hootpot</h1>
              </div>
            </div>
            <p className="max-w-2xl text-base font-semibold leading-6 text-[#4f475c]">
              Scan a merchant QR, pay in CRC, and the verified receipt can enter
              a community-funded cashback pot.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <Link
              href="/scan"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#251d3f] px-4 text-sm font-black text-[#fffdf8]"
            >
              <ScanLine className="size-4" />
              Scan QR
            </Link>
            <Link
              href="/me"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#251d3f] bg-white px-4 text-sm font-black text-[#251d3f]"
            >
              <User className="size-4" />
              My Profile
            </Link>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <RoleCard
            icon={ScanLine}
            title="Shopper"
            body="Scan a merchant QR and pay through the Circles host."
            href="/scan"
            action="Scan QR"
          />
          <RoleCard
            icon={QrCode}
            title="Merchant"
            body="Use your connected Circles account to generate a checkout QR."
            href="/me"
            action="Create QR"
          />
          <RoleCard
            icon={Gift}
            title="Supporter"
            body="Star HOOT and follow the real cashback pot."
            href="/pot"
            action="View Pot"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black">
                  <Store className="size-5 text-[#ff7a1a]" />
                  Merchant profiles
                </h2>
                <p className="mt-1 text-sm font-semibold text-[#746b80]">
                  Configured merchants get a profile page with a checkout QR.
                </p>
              </div>
              <span className="rounded-[6px] bg-[#e9e2ff] px-3 py-1 text-xs font-black text-[#2a2064]">
                {configuredMerchants.length}/{MERCHANTS.length} active
              </span>
            </div>
            <div className="mt-4 grid gap-2">
              {MERCHANTS.map((merchant) => {
                const configured = isConfiguredAddress(merchant.address);
                return (
                  <Link
                    key={merchant.id}
                    href={
                      configured
                        ? `/merchant/${merchant.id}?amount=${DEFAULT_CHECKOUT_AMOUNT}`
                        : "#"
                    }
                    className={[
                      "grid gap-2 rounded-[8px] border p-3 sm:grid-cols-[1fr_auto] sm:items-center",
                      configured
                        ? "border-[#e9dfce] bg-white hover:border-[#251d3f]"
                        : "pointer-events-none border-[#e9dfce] bg-[#f7f1e8] opacity-60",
                    ].join(" ")}
                  >
                    <span>
                      <span className="block font-black">{merchant.name}</span>
                      <span className="block text-sm font-semibold text-[#746b80]">
                        {configured ? merchant.category : "address pending"}
                      </span>
                    </span>
                    <span className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] bg-[#251d3f] px-3 text-sm font-black text-[#fffdf8]">
                      Profile
                      <ArrowRight className="size-4" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[8px] border border-[#251d3f] bg-[#251d3f] p-4 text-[#fffdf8]">
              <h2 className="flex items-center gap-2 text-xl font-black">
                <Star className="size-5 text-[#d8f36a]" />
                HOOT group
              </h2>
              <p className="mt-2 text-sm font-semibold leading-5 text-[#d9d1ea]">
                Join or star HOOT in the Gnosis app. The app can use HOOT
                support and the Safe balance for cashback payouts.
              </p>
              <div className="mt-4 grid gap-2">
                <a
                  href={GROUP_URL}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#d8f36a] px-3 text-sm font-black text-[#1f2a0a]"
                >
                  Star HOOT
                  <ExternalLink className="size-4" />
                </a>
                <Link
                  href="/dashboard"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#706095] bg-[#31264f] px-3 text-sm font-black text-[#fffdf8]"
                >
                  Full Dashboard
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function RoleCard({
  icon: Icon,
  title,
  body,
  href,
  action,
}: {
  icon: typeof ScanLine;
  title: string;
  body: string;
  href: string;
  action: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-4 hover:bg-white"
    >
      <div className="flex size-11 items-center justify-center rounded-[8px] bg-[#d8f36a] text-[#1f2a0a]">
        <Icon className="size-5" />
      </div>
      <h2 className="mt-4 text-xl font-black">{title}</h2>
      <p className="mt-2 min-h-10 text-sm font-semibold leading-5 text-[#746b80]">
        {body}
      </p>
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#251d3f]">
        {action}
        <ArrowRight className="size-4" />
      </span>
    </Link>
  );
}
