import React, { useState, useCallback, useId } from 'react';
import { Search, X } from 'lucide-react';
import { debounce } from '../../lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search bounties...',
  className = '',
  debounceMs = 150,
}: SearchBarProps) {
  const [inputValue, setInputValue] = useState(value);
  const inputId = useId();
  const descriptionId = useId();

  // Debounce the onChange callback for performance
  const debouncedOnChange = useCallback(
    debounce((newValue: string) => {
      onChange(newValue);
    }, debounceMs),
    [onChange, debounceMs]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    debouncedOnChange(newValue);
  };

  const handleClear = () => {
    setInputValue('');
    onChange('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleClear();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative flex items-center">
        <Search
          className="absolute left-3 w-4 h-4 text-text-muted pointer-events-none"
          aria-hidden="true"
        />
        <input
          id={inputId}
          type="text"
          role="searchbox"
          aria-label="Search bounties"
          aria-describedby={descriptionId}
          aria-autocomplete="list"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2.5 bg-forge-800 border border-border rounded-lg
                     text-text-primary placeholder:text-text-muted
                     focus:border-emerald focus:outline-none focus:ring-1 focus:ring-emerald/30
                     transition-all duration-200
                     text-sm md:text-base"
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 p-1 rounded-md
                       text-text-muted hover:text-text-primary hover:bg-forge-700
                       transition-colors duration-150
                       focus:outline-none focus:ring-2 focus:ring-emerald/50"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <span id={descriptionId} className="sr-only">
        Type to search bounties by title or description. Press Escape to clear.
      </span>
    </div>
  );
}
