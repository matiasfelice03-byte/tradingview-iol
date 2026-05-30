import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AlertChecker } from "@/components/layout/AlertChecker";
import { WatchlistSync } from "@/components/layout/WatchlistSync";
import { SwUnregister } from "@/components/layout/SwUnregister";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TradingView Argentina — Crypto + BYMA",
  description:
    "Charts de cripto y acciones argentinas BYMA con órdenes IOL. Alternativa gratis a TradingView.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Trading AR",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#131722",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`dark ${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <head>
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body className="h-full overflow-hidden bg-tv-bg text-tv-text overscroll-none [touch-action:manipulation]">
        <SwUnregister />
        <TooltipProvider delay={150}>{children}</TooltipProvider>
        <AlertChecker />
        <WatchlistSync />
      </body>
    </html>
  );
}
