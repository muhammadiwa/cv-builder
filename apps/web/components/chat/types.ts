export interface Message {
    id: string;
    role: 'assistant' | 'user';
    content: string;
    timestamp: number;
    streaming?: boolean;
}

export interface ChatState {
    messages: Message[];
    isTyping: boolean;
    typingLabel: string;
    suggestedChips: string[];
}

export type TypingLabel =
    | 'Membaca jawaban...'
    | 'Menyusun pengalaman...'
    | 'Menulis saran...';

export const TYPING_LABELS: TypingLabel[] = [
    'Membaca jawaban...',
    'Menyusun pengalaman...',
    'Menulis saran...',
];
