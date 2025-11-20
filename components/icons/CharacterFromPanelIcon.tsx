import React from 'react';

export const CharacterFromPanelIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 2a5 5 0 0 0-5 5v2a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z" />
        <path d="M20 21a8 8 0 0 0-16 0" />
        <rect x="2" y="2" width="8" height="8" rx="1" />
        <line x1="6" y1="14" x2="6" y2="10" />
        <line x1="4" y1="12" x2="8" y2="12" />
    </svg>
);