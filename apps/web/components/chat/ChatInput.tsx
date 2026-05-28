'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Mic, SendHorizontal } from 'lucide-react';

interface ChatInputProps {
    onSend: (text: string) => void;
    disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
    const [text, setText] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSend = useCallback(() => {
        const trimmed = text.trim();
        if (!trimmed || disabled) return;
        onSend(trimmed);
        setText('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    }, [text, disabled, onSend]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Auto-resize textarea
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [text]);

    // iOS keyboard handling via visualViewport
    useEffect(() => {
        const viewport = window.visualViewport;
        if (!viewport) return;

        const handleResize = () => {
            const offset = window.innerHeight - viewport.height;
            document.documentElement.style.setProperty(
                '--keyboard-offset',
                `${offset}px`
            );
        };

        viewport.addEventListener('resize', handleResize);
        return () => viewport.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div
            className="flex items-end gap-2 px-4 py-3 border-t border-border bg-card/80 backdrop-blur-sm"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
            <button
                type="button"
                className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-ring"
                aria-label="Rekam suara"
                disabled
            >
                <Mic className="w-5 h-5" />
            </button>

            <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ketik pesan..."
                rows={1}
                disabled={disabled}
                className="flex-1 resize-none rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-ring"
                aria-label="Pesan untuk Kak"
            />

            <button
                type="button"
                onClick={handleSend}
                disabled={!text.trim() || disabled}
                className={`p-2 rounded-full transition-colors focus-ring ${text.trim()
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'text-muted-foreground'
                    }`}
                aria-label="Kirim pesan"
            >
                <SendHorizontal className="w-5 h-5" />
            </button>
        </div>
    );
}
