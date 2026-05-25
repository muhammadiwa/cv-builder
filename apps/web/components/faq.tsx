"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "./section-header";

const faqs = [
  {
    id: "1",
    category: "Produk",
    question: "Apa itu Lolos?",
    answer:
      "Lolos adalah AI-powered ATS resume builder yang bantu kamu bikin CV yang dilirik HRD dan lolos sistem ATS. Cukup ngobrol 5 menit sama Kak, AI career assistant kami, dan CV kamu langsung jadi.",
  },
  {
    id: "2",
    category: "ATS",
    question: "Apa itu ATS dan kenapa penting?",
    answer:
      "ATS (Applicant Tracking System) adalah software yang dipakai HRD untuk menyaring CV secara otomatis. 75% perusahaan di Indonesia pakai ATS. Kalau CV kamu gak ATS-friendly, langsung ke reject meskipun kamu kualified.",
  },
  {
    id: "3",
    category: "Produk",
    question: "Gimana cara Lolos bikin CV?",
    answer:
      "Kamu tinggal chat sama Kak via web atau WhatsApp. Kak akan tanya pengalaman, skill, dan pendidikan kamu. Setelah itu, Lolos otomatis susun CV dalam format ATS-friendly. Kamu bisa langsung download atau edit lagi.",
  },
  {
    id: "4",
    category: "Harga",
    question: "Apakah Lolos benar-benar gratis?",
    answer:
      "Ya! Kamu bisa bikin CV gratis tanpa perlu kartu kredit. Versi gratis udah termasuk 1 template CV, ATS scan dasar, export PDF, dan 3x chat dengan Kak. Kalau mau fitur lebih lengkap, ada Pro dan Premium.",
  },
  {
    id: "5",
    category: "ATS",
    question: "Gimana cara ngecek skor ATS CV saya?",
    answer:
      "Setelah CV jadi, Lolos otomatis scan dan kasih skor ATS lengkap dengan detail: keyword match, formatting, completeness, dan saran perbaikan. Kamu juga bisa compare skor sebelum dan sesudah optimasi.",
  },
  {
    id: "6",
    category: "Privasi",
    question: "Apakah data saya aman di Lolos?",
    answer:
      "Data kamu dienkripsi dan dilindungi sesuai standar keamanan industri. Kamu punya kendali penuh — bisa hapus data kapan aja. Kami tidak pernah share data kamu ke pihak ketiga tanpa izin.",
  },
  {
    id: "7",
    category: "Teknis",
    question: "Bisa akses Lolos dari HP?",
    answer:
      "Bisa! Lolos dirancang mobile-first. Bisa akses lewat browser HP atau WhatsApp. Ukuran file kecil dan optimis untuk koneksi 4G. Support semua HP Android dan iPhone.",
  },
  {
    id: "8",
    category: "Harga",
    question: "Bisa upgrade atau cancel kapan aja?",
    answer:
      "Tentu! Kamu bisa upgrade, downgrade, atau cancel subscription kapan aja. Gak ada kontrak mengikat. Kalau cancel, kamu tetap bisa akses fitur premium sampe akhir periode billing.",
  },
  {
    id: "9",
    category: "Produk",
    question: "Bisa bikin CV dalam Bahasa Inggris?",
    answer:
      "Saat ini Lolos support Bahasa Indonesia. Versi Bahasa Inggris sedang dalam pengembangan dan akan rilis tahun ini. Semua data CV kamu bisa di-switch ke English nantinya.",
  },
  {
    id: "10",
    category: "ATS",
    question: "ATS apa aja yang support sama Lolos?",
    answer:
      "Lolos sudah dioptimalkan untuk Talenta (Mekari), LinovHR, GreatDay HR, Greenhouse, Workday, SmartRecruiters, dan kebanyakan ATS yang dipakai perusahaan di Indonesia.",
  },
];

const categories = ["Semua", "Produk", "ATS", "Harga", "Privasi", "Teknis"];

function FAQItem({
  faq,
  index,
}: {
  faq: (typeof faqs)[0];
  index: number;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden transition-colors duration-200",
        isOpen && "border-[var(--color-primary)]/20"
      )}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-sm font-medium text-[var(--color-text-primary)]">
          {faq.question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex-shrink-0"
        >
          <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)]" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {faq.answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function FAQ() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Semua");

  const filtered = faqs.filter((faq) => {
    const matchesCategory =
      activeCategory === "Semua" || faq.category === activeCategory;
    const matchesSearch =
      searchQuery === "" ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <section id="faq" className="relative py-[clamp(64px,10vw,128px)] bg-[var(--color-bg-secondary)]">
      <div className="mx-auto max-w-3xl px-[clamp(16px,5vw,64px)]">
        <SectionHeader tag="FAQ" title="Pertanyaan umum" />

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
          <input
            type="text"
            placeholder="Cari pertanyaan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-11 pr-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200"
          />
        </div>

        {/* Categories */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200",
                activeCategory === cat
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* FAQ list */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory + searchQuery}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-[var(--color-text-tertiary)] py-12">
                Pertanyaan tidak ditemukan. Coba keyword lain.
              </p>
            ) : (
              filtered.map((faq, i) => (
                <FAQItem key={faq.id} faq={faq} index={i} />
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
