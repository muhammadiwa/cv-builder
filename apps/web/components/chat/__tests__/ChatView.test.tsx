import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    it('renders chat area with correct accessibility attributes', () => {
        render(<ChatView />);

        const log = screen.getByRole('log');
        expect(log).toHaveAttribute('aria-label', 'Percakapan dengan Kak');
    });

    it('streams Kak first message after page load', async () => {
        render(<ChatView />);

        // Wait for the streaming to start and show some content
        await waitFor(
            () => {
                expect(screen.getByText(/Halo/)).toBeInTheDocument();
            },
            { timeout: 3000 }
        );
    });

    it('shows full first message after streaming completes', async () => {
        render(<ChatView />);

        // Full message is ~95 chars at 25ms/char = ~2.4s + 500ms delay
        await waitFor(
            () => {
                expect(screen.getByText(/kamu lulusan apa/)).toBeInTheDocument();
            },
            { timeout: 5000 }
        );
    });

    it('allows user to send a message', async () => {
        const user = userEvent.setup();
        render(<ChatView />);

        // Wait for first message to finish streaming
        await waitFor(
            () => {
                expect(screen.getByText(/kamu lulusan apa/)).toBeInTheDocument();
            },
            { timeout: 5000 }
        );

        const input = screen.getByLabelText('Pesan untuk Kak');
        await user.type(input, 'Teknik Informatika');

        const sendBtn = screen.getByLabelText('Kirim pesan');
        await user.click(sendBtn);

        expect(screen.getByText('Teknik Informatika')).toBeInTheDocument();
    }, 10000);

    it('shows typing indicator after user sends message', async () => {
        const user = userEvent.setup();
        render(<ChatView />);

        // Wait for first message
        await waitFor(
            () => {
                expect(screen.getByText(/kamu lulusan apa/)).toBeInTheDocument();
            },
            { timeout: 5000 }
        );

        const input = screen.getByLabelText('Pesan untuk Kak');
        await user.type(input, 'Test');

        const sendBtn = screen.getByLabelText('Kirim pesan');
        await user.click(sendBtn);

        // Typing indicator should appear
        await waitFor(() => {
            expect(screen.getByRole('status')).toBeInTheDocument();
        });
    }, 10000);

    it('renders input area with voice and send buttons', () => {
        render(<ChatView />);

        expect(screen.getByLabelText('Pesan untuk Kak')).toBeInTheDocument();
        expect(screen.getByLabelText('Rekam suara')).toBeInTheDocument();
        expect(screen.getByLabelText('Kirim pesan')).toBeInTheDocument();
    });
});
