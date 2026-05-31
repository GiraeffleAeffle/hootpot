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
      </div>
      <WalletStatus />
    </header>
  );
}
