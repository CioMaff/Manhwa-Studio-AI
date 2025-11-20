import React from 'react';

export const ScreenShareIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"></path>
        <line x1="16" y1="3" x2="21" y2="8"></line>
        <line x1="12" y1="12" x2="21" y2="3"></line>
    </svg>
);
