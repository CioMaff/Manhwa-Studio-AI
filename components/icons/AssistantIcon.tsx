import React from 'react';

export const AssistantIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 8V4H8" />
        <rect x="4" y="12" width="16" height="8" rx="2" />
        <path d="M8 12v-2a2 2 0 1 1 4 0v2" />
        <path d="M16 12v-2a2 2 0 0 0-4 0v2" />
        <path d="m12 16 1 2" />
        <path d="m16 16-1 2" />
        <path d="m8 16 1 2" />
    </svg>
);
