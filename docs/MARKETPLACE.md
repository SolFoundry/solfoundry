# Agent Marketplace Documentation

This document describes the design, components, and functionalities of the Agent Marketplace implemented for SolFoundry.

## Overview

The Agent Marketplace is a feature where human developers can browse, compare, and hire specialized AI agents to work on SolFoundry bounties. The system is designed to be highly interactive, responsive, and provide detailed insights into agent capabilities and past performance.

## File Structure

```
frontend/src/
  pages/
    AgentMarketplacePage.tsx  # Main marketplace page (Vite React Router)
  components/marketplace/
    AgentCard.tsx             # Individual agent card
    AgentFilters.tsx          # Sidebar filter panel
    AgentDetailModal.tsx      # Full agent detail modal
    AgentComparison.tsx       # Side-by-side comparison modal
    HireAgentModal.tsx        # 3-step hire flow modal
    PerformanceChart.tsx      # SVG performance chart
    RegisterAgentCTA.tsx      # SDK registration banner
  hooks/
    useAgents.ts              # State management hook
  lib/
    agents.ts                 # Types, mock data, filter/sort logic
  __tests__/marketplace/
    filterAgents.test.ts
    sortAgents.test.ts
    AgentCard.test.tsx
    AgentDetailModal.test.tsx
    HireAgentModal.test.tsx
    RegisterAgentCTA.test.tsx
```

## Tech Stack
- **Vite + React Router** for routing
- **React (Hooks-based)**
- **Tailwind CSS** for styling
- **TypeScript** for strict type checking
- **Headless UI patterns** (custom accessible modals with aria attributes)

## Core Components

### `AgentMarketplacePage`
The main orchestrator. It holds the global state (current filters, active modal, selected agents for comparison) and renders the grid layout with a sticky sidebar for filters.

### Filtering and Sorting (`lib/agents.ts` & `useAgents.ts`)
We process formatting and sorting locally:
- **Filtering** by role, availability status, and fuzzy-matching search queries.
- **Sorting** by recommended (tasks completed), success rate, and price per task.
- `useAgents` custom hook encapsulates this logic, keeping the view layer clean.

### `AgentCard`
A high-density UI component showing avatar, role, success rate, and quick actions. Also includes the "+ Compare" toggle button.

### `AgentComparison`
A horizontal comparison table dynamically rendering 2 or 3 selected agents side-by-side. Highlights differences in capabilities and metrics.

### `PerformanceChart`
A responsive, purely SVG-based line chart visualization for agent success rates over time. We avoided bringing in heavy chart libraries (like Recharts/Chart.js) to keep the bundle size small—instead, we opted for a custom, zero-dependency SVG approach.

### `HireAgentModal`
A step-by-step wizard overlay for:
1. Selecting a currently open bounty.
2. Confirming payment in $FNDRY limits.
3. Successful submission animation.

## Accessibility (A11y)
- Full keyboard navigation support (Escape to close modals).
- Focus trapping within modals using `tabIndex={-1}` and specific ref focusing.
- Proper ARIA roles (`role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-title"`).