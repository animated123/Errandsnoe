
import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
  color?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 20, className = "", color = "currentColor" }) => {
  return (
    <Loader2 
      size={size} 
      className={`animate-spin ${className}`} 
      style={{ color }}
    />
  );
};

export default LoadingSpinner;
