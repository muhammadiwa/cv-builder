import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatBubble } from '../ChatBubble';
import type { Message } from '../types';

vi.mock('framer-motion', () => ({
    motion: {
        article: ({ children, ...props }: any) => {
            const { initial, animate, transition, ...rest } = props;
            return <article {...rest}>{children}</article>;
        },
    },
    useReducedMotion: () => false,
}));

const kakMessage: Message = {
    id: 'msg_1',
    role: 'assistant',
    content: 'Halo! Aku Kak.',
    timestamp: 1716900000000,
    streaming: false,
};

const userMessage: Message = {
    id: 'msg_2',
    role: 'user',
    content: 'Teknik Informatika',
    timestamp: 1716900060000,
    streaming: false,
};

describe('ChatBubble', () => {
    it('renders Kak message left-aligned with correct styling', () => {
        const { container } = render(<ChatBubble message={kakMessage} />);

        const article = container.querySelector('article');
        expect(article).toHaveClass('justify-start');

        const bubble = article?.querySelector('div');
        // AC-2 specifies 4px corner (rounded-tl), not 2px (rounded-tl-sm)
        expect(bubble?.className).toMatch(/\brounded-tl\b/);
        expect(bubble?.className).toContain('color-kak-bubble');
    });

    it('renders user message right-aligned with correct styling', () => {
        const { container } = render(<ChatBubble message={userMessage} />);

        const article = container.querySelector('article');
        expect(article).toHaveClass('justify-end');

        const bubble = article?.querySelector('div');
        // AC-2 specifies 4px corner (rounded-br), not 2px (rounded-br-sm)
        expect(bubble?.className).toMatch(/\brounded-br\b/);
        expect(bubble?.className).toContain('color-user-bubble');
    });

    it('displays message content', () => {
        render(<ChatBubble message={kakMessage} />);
        expect(screen.getByText('Halo! Aku Kak.')).toBeInTheDocument();
    });

    it('shows timestamp when not streaming', () => {
        render(<ChatBubble message={kakMessage} />);
        // Timestamp should be present (format depends on locale)
        const article = screen.getByRole('article');
        const timeEl = article.querySelector('span');
        expect(timeEl).toBeInTheDocument();
    });

    it('hides timestamp when streaming', () => {
        const streamingMsg: Message = { ...kakMessage, streaming: true };
        const { container } = render(<ChatBubble message={streamingMsg} />);

        // Only the message text span should exist, no timestamp span
        const spans = container.querySelectorAll('span');
        // No timestamp span with time format
        const timeSpans = Array.from(spans).filter((s) =>
            /\d{2}[.:]\d{2}/.test(s.textContent || '')
        );
        expect(timeSpans).toHaveLength(0);
    });
});
