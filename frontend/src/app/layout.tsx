import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/providers/QueryProvider";
import CSPostHogProvider from "@/providers/PostHogProvider";
import PostHogPageView from "@/components/PostHogPageView";
import { ThemeBootstrap } from "@/components/ThemeBootstrap";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const dmSerifDisplay = DM_Serif_Display({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-dm-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RegPulse — RBI Regulatory Intelligence",
  description: "AI-powered regulatory Q&A platform for Indian financial institutions",
};

// Pre-hydration script — runs before React hydrates so the `dark` class
// is on <html> from the very first paint, eliminating the light-mode
// flash for users who chose dark or whose OS prefers dark.
const themeBootstrapScript = `
(function () {
  try {
    var stored = localStorage.getItem('regpulse:theme');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = (stored === 'light' || stored === 'dark') ? stored : (prefersDark ? 'dark' : 'light');
    var root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    root.style.colorScheme = theme;
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmSerifDisplay.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <CSPostHogProvider>
        <body className="min-h-screen bg-cream-100 font-sans text-[#1A2B40] antialiased dark:bg-navy-950 dark:text-gray-100">
          <ThemeBootstrap />
          <PostHogPageView />
          <QueryProvider>{children}</QueryProvider>
        </body>
      </CSPostHogProvider>
    </html>
  );
}
