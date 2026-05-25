import type { Metadata, Viewport } from "next";
import { jakarta, inter } from "./fonts";
import { Providers } from "./providers";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lolos — AI ATS Resume Builder | CV Lolos ATS dalam 5 Menit",
  description:
    "Ngobrol 5 menit sama Kak, AI career assistant-mu. CV langsung jadi, lolos ATS, siap lamar. Gratis!",
  manifest: "/manifest.json",
  openGraph: {
    title: "Lolos — CV Lolos ATS dalam 5 Menit",
    description:
      "Ngobrol 5 menit sama Kak, CV lo jadi — dan robot HRD langsung baca.",
    type: "website",
    locale: "id_ID",
  },
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${jakarta.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/192.png" />
      </head>
      <body className="font-body antialiased">
        <OfflineBanner />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
