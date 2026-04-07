# SolFoundry Interactive Bounty Flow Diagram

A React-based interactive flow diagram component for visualizing the bounty lifecycle.

## Features

- **Interactive Nodes**: Click any node to see details
- **Animated Flow**: Smooth transitions between stages
- **Responsive Design**: Works on all screen sizes
- **Customizable**: Easy to modify colors and styles

## Installation

```bash
npm install @solfoundry/flow-diagram
```

## Usage

```jsx
import { BountyFlow } from '@solfoundry/flow-diagram';

function App() {
  return (
    <BountyFlow 
      onNodeClick={(node) => console.log(node)}
    />
  );
}
```

## Flow Stages

1. **Bounty Posted** - Initial bounty creation
2. **Developer Claims** - Developer takes bounty
3. **Work Submitted** - PR submitted for review
4. **Review** - Maintainer reviews code
5. **Approved** - Bounty approved
6. **Payment** - Automatic payment via Algora

## Props

| Prop | Type | Description |
|------|------|-------------|
| `onNodeClick` | function | Callback when node is clicked |
| `theme` | string | 'light' or 'dark' theme |

## License

MIT