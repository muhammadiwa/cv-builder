'use client';

import { ChatView } from '@/components/chat/ChatView';

export default function InterviewPage() {
    return (
        <div className="fixed inset-0 flex flex-col bg-background">
            <ChatView />
        </div>
    );
}
