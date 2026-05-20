import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "ShipBoost Outreach" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 min-h-screen">{children}</body>
    </html>
  );
}
