import React from 'react';

export const MagicWandIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 4V2" />
    <path d="M15 8V6" />
    <path d="M12.5 6.5L14 5" />
    <path d="M11 5L12.5 6.5" />
    <path d="m3 21 9-9" />
    <path d="M21 3l-9 9" />
    <path d="M18 10l-1.5 1.5" />
    <path d="M12 16l-1.5 1.5" />
  </svg>
);