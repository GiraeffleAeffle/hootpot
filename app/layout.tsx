import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AppShell } from "@/components/layout/AppShell";
import { WalletProvider } from "@/components/wallet/WalletProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://hootpot.vercel.app"),
  title: "Hootpot",
  description: "Circles receipts and real pot funding for community cashback.",
  icons: {
    icon: "/assets/hootpot-group-avatar-v2.png",
    apple: "/assets/hootpot-group-avatar-v2.png",
  },
  openGraph: {
    title: "Hootpot",
    description:
      "Circles receipts and real pot funding for community cashback.",
    images: ["/assets/hootpot-group-avatar-v2.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <WalletProvider>
          <AppShell>{children}</AppShell>
        </WalletProvider>
      </body>
    </html>
  );
}
