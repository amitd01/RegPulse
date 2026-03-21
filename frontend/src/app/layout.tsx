import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RegPulse — RBI Regulatory Intelligence",
  description: "AI-powered regulatory Q&A platform for Indian financial institutions",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
