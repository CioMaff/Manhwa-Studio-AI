
import React from 'react';

export const BrainCircuitIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 5a3 3 0 1 0-5.997.474A1 1 0 0 0 5 6v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1" />
    <path d="M12 5a3 3 0 1 1 5.997.474A1 1 0 0 1 19 6v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1" />
    <path d="M12 19a3 3 0 1 0-5.997.474A1 1 0 0 0 5 20v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1" />
    <path d="M12 19a3 3 0 1 1 5.997.474A1 1 0 0 1 19 20v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1h1" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 9v-1" />
    <path d="M12 15v1" />
    <path d="M9 12H8" />
    <path d="M16 12h-1" />
  </svg>
);
