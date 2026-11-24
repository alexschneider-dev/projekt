import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";


export const metadata: Metadata = {
  metadataBase: new URL(new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3001").origin),
  title: {
    default: "Marktplatz – Stühle entdecken",
    template: "%s | Marktplatz",
  },
  description:
    "Entdecke Stühle verschiedener Verkäufer. Vergleiche Materialien, Farben und Preise auf unserem Demo-Marktplatz.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>
        <Providers>
          <SiteHeader />
          {children}
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
