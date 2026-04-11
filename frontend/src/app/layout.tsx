import type { Metadata } from "next";
import "./globals.css";
import QueryProvider from "@/providers/QueryProvider";
import CSPostHogProvider from "@/providers/PostHogProvider";
import PostHogPageView from "@/components/PostHogPageView";

export const metadata: Metadata = {
  title: "RegPulse — RBI Regulatory Intelligence",
  description: "AI-powered regulatory Q&A platform for Indian financial institutions",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <CSPostHogProvider>
        <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
          <PostHogPageView />
          <QueryProvider>{children}</QueryProvider>
        </body>
      </CSPostHogProvider>
    </html>
  );
}
