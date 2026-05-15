'use client'

import { useState, useEffect, useRef } from 'react'

interface BountySearchProps {
  onSearch: (query: string) => void
  placeholder?: string
  className?: string
}

export function BountySearch({ onSearch, placeholder = 'Search bounties...', className = '' }: BountySearchProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce: 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  // Trigger search on debounced change
  useEffect(() => {
    onSearch(debouncedQuery)
  }, [debouncedQuery, onSearch])

  const handleClear = () => {
    setQuery('')
    inputRef.current?.focus()
  }

  // Keyboard shortcut: / to focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        inputRef.current?.blur()
        handleClear()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
      />
      {query && (
        <button
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Clear search"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      {!query && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">/</kbd>
        </div>
      )}
    </div>
  )
}
