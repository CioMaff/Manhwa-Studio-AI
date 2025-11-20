import React from 'react';

export const WebcamIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="2" y="7" width="20" height="12" rx="2" ry="2"></rect>
        <circle cx="12" cy="13" r="3"></circle>
    </svg>
);
