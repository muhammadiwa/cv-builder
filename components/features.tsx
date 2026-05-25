"use client";

import { motion } from "framer-motion";
import {
  Bot,
  ScanSearch,
  FileText,
  MessageCircle,
  Globe,
  Zap,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "./section-header";

interface FeatureCardProps {
  size: "lg" | "sm";
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient?: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 100, damping: 15 },
  },
};

function FeatureCard({ size, icon, title, description, gradient }: FeatureCardProps) {
  return (
    <motion.div
      variants={cardVariants}
      className={cn(
        "group relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8 overflow-hidden transition-all duration-300",
        size === "lg" ? "sm:col-span-2 sm:row-span-2" : "sm:col-span-1",
        gradient && "border-[var(--color-primary)]/20"
      )}
    >
      {/* Hover gradient overlay */}
      <div
        className={cn(
          "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
          gradient
            ? "bg-gradient-to-br from-[var(--color-primary)]/5 to-[var(--color-accent)]/5"
            : "bg-gradient-to-br from-[var(--color-primary)]/3 to-transparent"
        )}
      />

      {/* Icon */}
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center mb-4",
          gradient
            ? "bg-gradient-card text-white shadow-lg shadow-[var(--color-primary-glow)]"
            : "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
        )}
      >
        {icon}
      </div>

      <h3 className="font-display text-lg font-semibold text-[var(--color-text-primary)] mb-2">
        {title}
      </h3>
      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}

const features = [
  {
    size: "lg" as const,
    icon: <Bot className="w-5 h-5" />,
    title: "AI Career Coach",
    description:
      "Kak bukan cuma bikin CV. Dia bisa jawab pertanyaan karir, simulasi wawancara, dan kasih saran karir yang personal.",
    gradient: true,
  },
  {
    size: "sm" as const,
    icon: <ScanSearch className="w-5 h-5" />,
    title: "ATS Check Otomatis",
    description:
      "Scan real-time. Tahu persis di mana CV-mu kurang keywords-nya.",
  },
  {
    size: "sm" as const,
    icon: <FileText className="w-5 h-5" />,
    title: "20+ Template ATS",
    description:
      "Desain modern yang tetap terbaca ATS. Bukan template cantik tapi kosong.",
  },
  {
    size: "sm" as const,
    icon: <MessageCircle className="w-5 h-5" />,
    title: "Chat ke WhatsApp",
    description:
      "Bikin CV lewat WhatsApp tanpa buka web. Canggih tapi tetap low-tech friendly.",
  },
  {
    size: "sm" as const,
    icon: <Globe className="w-5 h-5" />,
    title: "Export ke PDF/DOCX",
    description:
      "Download dalam format apapun. Siap attach di email atau portal kerja.",
  },
  {
    size: "sm" as const,
    icon: <Zap className="w-5 h-5" />,
    title: "5 Menit Selesai",
    description:
      "Ngobrol 5 menit, CV siap. Bikin 10 versi CV dalam sehari tanpa capek.",
  },
  {
    size: "sm" as const,
    icon: <Shield className="w-5 h-5" />,
    title: "Data Aman",
    description:
      "Data lo dienkripsi. Lo pegang kendali penuh — hapus kapan aja.",
  },
];

export function Features() {
  return (
    <section id="features" className="relative py-[clamp(64px,10vw,128px)] bg-[var(--color-bg)]">
      <div className="mx-auto max-w-[1280px] px-[clamp(16px,5vw,64px)]">
        <SectionHeader
          tag="Fitur"
          title="Lebih dari sekadar"
          highlight="pembuat CV"
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5"
        >
          {features.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
