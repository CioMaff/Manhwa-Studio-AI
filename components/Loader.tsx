
import React from 'react';

export const Loader = ({ message }: { message: string }) => {
  return (
    <div className="absolute inset-0 bg-gray-900 bg-opacity-75 flex flex-col items-center justify-center z-50">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500"></div>
      <p className="mt-4 text-lg text-gray-300">{message}</p>
    </div>
  );
};
