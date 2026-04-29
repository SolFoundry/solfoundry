# SolFoundry Search Bar Component

**SolFoundry T1 — Search Bar for Bounties Page**

A React component that provides a real-time, debounced search experience for filtering bounties by title, description, and tags.

## Quick Start

```tsx
import { SearchBar } from './components/SearchBar';

function BountiesPage() {
  return (
    <SearchBar
      bounties={bounties}
      onSelect={(bounty) => navigate(`/bounties/${bounty.id}`)}
    />
  );
}
```

## Features

- **Debounced search**: 300ms debounce prevents excessive re-renders during typing
- **Client-side filtering**: Searches across title, description, and tags simultaneously
- **Search highlighting**: Matching text is highlighted with `<mark>` elements
- **Clear/reset**: One-click clear button + Escape key support
- **Responsive design**: Works on mobile and desktop with Tailwind CSS
- **Accessible**: Full ARIA labels, keyboard navigation, screen reader support
- **Zero new dependencies**: Uses only React hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`)
- **Type-safe**: Complete TypeScript interfaces for all props and return values

## Project Structure

```
solfoundry-t1/
├── hooks/
│   └── useSearch.ts              # Custom hook: debounce, filter, highlight
├── components/
│   ├── SearchBar.tsx             # Main composite component
│   ├── SearchInput.tsx           # Input sub-component with clear button
│   ├── SearchResults.tsx         # Results display with highlighting
│   └── index.ts                  # Barrel exports
├── __tests__/
│   ├── useSearch.test.ts         # Hook tests (18 cases)
│   └── SearchBar.test.tsx        # Component tests (22 cases)
├── INTEGRATION.md                # Integration guide
└── README.md                     # This file
```

## API Reference

### SearchBar Component

| Prop | Type | Default | Description |
|---|---|---|---|
| `bounties` | `T[]` (extends `BountyItem`) | **required** | Array of bounty items to search |
| `onSelect` | `(bounty: T) => void` | `undefined` | Called when a result card is clicked |
| `debounceMs` | `number` | `300` | Debounce delay in milliseconds |
| `placeholder` | `string` | `"Search bounties by title, description, or tags..."` | Input placeholder |
| `className` | `string` | `""` | Additional CSS classes |
| `showResults` | `boolean` | `true` | Whether to render results inline |

### useSearch Hook

```ts
const {
  input,          // Current raw input value (updates on every keystroke)
  query,          // Debounced search query (used for filtering)
  results,        // Filtered bounty array
  isSearching,    // Boolean: true when query is non-empty
  resultCount,    // Number of filtered results
  setQuery,       // Update the input value
  clearSearch,    // Reset input and query to empty
  highlightText,  // (text: string) => HighlightPart[] for rendering
} = useSearch(bounties, debounceMs?);
```

### BountyItem Interface

```ts
interface BountyItem {
  id: string | number;
  title: string;
  description: string;
  tags: string[];
}
```

### SearchInput Component

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `string` | **required** | Current input value |
| `onChange` | `(value: string) => void` | **required** | Called on every keystroke |
| `onClear` | `() => void` | **required** | Called when clear button is clicked |
| `placeholder` | `string` | `"Search bounties..."` | Input placeholder |
| `className` | `string` | `""` | Additional CSS classes |
| `inputId` | `string` | `"solfoundry-search-input"` | HTML id for the input |

### SearchResults Component

| Prop | Type | Default | Description |
|---|---|---|---|
| `results` | `T[]` | **required** | Filtered bounty array |
| `highlightText` | `(text: string) => HighlightPart[]` | **required** | Text highlighting function |
| `isSearching` | `boolean` | **required** | Whether search is active |
| `resultCount` | `number` | **required** | Total result count |
| `onSelect` | `(bounty: T) => void` | `undefined` | Click handler for result cards |
| `className` | `string` | `""` | Additional CSS classes |

## Design Decisions

1. **Separate hook and components**: The `useSearch` hook is independent, allowing the search logic to be reused in custom implementations (e.g., a search modal or autocomplete dropdown).

2. **Debounced input**: The `input` state updates immediately for responsive UX, while the `query` state (used for filtering) debounces by 300ms to prevent excessive re-renders.

3. **Client-side only**: Filtering runs entirely on the client using `useMemo`. No API calls are made during search.

4. **Tailwind-native styling**: Uses existing SolFoundry Tailwind color tokens (`text-text-muted`, `text-status-warning`) for consistent theming. Dark mode is supported via `dark:` variants.

5. **Accessibility-first**: Every interactive element has ARIA labels, the search region has `role="search"`, and a live region announces result counts to screen readers.

6. **Keyboard shortcuts**: `Ctrl/Cmd + K` focuses the search input; `Escape` clears the search.

## Dependencies

Uses existing SolFoundry dependencies:
- React (^18.3.1)
- Tailwind CSS (existing config)

No new dependencies are added.

## Testing

40 test cases covering all requirements:

**useSearch hook (18 tests):**
- Initial state (empty query, all results)
- Debounce timing (default 300ms, custom delay)
- Filtering by title, description, and tags
- Combined filtering across all fields
- No-results state
- Clear/reset functionality
- Text highlighting (exact match, case-insensitive, empty query)
- Edge cases (empty array, special regex chars, whitespace-only, rapid typing)
- Dynamic bounties array updates

**SearchBar component (22 tests):**
- Rendering with default/custom placeholders
- ARIA roles and labels
- Custom className passthrough
- Input interaction (typing, value updates)
- Clear button visibility and click behavior
- Debounced result display
- Filtered results rendering
- Result count (singular/plural)
- Text highlighting with `<mark>` elements
- No-results message
- Selection callback (`onSelect`)
- Accessibility (aria-label, aria-describedby, live region)
- Keyboard shortcuts (Escape to clear)
- `showResults` toggle
- Custom debounce delay

Run tests:
```bash
npm test -- --run
```
