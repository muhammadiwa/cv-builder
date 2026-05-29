'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Mic, CornerDownLeft } from 'lucide-react';

interface ChatInputProps {
    onSend: (text: string) => void;
    disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
    const [text, setText] = useState('');
    // Local state — replaces the documentElement CSS variable so the offset
    // doesn't leak across routes and is scoped to this input row.
    const [keyboardOffset, setKeyboardOffset] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const sendingRef = useRef(false);

    const handleSend = useCallback(() => {
        // Guard against double-submit (rapid Enter / double-click)
        if (sendingRef.current) return;
        const trimmed = text.trim();
        if (!trimmed || disabled) return;
        sendingRef.current = true;
        // Clear synchronously so the disabled gate flips before any second event fires
        setText('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
        onSend(trimmed);
        // Release the lock on the next tick so React has rendered the cleared input
        queueMicrotask(() => {
            sendingRef.current = false;
        });
    }, [text, disabled, onSend]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Guard against IME composition (Indonesian autocorrect, CJK, mobile predictive bar)
        // keyCode 229 is the legacy IME-active marker; isComposing is the modern one
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
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

    // iOS keyboard handling via visualViewport — push input row above the soft keyboard.
    // Heuristic: only treat the shrink as a keyboard event if the textarea is focused
    // AND the viewport shrank below ~85% of innerHeight. This filters out pinch-zoom,
    // URL/toolbar collapse, and orientation changes.
    useEffect(() => {
        const viewport = typeof window !== 'undefined' ? window.visualViewport : null;
        if (!viewport) return;

        const handleResize = () => {
            const ta = textareaRef.current;
            const focused =
                typeof document !== 'undefined' && document.activeElement === ta;
            const offset = window.innerHeight - viewport.height;
            const isLikelyKeyboard =
                focused &&
                offset > 100 &&
                viewport.height < window.innerHeight * 0.85;
            setKeyboardOffset(isLikelyKeyboard ? offset : 0);
        };

        // Seed on mount so the first paint reflects the current viewport state,
        // and recompute on tab return / bfcache restore.
        handleResize();

        viewport.addEventListener('resize', handleResize);
        document.addEventListener('visibilitychange', handleResize);
        window.addEventListener('pageshow', handleResize);

        return () => {
            viewport.removeEventListener('resize', handleResize);
            document.removeEventListener('visibilitychange', handleResize);
            window.removeEventListener('pageshow', handleResize);
        };
    }, []);

    return (
        <div
            className="flex items-end gap-2 px-4 py-3 border-t border-border bg-card/80 backdrop-blur-sm"
            style={{
                // Apply visualViewport offset on top of the iOS safe area inset
                paddingBottom: `calc(max(0.75rem, env(safe-area-inset-bottom)) + ${keyboardOffset}px)`,
            }}
        >
            <button
                type="button"
                className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Rekam suara"
                title="Segera hadir"
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
                className={`p-2 rounded-full transition-colors focus-ring ${text.trim() && !disabled
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'text-muted-foreground'
                    }`}
                aria-label="Kirim pesan"
            >
                <CornerDownLeft className="w-5 h-5" />
            </button>
        </div>
    );
}
