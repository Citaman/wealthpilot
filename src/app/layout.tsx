import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AccountProvider } from "@/contexts/account-context";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WealthPilot - Personal Finance Dashboard",
  description: "Track your spending, budget wisely, and achieve your financial goals with WealthPilot.",
  keywords: ["finance", "budget", "spending tracker", "personal finance", "savings goals"],
  manifest: "/manifest.webmanifest",
  themeColor: "#0ea5e9",
  appleWebApp: {
    capable: true,
    title: "WealthPilot",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <AccountProvider>
          {children}
        </AccountProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
