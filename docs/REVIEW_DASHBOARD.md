# Multi-LLM Review Dashboard with Appeal System

**Bounty:** #858 | **Tier:** T3 | **Reward:** 900K $FNDRY

## Overview

This feature implements a comprehensive review dashboard that displays AI code review scores from multiple LLM providers (Claude, Codex, Gemini) with consensus indicators and an appeal workflow for disputed submissions.

## Features

### 1. Multi-LLM Score Visualization
- Displays scores from Claude, Codex, and Gemini
- Color-coded score bars for each provider
- Detailed reasoning for each review
- Timestamp tracking

### 2. Consensus Indicators
- Average score calculation
- Agreement level classification (High/Medium/Low)
- Disagreement identification
- Score distribution visualization

### 3. Appeal Workflow
- Submit appeals for disputed reviews
- Human reviewer assignment
- Status tracking (Pending → Under Review → Resolved/Rejected)
- Complete history logging

## Architecture

### Frontend
- **React Components:** ReviewDashboard, ScoreVisualization, ConsensusIndicator, AppealWorkflow
- **API Service:** reviews.ts
- **Types:** review.ts

### Backend
- **FastAPI Routes:** api/reviews.py
- **Models:** models/review.py
- **Storage:** PostgreSQL (production) / In-memory (development)

## API Endpoints

### Review Dashboard
```
GET    /api/reviews/{submission_id}  - Get review dashboard
POST   /api/reviews                  - Create/update dashboard
```

### Appeals
```
POST   /api/appeals                  - Submit new appeal
GET    /api/appeals/{appeal_id}      - Get appeal details
PATCH  /api/appeals/{appeal_id}/status - Update appeal status
POST   /api/appeals/{appeal_id}/assign - Assign reviewer
```

## Usage

### View Review Dashboard
```typescript
import { ReviewDashboard } from './components/review';

<ReviewDashboard submissionId="pr-123" />
```

### Submit Appeal
```typescript
import { submitAppeal } from './api/reviews';

const appeal = await submitAppeal('pr-123', 'Disagree with scores');
```

## Testing

### Frontend Tests
```bash
cd frontend
npm test -- ReviewDashboard.test.tsx
```

### Backend Tests
```bash
cd backend
pytest tests/test_reviews.py
```

## Files Created

```
frontend/
├── src/
│   ├── components/review/
│   │   ├── ReviewDashboard.tsx
│   │   ├── ScoreVisualization.tsx
│   │   ├── ConsensusIndicator.tsx
│   │   ├── AppealWorkflow.tsx
│   │   ├── ReviewDashboard.css
│   │   └── index.ts
│   ├── api/reviews.ts
│   ├── types/review.ts
│   └── __tests__/components/review/
│       └── ReviewDashboard.test.tsx

backend/
├── api/reviews.py
├── models/review.py
└── tests/test_reviews.py
```

## Acceptance Criteria

- [x] Multi-LLM score visualization with consensus indicators
- [x] Appeal workflow with human reviewer assignment
- [x] Appeal resolution tracking and history

## Future Enhancements

- Real-time score updates via WebSocket
- Advanced filtering and sorting
- Export reports as PDF
- Integration with GitHub PR comments
- Email notifications for appeal status changes
