import React, { useState, useCallback, useId, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { debounce } from '../../lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
  autoFocus?: boolean;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search bounties...',
  className = '',
  debounceMs = 150,
  autoFocus = false,
}: SearchBarProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const inputId = useId();
  const descriptionId = useId();

  // Sync with external value changes (e.g., URL params)
  useEffect(() => {
    setInputValue(value);
  }, [value]);

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
    // Focus back on input after clearing
    const input = document.getElementById(inputId) as HTMLInputElement;
    input?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleClear();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div 
        className={`relative flex items-center transition-all duration-200 ${
          isFocused ? 'ring-2 ring-emerald/30' : ''
        }`}
      >
        <Search
          className={`absolute left-3 w-4 h-4 pointer-events-none transition-colors duration-200 ${
            isFocused ? 'text-emerald' : 'text-text-muted'
          }`}
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
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          className="w-full pl-10 pr-10 py-2.5 bg-forge-800 border border-border rounded-lg
                     text-text-primary placeholder:text-text-muted
                     focus:border-emerald focus:outline-none
                     transition-all duration-200
                     text-sm md:text-base"
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 p-1 rounded-md
                       text-text-muted hover:text-text-primary hover:bg-forge-700
                       transition-all duration-150
                       focus:outline-none focus:ring-2 focus:ring-emerald/50"
            aria-label="Clear search"
            title="Clear search (Esc)"
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
