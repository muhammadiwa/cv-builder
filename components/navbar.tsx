"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Menu, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/app/providers";

const navLinks = [
  { href: "#features", label: { id: "Fitur", en: "Features" } },
  { href: "#templates", label: { id: "Template", en: "Templates" } },
  { href: "#pricing", label: { id: "Harga", en: "Pricing" } },
  { href: "#faq", label: { id: "FAQ", en: "FAQ" } },
];

export function Navbar() {
  const { isDark, toggleDark, lang, setLang } = useApp();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-[var(--color-bg)]/80 backdrop-blur-xl border-b border-[var(--color-border)] shadow-sm"
          : "bg-transparent"
      )}
    >
      <nav className="mx-auto max-w-[1280px] px-[clamp(16px,5vw,64px)] h-16 sm:h-18 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-card flex items-center justify-center text-white font-bold text-sm">
            L
          </div>
          <span className="font-display font-bold text-lg text-[var(--color-text-primary)]">
            Lolos
          </span>
        </a>

        {/* Nav links — desktop */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors duration-200"
            >
              {link.label[lang]}
            </a>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Dark mode toggle */}
          <button
            onClick={toggleDark}
            className="w-9 h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-all"
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === "id" ? "en" : "id")}
            className="hidden sm:flex text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors px-2 py-1 rounded border border-transparent hover:border-[var(--color-border)]"
          >
            {lang === "id" ? "EN" : "ID"}
          </button>

          {/* CTA desktop */}
          <button className="hidden sm:inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-all">
            {lang === "id" ? "Buat CV Gratis" : "Create CV Free"}
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden w-9 h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 md:hidden"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            {/* Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute right-0 top-0 bottom-0 w-[280px] bg-[var(--color-surface)] border-l border-[var(--color-border)] p-6"
            >
              <div className="flex justify-end mb-8">
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-9 h-9 rounded-lg border border-[var(--color-border)] flex items-center justify-center"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-col gap-6">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="text-lg font-medium text-[var(--color-text-primary)] hover:text-[var(--color-primary)] transition-colors"
                  >
                    {link.label[lang]}
                  </a>
                ))}
                <hr className="border-[var(--color-border)]" />
                <button className="w-full py-3 rounded-xl bg-[var(--color-primary)] text-white font-semibold text-sm flex items-center justify-center gap-2">
                  {lang === "id" ? "Buat CV Gratis" : "Create CV Free"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
