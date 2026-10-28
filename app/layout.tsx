import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import BodyWrapper from "@/components/ui/page/body-wrapper";
import { cn } from "@/lib/utils";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={cn(geistSans.variable, geistMono.variable, inter.variable)}>
        <BodyWrapper variant="document">{children}</BodyWrapper>
      </body>
    </html>
  );
}
