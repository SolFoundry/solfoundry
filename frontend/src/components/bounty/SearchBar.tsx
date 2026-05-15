import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  suggestions?: string[];
  className?: string;
}

export function SearchBar({ placeholder = 'Search bounties...', onSearch, suggestions = [], className = '' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (query.length > 0 && suggestions.length > 0) {
      setFilteredSuggestions(suggestions.filter(s => s.toLowerCase().includes(query.toLowerCase())).slice(0, 5));
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [query, suggestions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
    setShowSuggestions(false);
  };

  const selectSuggestion = (s: string) => {
    setQuery(s);
    onSearch(s);
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className={'relative ' + className}>
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-forge-900 border border-border rounded-lg pl-10 pr-10 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-emerald/50 focus:ring-1 focus:ring-emerald/20 transition-colors"
        />
        {query && (
          <button type="button" onClick={() => { setQuery(''); onSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
            <X className="w-4 h-4" />
          </button>
        )}
      </form>
      <AnimatePresence>
        {showSuggestions && filteredSuggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full mt-1 w-full bg-forge-900 border border-border rounded-lg shadow-lg z-50 overflow-hidden"
          >
            {filteredSuggestions.map((s) => (
              <button key={s} onClick={() => selectSuggestion(s)} className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-forge-800 hover:text-text-primary transition-colors">
                {s}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}