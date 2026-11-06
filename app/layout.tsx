import type {
  Metadata,
  Viewport,
} from "next";
import {
  Geist,
  Geist_Mono,
  Inter,
} from "next/font/google";
import BodyWrapper from "@/components/ui/page/body-wrapper";
import { cn } from "@/lib/utils";
import { BrowserTelemetry } from "@/components/observability/browser-telemetry";
import { PwaSupport } from "@/components/pwa/pwa-support";
import "./globals.css";


const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Projekt",
  description: "Projekt",
  applicationName: "Projekt",
  appleWebApp: {
    capable: true,
    title: "Projekt",
    statusBarStyle: "default",
  },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#171717" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={cn(geistSans.variable, geistMono.variable, inter.variable)}>
        <BrowserTelemetry />
        <PwaSupport />
        <BodyWrapper variant="document">{children}</BodyWrapper>
      </body>
    </html>
  );
}
