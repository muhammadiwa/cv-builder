'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function ChatHeader() {
    const router = useRouter();

    const handleBack = () => {
        // Fallback to dashboard root when there's no history (deep-link entry)
        if (typeof window !== 'undefined' && window.history.length <= 1) {
            router.push('/');
            return;
        }
        router.back();
    };

    return (
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm">
            <button
                onClick={handleBack}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors focus-ring"
                aria-label="Kembali"
            >
                <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>

            <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm font-bold">
                    K
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-card" />
            </div>

            <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">Kak</span>
                <span className="text-xs text-muted-foreground">Asisten karir</span>
            </div>
        </header>
    );
}
