'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ChatHeader } from './ChatHeader';
import { ChatBubble } from './ChatBubble';
import { TypingIndicator } from './TypingIndicator';
import { SuggestedChips } from './SuggestedChips';
import { ChatInput } from './ChatInput';
import { TYPING_LABELS } from './types';
import type { Message } from './types';

const FIRST_MESSAGE =
    'Halo! Aku Kak, asisten karirmu. Yuk kita bikin CV bareng. Ceritain dikit ya — kamu lulusan apa?';

const MOCK_RESPONSES: { text: string; chips: string[] }[] = [
    {
        text: 'Wah keren! Terus sekarang kamu kerja di bidang apa? Atau lagi cari kerja di bidang tertentu?',
        chips: ['Software Engineer', 'Data Analyst', 'Lagi cari kerja'],
    },
    {
        text: 'Oke noted! Sekarang ceritain pengalaman kerja kamu yang paling relevan dong. Posisi apa, di mana, dan berapa lama?',
        chips: ['Belum punya pengalaman', 'Magang 6 bulan', 'Kerja 2 tahun'],
    },
    {
        text: 'Bagus banget! Nanti kita susun jadi CV yang rapi. Ada skill teknis apa aja yang kamu kuasai?',
        chips: ['JavaScript & React', 'Python & ML', 'Desain UI/UX'],
    },
];

function generateId() {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ChatView() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [typingLabel, setTypingLabel] = useState(TYPING_LABELS[0]);
    const [chips, setChips] = useState<string[]>([]);
    const [responseIndex, setResponseIndex] = useState(0);

    const scrollRef = useRef<HTMLDivElement>(null);
    const isNearBottomRef = useRef(true);

    // Auto-scroll logic
    const scrollToBottom = useCallback(() => {
        if (!scrollRef.current || !isNearBottomRef.current) return;
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, []);

    const handleScroll = useCallback(() => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping, scrollToBottom]);

    // Stream text character by character at ~40 chars/sec
    const streamMessage = useCallback(
        (text: string, onComplete?: () => void) => {
            const id = generateId();
            const msg: Message = {
                id,
                role: 'assistant',
                content: '',
                timestamp: Date.now(),
                streaming: true,
            };

            setMessages((prev) => [...prev, msg]);

            let charIndex = 0;
            const interval = setInterval(() => {
                charIndex++;
                const content = text.slice(0, charIndex);

                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === id
                            ? { ...m, content, streaming: charIndex < text.length }
                            : m
                    )
                );

                if (charIndex >= text.length) {
                    clearInterval(interval);
                    onComplete?.();
                }
            }, 25); // ~40 chars/sec
        },
        []
    );

    // Initial message on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            streamMessage(FIRST_MESSAGE, () => {
                setChips(['Teknik Informatika', 'Manajemen', 'Desain Komunikasi Visual']);
            });
        }, 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Handle user sending a message
    const handleSend = useCallback(
        (text: string) => {
            const userMsg: Message = {
                id: generateId(),
                role: 'user',
                content: text,
                timestamp: Date.now(),
            };

            setMessages((prev) => [...prev, userMsg]);
            setChips([]);

            // Show typing indicator
            setIsTyping(true);
            setTypingLabel(TYPING_LABELS[responseIndex % TYPING_LABELS.length]);

            const delay = 1000 + Math.random() * 1000; // 1-2s

            setTimeout(() => {
                setIsTyping(false);
                const response = MOCK_RESPONSES[responseIndex % MOCK_RESPONSES.length];
                streamMessage(response.text, () => {
                    setChips(response.chips);
                });
                setResponseIndex((i) => i + 1);
            }, delay);
        },
        [responseIndex, streamMessage]
    );

    const handleChipSelect = useCallback(
        (chip: string) => {
            handleSend(chip);
        },
        [handleSend]
    );

    return (
        <>
            <ChatHeader />

            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-none"
                role="log"
                aria-label="Percakapan dengan Kak"
            >
                {messages.map((msg) => (
                    <ChatBubble key={msg.id} message={msg} />
                ))}

                <AnimatePresence>
                    {isTyping && <TypingIndicator label={typingLabel} />}
                </AnimatePresence>

                {chips.length > 0 && !isTyping && (
                    <SuggestedChips chips={chips} onSelect={handleChipSelect} />
                )}
            </div>

            <ChatInput onSend={handleSend} disabled={isTyping} />
        </>
    );
}
