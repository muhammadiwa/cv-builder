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

const MOCK_RESPONSES = [
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
] as const;

function generateId() {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ChatView() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [typingLabel, setTypingLabel] = useState(TYPING_LABELS[0]);
    const [chips, setChips] = useState<string[]>([]);
    const [responseIndex, setResponseIndex] = useState(0);
    // Show typing indicator during the initial 500ms pre-stream delay
    // so AC-1 perceived latency stays under ~100ms.
    const [showInitialTyping, setShowInitialTyping] = useState(true);

    const scrollRef = useRef<HTMLDivElement>(null);
    const isNearBottomRef = useRef(true);
    // Track in-flight async work so we can cancel on unmount.
    const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const replyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Unified busy gate — guards both typing-indicator and streaming phases
    const isBusy = isTyping || isStreaming;

    // Auto-scroll: only follow if user is near the bottom of the transcript.
    const scrollToBottom = useCallback(() => {
        if (!scrollRef.current || !isNearBottomRef.current) return;
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, []);

    const recomputeNearBottom = useCallback(() => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping, isStreaming, scrollToBottom]);

    // Recompute near-bottom on viewport resize (keyboard open/close on iOS),
    // not just on user scroll — otherwise auto-scroll stalls after the keyboard pops.
    useEffect(() => {
        const viewport = typeof window !== 'undefined' ? window.visualViewport : null;
        if (!viewport) return;
        const onResize = () => {
            recomputeNearBottom();
            scrollToBottom();
        };
        viewport.addEventListener('resize', onResize);
        return () => viewport.removeEventListener('resize', onResize);
    }, [recomputeNearBottom, scrollToBottom]);

    // Stream text character by character at ~40 chars/sec
    const streamMessage = useCallback(
        (text: string, onComplete?: () => void) => {
            setIsStreaming(true);
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
                    streamIntervalRef.current = null;
                    setIsStreaming(false);
                    onComplete?.();
                }
            }, 25);

            streamIntervalRef.current = interval;
        },
        []
    );

    // Initial message on mount.
    // Show typing indicator during the 500ms pre-stream delay so AC-1 has visible feedback.
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowInitialTyping(false);
            streamMessage(FIRST_MESSAGE, () => {
                setChips(['Teknik Informatika', 'Manajemen', 'Desain Komunikasi Visual']);
            });
        }, 500);

        return () => {
            clearTimeout(timer);
            // Cancel any in-flight async work to avoid setState-after-unmount and leaks
            if (streamIntervalRef.current) {
                clearInterval(streamIntervalRef.current);
                streamIntervalRef.current = null;
            }
            if (replyTimeoutRef.current) {
                clearTimeout(replyTimeoutRef.current);
                replyTimeoutRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Handle user sending a message
    const handleSend = useCallback(
        (text: string) => {
            // Guard against double-send during typing indicator OR streaming
            if (isBusy) return;

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

            const timer = setTimeout(() => {
                setIsTyping(false);
                const response = MOCK_RESPONSES[responseIndex % MOCK_RESPONSES.length];
                streamMessage(response.text, () => {
                    // Copy the readonly chip array so consumers can mutate freely
                    setChips([...response.chips]);
                });
                setResponseIndex((i) => i + 1);
                replyTimeoutRef.current = null;
            }, delay);

            replyTimeoutRef.current = timer;
        },
        [responseIndex, streamMessage, isBusy]
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
                onScroll={recomputeNearBottom}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-none"
                role="log"
                aria-live="polite"
                aria-atomic="false"
                aria-relevant="additions"
                aria-label="Percakapan dengan Kak"
            >
                {messages.map((msg) => (
                    <ChatBubble key={msg.id} message={msg} />
                ))}

                <AnimatePresence>
                    {(isTyping || showInitialTyping) && (
                        <TypingIndicator label={typingLabel} />
                    )}
                </AnimatePresence>
            </div>

            {/* Chips live OUTSIDE the role="log" so screen readers don't read them as transcript */}
            {chips.length > 0 && !isBusy && (
                <SuggestedChips chips={chips} onSelect={handleChipSelect} />
            )}

            <ChatInput onSend={handleSend} disabled={isBusy} />
        </>
    );
}
