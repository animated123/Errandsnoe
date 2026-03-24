import React from 'react';

interface TopProgressBarProps {
  isLoading: boolean;
}

export default function TopProgressBar({ isLoading }: TopProgressBarProps) {
  return (
    <div className={`fixed top-0 left-0 right-0 z-[100] h-1 bg-indigo-50 transition-all duration-300 ${isLoading ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`h-full bg-indigo-600 transition-all duration-300 ${isLoading ? 'w-full' : 'w-0'}`} />
    </div>
  );
}
