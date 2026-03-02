
import React, { useEffect, useState } from 'react';

interface TopProgressBarProps {
  isLoading: boolean;
}

const TopProgressBar: React.FC<TopProgressBarProps> = ({ isLoading }) => {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let interval: number;

    if (isLoading) {
      setVisible(true);
      setProgress(10);
      interval = window.setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + (90 - prev) * 0.1;
        });
      }, 200);
    } else {
      setProgress(100);
      const timeout = window.setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
      return () => clearTimeout(timeout);
    }

    return () => clearInterval(interval);
  }, [isLoading]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-1 pointer-events-none">
      <div 
        className="h-full bg-indigo-600 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(79,70,229,0.5)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

export default TopProgressBar;
