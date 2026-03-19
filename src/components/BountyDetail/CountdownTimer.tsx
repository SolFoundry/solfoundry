import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
  deadline: string | Date;
  className?: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ deadline, className = '' }) => {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const deadlineTime = new Date(deadline).getTime();
      const difference = deadlineTime - now;

      if (difference <= 0) {
        setIsExpired(true);
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeRemaining({ days, hours, minutes, seconds });
      setIsExpired(false);
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  if (isExpired) {
    return (
      <div className={`text-red-500 font-semibold ${className}`}>
        Expired
      </div>
    );
  }

  const formatNumber = (num: number): string => {
    return num.toString().padStart(2, '0');
  };

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className="flex items-center gap-1">
        <div className="bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 min-w-[40px] text-center">
          <span className="text-lg font-mono font-bold">
            {formatNumber(timeRemaining.days)}
          </span>
        </div>
        <span className="text-sm text-gray-500">days</span>
      </div>
      
      <div className="flex items-center gap-1">
        <div className="bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 min-w-[40px] text-center">
          <span className="text-lg font-mono font-bold">
            {formatNumber(timeRemaining.hours)}
          </span>
        </div>
        <span className="text-sm text-gray-500">hrs</span>
      </div>
      
      <div className="flex items-center gap-1">
        <div className="bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 min-w-[40px] text-center">
          <span className="text-lg font-mono font-bold">
            {formatNumber(timeRemaining.minutes)}
          </span>
        </div>
        <span className="text-sm text-gray-500">min</span>
      </div>
      
      <div className="flex items-center gap-1">
        <div className="bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 min-w-[40px] text-center">
          <span className="text-lg font-mono font-bold">
            {formatNumber(timeRemaining.seconds)}
          </span>
        </div>
        <span className="text-sm text-gray-500">sec</span>
      </div>
    </div>
  );
};

export default CountdownTimer;