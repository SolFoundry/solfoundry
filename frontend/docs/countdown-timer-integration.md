# Search Bar Component - Integration Guide

## Issue: SolFoundry T1 — Search Bar for Bounties Page

### Overview

This implementation provides a SearchBar component and useSearch hook that enables real-time, debounced client-side search across bounty titles, descriptions, and tags with text highlighting and full accessibility support.

### Requirements Met

| Requirement | Status | Details |
|---|---|---|
| Search bar on Bounties page | ✅ | `<SearchBar>` component with full UI |
| Real-time filtering (title, description, tags) | ✅ | Client-side filtering via `useSearch` hook |
| Debounced input (300ms) | ✅ | Prevents excessive re-renders |
| Clear/reset functionality | ✅ | Clear button + Escape key |
| Search result highlighting | ✅ | `<mark>` elements for matching text |
| Responsive design | ✅ | Mobile + desktop via Tailwind CSS |
| Accessibility (ARIA, keyboard) | ✅ | `role="search"`, aria-labels, live region, keyboard shortcuts |
| TypeScript types | ✅ | Full interfaces for all props and return values |
| Test coverage (≥10 cases) | ✅ | 40 test cases across 2 test files |
| Zero new dependencies | ✅ | Uses only React hooks |

### Files Created

```
solfoundry-t1/
├── hooks/
│   ├── useCountdown.ts              # [Existing] Countdown logic
│   └── useSearch.ts                 # [NEW] Search logic: debounce, filter, highlight
├── components/
│   ├── CountdownTimer.tsx           # [Existing] Countdown display
│   ├── SearchBar.tsx                # [NEW] Main composite search component
│   ├── SearchInput.tsx              # [NEW] Input sub-component
│   ├── SearchResults.tsx            # [NEW] Results display with highlighting
│   └── index.ts                     # [Updated] Barrel exports
├── __tests__/
│   ├── CountdownTimer.test.tsx      # [Existing] Countdown tests
│   ├── useSearch.test.ts            # [NEW] Hook tests (18 cases)
│   └── SearchBar.test.tsx           # [NEW] Component tests (22 cases)
├── INTEGRATION.md                   # This file
└── README.md                        # Component documentation
```

### Integration Steps

#### Step 1: Copy files to the project

From the solfoundry frontend directory:

```bash
cp hooks/useSearch.ts frontend/src/hooks/useSearch.ts
cp components/SearchBar.tsx frontend/src/components/bounty/SearchBar.tsx
cp components/SearchInput.tsx frontend/src/components/bounty/SearchInput.tsx
cp components/SearchResults.tsx frontend/src/components/bounty/SearchResults.tsx
cp __tests__/useSearch.test.ts frontend/src/__tests__/useSearch.test.ts
cp __tests__/SearchBar.test.tsx frontend/src/__tests__/SearchBar.test.tsx
```

#### Step 2: Add to BountiesPage.tsx

Add the SearchBar component at the top of the bounties list section.

Add import:
```tsx
import { SearchBar } from './SearchBar';
import type { BountyItem } from '../hooks/useSearch';
```

Ensure your bounty type extends `BountyItem`:
```tsx
interface Bounty extends BountyItem {
  id: number;
  title: string;
  description: string;
  tags: string[];
  // ... other bounty fields (reward, deadline, etc.)
}
```

Add the SearchBar above your bounty list:
```tsx
function BountiesPage() {
  const bounties: Bounty[] = useBounties(); // or however you fetch bounties

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-6">Bounties</h1>

      {/* Search Bar */}
      <div className="mb-6">
        <SearchBar
          bounties={bounties}
          onSelect={(bounty) => navigate(`/bounties/${bounty.id}`)}
          debounceMs={300}
        />
      </div>

      {/* Bounty List — uses filtered results from SearchBar's onSelect */}
      {/* ... existing bounty list code ... */}
    </div>
  );
}
```

#### Step 3: Alternative — Standalone filtering

If you need the filtered results outside the SearchBar (e.g., to drive a separate list component), use the `useSearch` hook directly:

```tsx
import { useSearch } from '../hooks/useSearch';

function BountiesPage() {
  const bounties: Bounty[] = useBounties();
  const { results, isSearching, resultCount, input, setQuery, clearSearch, highlightText } =
    useSearch(bounties, 300);

  return (
    <div>
      <SearchInput
        value={input}
        onChange={setQuery}
        onClear={clearSearch}
      />

      {isSearching && (
        <p>{resultCount} results found</p>
      )}

      {/* Use `results` to drive your existing list/grid */}
      {results.map((bounty) => (
        <BountyCard key={bounty.id} bounty={bounty} />
      ))}
    </div>
  );
}
```

### Component API

#### SearchBar Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `bounties` | `T[]` (extends `BountyItem`) | required | Array of bounty items |
| `onSelect` | `(bounty: T) => void` | undefined | Called when a result is clicked |
| `debounceMs` | `number` | 300 | Debounce delay in ms |
| `placeholder` | `string` | "Search bounties..." | Input placeholder |
| `className` | `string` | "" | Additional CSS classes |
| `showResults` | `boolean` | true | Show inline results |

#### useSearch Hook

```ts
const {
  input,
  query,
  results,
  isSearching,
  resultCount,
  setQuery,
  clearSearch,
  highlightText,
} = useSearch(bounties: T[], debounceMs?: number);
```

Returns:
- `input` — Raw input value (updates on every keystroke)
- `query` — Debounced query (used for filtering)
- `results` — Filtered bounty array
- `isSearching` — Boolean: true when query is non-empty
- `resultCount` — Number of results
- `setQuery` — Update input value
- `clearSearch` — Reset search
- `highlightText` — Text highlighting utility

### Accessibility Features

| Feature | Implementation |
|---|---|
| Search region | `role="search"` on wrapper |
| Input label | `aria-label="Search bounties by title, description, or tags"` |
| Input description | `aria-describedby` pointing to hidden hint text |
| Clear button | `aria-label="Clear search"` |
| Live region | `aria-live="polite"` announces result count changes |
| Result cards | `aria-label="Bounty: {title}"` on each card |
| No-results state | `role="status"` + `aria-live="polite"` |
| Keyboard shortcuts | `Ctrl/Cmd + K` to focus, `Escape` to clear |
| Focus management | Focus rings via `focus:ring-*` Tailwind classes |

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + K` / `Cmd + K` | Focus the search input |
| `Escape` | Clear the search and reset results |

### Testing

Run the test suite:

```bash
cd frontend
npm test -- useSearch.test.ts
npm test -- SearchBar.test.tsx
```

The test suite covers:
- Debounce timing accuracy
- Filtering by title, description, and tags
- Text highlighting (case-insensitive, special characters)
- Clear/reset functionality
- No-results state
- Selection callbacks
- Accessibility attributes (ARIA labels, live regions)
- Keyboard shortcuts
- Responsive design classes
- Edge cases (empty array, rapid typing, regex special chars)
