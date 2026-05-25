"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useInView } from "framer-motion";
import { Send, ArrowRight } from "lucide-react";
import { SectionHeader } from "./section-header";

interface Message {
  role: "user" | "assistant";
  text: string;
  delay: number;
}

const messages: Message[] = [
  {
    role: "assistant",
    text: "Halo! Aku Kak, asisten karirmu. Ceritain sedikit tentang dirimu...",
    delay: 0.5,
  },
  {
    role: "user",
    text: "Halo Kak! Aku Rina, lulusan S1 Manajemen. Baru 1 tahun kerja di startup e-commerce sebagai social media specialist.",
    delay: 2.0,
  },
  {
    role: "assistant",
    text: "Wah, seru! Pengalaman yang relevan banget. Coba ceritain, achievement apa yang paling kamu banggakan waktu di startup itu?",
    delay: 4.0,
  },
  {
    role: "user",
    text: "Aku berhasil naikin engagement Instagram dari 2% ke 5.8% dalam 6 bulan, dan manage 3 campaign yang reach-nya 500k+.",
    delay: 6.0,
  },
  {
    role: "assistant",
    text: "Keren banget! Oke, CV-mu udah siap. Ini dia preview-nya...",
    delay: 8.5,
  },
];

function ChatMessage({ msg, index, visible }: { msg: Message; index: number; visible: boolean }) {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    if (!visible) {
      setDisplayedText("");
      setIsTyping(true);
      return;
    }

    const delayMs = msg.delay * 1000;
    const timeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayedText(msg.text.slice(0, i));
        if (i >= msg.text.length) {
          clearInterval(interval);
          setIsTyping(false);
        }
      }, 25);
    }, delayMs);

    return () => clearTimeout(timeout);
  }, [visible, msg]);

  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-3 max-w-[85%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : ""}`}
    >
      <div
        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          msg.role === "user"
            ? "bg-[var(--color-primary)] text-white rounded-tr-md"
            : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-tl-md"
        }`}
      >
        {displayedText}
        {isTyping && (
          <span className="inline-block w-1.5 h-4 ml-0.5 bg-current animate-typing-cursor" />
        )}
      </div>
    </motion.div>
  );
}

export function AiDemo() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: false, margin: "-100px" });
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!inView) {
      setShowPreview(false);
      return;
    }
    // Show CV preview after last message finishes
    const lastMsg = messages[messages.length - 1];
    const totalDelay = (lastMsg.delay + lastMsg.text.length * 0.025 + 1) * 1000;
    const timer = setTimeout(() => setShowPreview(true), totalDelay);
    return () => clearTimeout(timer);
  }, [inView]);

  return (
    <section ref={sectionRef} className="relative py-[clamp(64px,10vw,128px)] bg-[var(--color-bg)]">
      <div className="mx-auto max-w-[1280px] px-[clamp(16px,5vw,64px)]">
        <SectionHeader
          title="Cobain langsung —"
          highlight="gratis"
          description="Lihat gimana Kak ngobrol sama Rina dan bikin CV ATS-friendly dalam 5 menit."
        />

        <div className="max-w-2xl mx-auto">
          {/* Chat window */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <div className="w-10 h-10 rounded-full bg-gradient-card flex items-center justify-center text-white font-bold text-sm">
                K
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-[var(--color-text-primary)]">
                  Kak — AI Career Assistant
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)]">Online</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-pulse" />
            </div>

            {/* Messages */}
            <div className="p-5 sm:p-6 space-y-4 min-h-[400px] max-h-[520px] overflow-y-auto">
              {messages.map((msg, i) => (
                <ChatMessage
                  key={i}
                  msg={msg}
                  index={i}
                  visible={inView}
                />
              ))}

              {/* CV Preview */}
              <AnimatePresence>
                {showPreview && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-card" />
                        <div>
                          <div className="h-3 w-28 bg-[var(--color-bg-tertiary)] rounded mb-1" />
                          <div className="h-2 w-20 bg-[var(--color-bg-tertiary)] rounded" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-2 w-full bg-[var(--color-bg-tertiary)] rounded" />
                        <div className="h-2 w-5/6 bg-[var(--color-bg-tertiary)] rounded" />
                        <div className="h-2 w-4/5 bg-[var(--color-bg-tertiary)] rounded" />
                      </div>
                      <div className="mt-3 flex gap-2">
                        <div className="h-6 px-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          ATS Score: 91%
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Input bar */}
            <div className="flex items-center gap-3 px-5 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <div className="flex-1 h-10 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] px-4 flex items-center text-sm text-[var(--color-text-tertiary)]">
                Ketik pesan...
              </div>
              <button className="w-10 h-10 rounded-lg bg-[var(--color-primary)] flex items-center justify-center text-white">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-10 text-center"
          >
            <button className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[var(--color-primary)] text-white font-semibold text-base hover:bg-[var(--color-primary-hover)] shadow-lg transition-all duration-300">
              Coba sendiri — gratis!
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
