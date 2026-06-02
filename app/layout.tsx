import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solidus Testnet",
  description: "Use FLOW. Earn PRIME.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
