import { render, screen, waitFor } from '@testing-library/react';
import { ReviewDashboard } from '../../../components/review/ReviewDashboard';
import { fetchReviewDashboard } from '../../../api/reviews';

// Mock the API
jest.mock('../../../api/reviews');

const mockDashboard = {
  submissionId: 'test-123',
  reviews: [
    {
      id: 'review-1',
      llmProvider: 'claude',
      score: 85,
      reasoning: 'Good implementation with minor improvements needed',
      timestamp: '2026-04-25T08:00:00Z',
    },
    {
      id: 'review-2',
      llmProvider: 'codex',
      score: 90,
      reasoning: 'Excellent code quality and documentation',
      timestamp: '2026-04-25T08:01:00Z',
    },
    {
      id: 'review-3',
      llmProvider: 'gemini',
      score: 80,
      reasoning: 'Solid work, consider adding more tests',
      timestamp: '2026-04-25T08:02:00Z',
    },
  ],
  consensus: {
    averageScore: 85,
    agreementLevel: 'high' as const,
    scores: [85, 90, 80],
    disagreements: [],
  },
};

describe('ReviewDashboard', () => {
  beforeEach(() => {
    (fetchReviewDashboard as jest.Mock).mockResolvedValue(mockDashboard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    render(<ReviewDashboard submissionId="test-123" />);
    expect(screen.getByText('Loading review dashboard...')).toBeInTheDocument();
  });

  it('renders review scores after loading', async () => {
    render(<ReviewDashboard submissionId="test-123" />);
    
    await waitFor(() => {
      expect(screen.getByText('Multi-LLM Review Dashboard')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Claude')).toBeInTheDocument();
    expect(screen.getByText('Codex')).toBeInTheDocument();
    expect(screen.getByText('Gemini')).toBeInTheDocument();
  });

  it('displays consensus information', async () => {
    render(<ReviewDashboard submissionId="test-123" />);
    
    await waitFor(() => {
      expect(screen.getByText('Review Consensus')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Average Score')).toBeInTheDocument();
    expect(screen.getByText('85.0/100')).toBeInTheDocument();
    expect(screen.getByText('High Agreement')).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    (fetchReviewDashboard as jest.Mock).mockRejectedValue(new Error('API Error'));
    
    render(<ReviewDashboard submissionId="test-123" />);
    
    await waitFor(() => {
      expect(screen.getByText('API Error')).toBeInTheDocument();
    });
  });

  it('calls API with correct submission ID', async () => {
    render(<ReviewDashboard submissionId="test-123" />);
    
    await waitFor(() => {
      expect(fetchReviewDashboard).toHaveBeenCalledWith('test-123');
    });
  });
});
