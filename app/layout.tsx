import type { Metadata } from "next";
import { jakarta, inter } from "./fonts";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lolos — AI ATS Resume Builder | CV Lolos ATS dalam 5 Menit",
  description:
    "Ngobrol 5 menit sama Kak, AI career assistant-mu. CV langsung jadi, lolos ATS, siap lamar. Gratis!",
  openGraph: {
    title: "Lolos — CV Lolos ATS dalam 5 Menit",
    description:
      "Ngobrol 5 menit sama Kak, CV lo jadi — dan robot HRD langsung baca.",
    type: "website",
    locale: "id_ID",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${jakarta.variable} ${inter.variable}`} suppressHydrationWarning>
      <body className="font-body antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
