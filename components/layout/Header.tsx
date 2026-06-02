import Link from 'next/link';

import { WalletStatus } from '@/components/wallet/WalletStatus';

export function Header() {
  return (
    <header className="col-span-full flex h-14 items-center justify-between border-b border-[#e9dfce] bg-[#fffdf8] px-4">
      <div className="flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2 font-black tracking-normal">
          <span
            aria-hidden="true"
            className="size-8 rounded-[8px] border border-[#251d3f] object-cover"
            style={{
              backgroundImage: "url('/assets/hootpot-group-avatar-v2.png')",
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          />
          <span>Hootpot</span>
        </Link>
        <nav className="ml-3 hidden items-center gap-1 sm:flex">
          <Link
            href="/"
            className="rounded-[8px] px-3 py-2 text-sm font-black text-[#746b80] hover:bg-[#f7f1e8] hover:text-[#251d3f]"
          >
            Home
          </Link>
          <Link
            href="/me"
            className="rounded-[8px] px-3 py-2 text-sm font-black text-[#746b80] hover:bg-[#f7f1e8] hover:text-[#251d3f]"
          >
            Me
          </Link>
          <Link
            href="/scan"
            className="rounded-[8px] px-3 py-2 text-sm font-black text-[#746b80] hover:bg-[#f7f1e8] hover:text-[#251d3f]"
          >
            Scan
          </Link>
          <Link
            href="/pot"
            className="rounded-[8px] px-3 py-2 text-sm font-black text-[#746b80] hover:bg-[#f7f1e8] hover:text-[#251d3f]"
          >
            Pot
          </Link>
          <Link
            href="/dashboard"
            className="rounded-[8px] px-3 py-2 text-sm font-black text-[#746b80] hover:bg-[#f7f1e8] hover:text-[#251d3f]"
          >
            Dashboard
          </Link>
        </nav>
      </div>
      <WalletStatus />
    </header>
  );
}
