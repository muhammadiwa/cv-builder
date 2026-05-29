import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ChatView } from '../ChatView';

// Mock next/navigation
vi.mock('next/navigation', () => ({
    useRouter: () => ({ back: vi.fn() }),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        article: ({ children, ...props }: any) => {
            const { initial, animate, transition, ...rest } = props;
            return <article {...rest}>{children}</article>;
        },
        div: ({ children, ...props }: any) => {
            const { initial, animate, exit, transition, ...rest } = props;
            return <div {...rest}>{children}</div>;
        },
        span: ({ children, ...props }: any) => {
            const { animate, transition, ...rest } = props;
            return <span {...rest}>{children}</span>;
        },
        button: ({ children, ...props }: any) => {
            const { initial, animate, transition, ...rest } = props;
            return <button {...rest}>{children}</button>;
        },
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useReducedMotion: () => false,
}));

describe('ChatView', () => {
    it('renders shell with accessible chat log and input controls', () => {
        render(<ChatView />);

        const log = screen.getByRole('log');
        expect(log).toHaveAttribute('aria-label', 'Percakapan dengan Kak');

        expect(screen.getByLabelText('Pesan untuk Kak')).toBeInTheDocument();
        expect(screen.getByLabelText('Rekam suara')).toBeInTheDocument();
        expect(screen.getByLabelText('Kirim pesan')).toBeInTheDocument();
    });

    it('streams Kak first message and shows suggested chips when complete', async () => {
        render(<ChatView />);

        // Streaming complete is signaled by chips rendering (set in onComplete callback).
        // Asserting the chip implies the full message was streamed too.
        await waitFor(
            () => {
                expect(
                    screen.getByRole('button', { name: 'Teknik Informatika' })
                ).toBeInTheDocument();
            },
            { timeout: 5000 }
        );

        expect(screen.getByText(/kamu lulusan apa/)).toBeInTheDocument();
    }, 7000);

    it('lets user send a message and shows typing indicator afterwards', async () => {
        const user = userEvent.setup();
        render(<ChatView />);

        // Wait for streaming to fully complete (input is disabled during stream)
        await waitFor(
            () => {
                expect(
                    screen.getByRole('button', { name: 'Teknik Informatika' })
                ).toBeInTheDocument();
            },
            { timeout: 5000 }
        );

        const input = screen.getByLabelText('Pesan untuk Kak');
        await user.type(input, 'Test');

        const sendBtn = screen.getByLabelText('Kirim pesan');
        await user.click(sendBtn);

        // User bubble appears (disambiguate from chip via the <p> selector)
        expect(screen.getByText('Test', { selector: 'p' })).toBeInTheDocument();

        // Typing indicator appears within the 1-2s reply delay
        await waitFor(
            () => {
                expect(screen.getByRole('status')).toBeInTheDocument();
            },
            { timeout: 3000 }
        );
    }, 10000);
});
