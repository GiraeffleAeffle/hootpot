import type { ReactNode } from 'react';

import { Header } from '@/components/layout/Header';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-rows-[3.5rem_1fr] bg-[#fbf8f2]">
      <Header />
      <div className="overflow-auto">{children}</div>
    </div>
  );
}
