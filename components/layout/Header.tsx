import Link from 'next/link';
import { Bird } from 'lucide-react';

import { WalletStatus } from '@/components/wallet/WalletStatus';

export function Header() {
  return (
    <header className="col-span-full flex h-14 items-center justify-between border-b border-[#e9dfce] bg-[#fffdf8] px-4">
      <div className="flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2 font-black tracking-normal">
          <span className="flex size-8 items-center justify-center rounded-[8px] bg-[#251d3f] text-[#fffdf8]">
            <Bird className="size-4" />
          </span>
          <span>Hootpot</span>
        </Link>
      </div>
      <WalletStatus />
    </header>
  );
}
