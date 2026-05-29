'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { Message } from './types';

interface ChatBubbleProps {
    message: Message;
}

export function ChatBubble({ message }: ChatBubbleProps) {
    const prefersReduced = useReducedMotion();
    const isKak = message.role === 'assistant';

    const time = new Date(message.timestamp).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <motion.article
            initial={prefersReduced ? undefined : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            // Modern framer-motion springs require `bounce` to honor `duration`
            transition={{ type: 'spring', duration: 0.2, bounce: 0.25 }}
            className={`flex ${isKak ? 'justify-start' : 'justify-end'}`}
        >
            <div
                className={`
          relative max-w-[80%] px-4 py-2.5 text-sm leading-relaxed break-words
          ${isKak
                        ? 'bg-[hsl(var(--color-kak-bubble))] border border-[hsl(var(--color-kak-bubble-border))] rounded-2xl rounded-tl text-foreground'
                        : 'bg-[hsl(var(--color-user-bubble))] text-white rounded-2xl rounded-br ml-auto'
                    }
        `}
            >
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                {!message.streaming && (
                    <span
                        className={`block mt-1 text-[11px] text-right ${isKak ? 'text-muted-foreground' : 'text-white/70'
                            }`}
                    >
                        {time}
                    </span>
                )}
            </div>
        </motion.article>
    );
}
