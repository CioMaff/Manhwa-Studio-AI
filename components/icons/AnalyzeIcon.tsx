import React from 'react';

export const AnalyzeIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M15.5 15.5L21 21" />
        <path d="M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14z" />
        <rect x="7" y="7" width="6" height="6" rx="1" />
    </svg>
);