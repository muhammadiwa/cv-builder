"use client";

import { Instagram, Linkedin, Youtube, Twitter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/app/providers";

const linkGroups = [
  {
    title: "Produk",
    links: ["Fitur", "Template", "Harga", "ATS Checker"],
  },
  {
    title: "Sumber Daya",
    links: ["Blog", "Panduan CV", "Tips Karir", "Riset ATS"],
  },
  {
    title: "Perusahaan",
    links: ["Tentang", "Kontak", "Privacy", "Syarat & Ketentuan"],
  },
];

const socialIcons = [
  { icon: Instagram, href: "#" },
  { icon: Linkedin, href: "#" },
  { icon: Youtube, href: "#" },
  { icon: Twitter, href: "#" },
];

export function Footer() {
  const { lang, setLang } = useApp();

  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      <div className="mx-auto max-w-[1280px] px-[clamp(16px,5vw,64px)] py-12 sm:py-16">
        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-card flex items-center justify-center text-white font-bold text-sm">
                L
              </div>
              <span className="font-display font-bold text-lg text-[var(--color-text-primary)]">
                Lolos
              </span>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] max-w-xs leading-relaxed">
              AI-powered ATS resume builder. Bantu pencari kerja Indonesia lolos seleksi HRD dan ATS.
            </p>
            {/* Social */}
            <div className="flex gap-3 mt-6">
              {socialIcons.map(({ icon: Icon, href }, i) => (
                <a
                  key={i}
                  href={href}
                  className="w-9 h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/30 transition-all duration-200"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link groups */}
          {linkGroups.map((group) => (
            <div key={group.title}>
              <h4 className="font-semibold text-sm text-[var(--color-text-primary)] mb-4">
                {group.title}
              </h4>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors duration-200"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Language */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang("id")}
              className={cn(
                "text-sm font-medium px-2 py-1 rounded transition-colors",
                lang === "id"
                  ? "text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
              )}
            >
              Indonesia
            </button>
            <span className="text-[var(--color-border)]">|</span>
            <button
              onClick={() => setLang("en")}
              className={cn(
                "text-sm font-medium px-2 py-1 rounded transition-colors",
                lang === "en"
                  ? "text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
              )}
            >
              English
            </button>
          </div>

          <p className="text-xs text-[var(--color-text-tertiary)]">
            &copy; {new Date().getFullYear()} Lolos. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
