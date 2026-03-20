/** Tests for PR Status Tracker (Issue #23). */
import{describe,it,expect,vi}from'vitest';
import{render,screen,fireEvent}from'@testing-library/react';
import{PRStatusTracker}from'../../components/pr-tracker/PRStatusTracker';
import{PRStatusList}from'../../components/pr-tracker/PRStatusList';
import{PipelineStage}from'../../components/pr-tracker/PipelineStage';
import{StageTimeline}from'../../components/pr-tracker/StageTimeline';
import{AIReviewScores}from'../../components/pr-tracker/AIReviewScores';
import{PayoutInfo}from'../../components/pr-tracker/PayoutInfo';
import{PRTrackerPage}from'../../pages/PRTrackerPage';
import{mockPRStatusCompleted as d,mockPRStatuses as a}from'../../data/mockPRStatus';
describe('PRStatusTracker',()=>{it('title/badge/progress/compact',()=>{
  const{rerender}=render(<PRStatusTracker prStatus={d}/>);
  expect(screen.getByTestId('pr-title')).toHaveTextContent('dark mode');
  expect(screen.getByTestId('pr-outcome-badge')).toHaveTextContent('Paid');
  expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
  rerender(<PRStatusTracker prStatus={d} compact/>);
  expect(screen.queryByTestId('progress-bar')).toBeNull();});});
describe('PRStatusList',()=>{it('renders and filters',()=>{
  const{rerender}=render(<PRStatusList statuses={a}/>);
  expect(screen.getAllByTestId('pr-status-tracker')).toHaveLength(2);
  rerender(<PRStatusList statuses={a} filterOutcome="approved"/>);
  expect(screen.getByTestId('pr-status-list-empty')).toBeInTheDocument();});});
describe('PipelineStage',()=>{it('renders and onSelect',()=>{const fn=vi.fn();
  render(<PipelineStage stage={d.stages[0]} isActive={false} isLast={true} onSelect={fn}/>);
  expect(screen.getByTestId('pipeline-stage-submitted')).toHaveTextContent('Passed');
  fireEvent.click(screen.getByTestId('pipeline-stage-submitted'));expect(fn).toHaveBeenCalled();});});
describe('StageTimeline',()=>{it('filters denied for paid',()=>{
  render(<StageTimeline stages={d.stages} outcome="paid"/>);
  expect(screen.queryByTestId('pipeline-stage-denied')).toBeNull();});});
describe('AIReviewScores',()=>{it('score and badge',()=>{
  render(<AIReviewScores review={d.stages[2].aiReview!}/>);
  expect(screen.getByTestId('ai-review-scores')).toHaveTextContent('87/100');
  expect(screen.getByTestId('ai-review-scores')).toHaveTextContent('PASSED');});});
describe('PayoutInfo',()=>{it('amount and link',()=>{
  render(<PayoutInfo payout={d.stages[6].payout!}/>);
  expect(screen.getByTestId('payout-amount')).toHaveTextContent('500');
  expect(screen.getByTestId('tx-link')).toHaveAttribute('href',expect.stringContaining('solscan'));});});
describe('PRTrackerPage',()=>{it('list view',()=>{render(<PRTrackerPage/>);
  expect(screen.getByText('PR Review Pipeline')).toBeInTheDocument();});});
