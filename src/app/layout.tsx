import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AccountProvider, PrivacyProvider, CurrencyProvider, ThemeProvider, AccentProvider, DatabaseProvider } from "@/contexts";
import { Toaster } from "@/components/ui/toaster";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WealthPilot — Pilotage financier du foyer",
  description: "Suivez les comptes, dépenses, budgets et objectifs de votre foyer, localement et en toute confidentialité.",
  keywords: ["finance", "budget", "dépenses", "trésorerie", "objectifs"],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "WealthPilot",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
    { media: "(prefers-color-scheme: dark)", color: "#0C121C" },
  ],
  colorScheme: "light dark",
};

const themeBootstrap = `(function(){try{var s=localStorage.getItem('theme');var t=s==='light'||s==='dark'||s==='system'?s:'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          <AccentProvider>
            <PrivacyProvider>
              <CurrencyProvider>
                <DatabaseProvider>
                  <AccountProvider>{children}</AccountProvider>
                </DatabaseProvider>
              </CurrencyProvider>
            </PrivacyProvider>
          </AccentProvider>
        </ThemeProvider>
        <Toaster />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
