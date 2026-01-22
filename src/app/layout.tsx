import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AccountProvider, PrivacyProvider, CurrencyProvider, ThemeProvider } from "@/contexts";
import { Toaster } from "@/components/ui/toaster";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";

const instrumentSans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WealthPilot - Personal Finance Dashboard",
  description: "Track your spending, budget wisely, and achieve your financial goals with WealthPilot.",
  keywords: ["finance", "budget", "spending tracker", "personal finance", "savings goals"],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "WealthPilot",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#2CB1BC",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${instrumentSans.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <ThemeProvider>
          <PrivacyProvider>
            <CurrencyProvider>
              <AccountProvider>{children}</AccountProvider>
            </CurrencyProvider>
          </PrivacyProvider>
        </ThemeProvider>
        <Toaster />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
