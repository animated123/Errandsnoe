import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
}

export default function LoadingSpinner({ size = 24, color = '#000000' }: LoadingSpinnerProps) {
  return (
    <div className="flex items-center justify-center">
      <Loader2 size={size} color={color} className="animate-spin" />
    </div>
  );
}
