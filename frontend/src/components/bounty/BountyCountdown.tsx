import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface BountyCountdownProps {
  deadlineStr: string;
}

export const BountyCountdown: React.FC<BountyCountdownProps> = ({ deadlineStr }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [colorClass, setColorClass] = useState('text-text-muted');

  useEffect(() => {
    const updateCountdown = () => {
      if (!deadlineStr) {
        setTimeLeft('');
        return;
      }
      const deadline = new Date(deadlineStr).getTime();
      const now = new Date().getTime();
      const diff = deadline - now;
      
      if (diff <= 0) {
        setTimeLeft('Expired');
        setColorClass('text-rose-500 font-bold'); // Urgent/Expired color
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      // Determine color based on requirements
      if (diff < 1000 * 60 * 60) {
        // Less than 1 hour (urgent)
        setColorClass('text-rose-500 font-bold');
      } else if (diff < 1000 * 60 * 60 * 24) {
        // Less than 24 hours (warning)
        setColorClass('text-amber-500 font-semibold');
      } else {
        setColorClass('text-text-muted');
      }

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`${minutes}m`);
      }
    };

    updateCountdown(); // initial call
    const interval = setInterval(updateCountdown, 60000); // update every minute
    return () => clearInterval(interval);
  }, [deadlineStr]);

  if (!timeLeft) return null;

  return (
    <span className={`inline-flex items-center gap-1 ${colorClass}`}>
      <Clock className="w-3.5 h-3.5" />
      {timeLeft}
    </span>
  );
};
