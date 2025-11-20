import React from 'react';

export const BugIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 20h-4a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v4" />
        <path d="M12 12h.01" />
        <path d="M16 12h.01" />
        <path d="M8 12h.01" />
        <path d="M12 8h.01" />
        <path d="M16 8h.01" />
        <path d="M8 8h.01" />
        <path d="m13 16-1 4-1-4" />
        <path d="m17 16-1 4-1-4" />
        <path d="m9 16-1 4-1-4" />
    </svg>
);