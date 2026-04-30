/**
 * Type definitions for the Autonomous Bounty-Hunting Agent system.
 *
 * Defines agent roles, states, task types, and communication
 * protocols for the multi-agent orchestration framework.
 *
 * @module agents/types
 */

// ---------------------------------------------------------------------------
// Agent roles
// ---------------------------------------------------------------------------

/** Distinct roles within the bounty-hunting agent team. */
export enum AgentRole {
  /** Discovers and analyzes open bounties, selects targets. */
  PLANNER = 'planner',
  /** Implements solutions based on bounty requirements. */
  CODER = 'coder',
  /** Runs tests and validates solution quality. */
  TESTER = 'tester',
  /** Creates and submits pull requests. */
  SUBMITTER = 'submitter',
  /** Coordinates all agents and manages workflow state. */
  ORCHESTRATOR = 'orchestrator',
}

// ---------------------------------------------------------------------------
// Agent states
// ---------------------------------------------------------------------------

/** Lifecycle states for an individual agent. */
export enum AgentState {
  IDLE = 'idle',
  RUNNING = 'running',
  WAITING = 'waiting',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// ---------------------------------------------------------------------------
// Task types
// ---------------------------------------------------------------------------

/** Stages of the bounty-hunting pipeline. */
export enum TaskType {
  /** Discover and filter available bounties. */
  DISCOVER = 'discover',
  /** Analyze bounty requirements and plan implementation. */
  ANALYZE = 'analyze',
  /** Generate code solution for the bounty. */
  IMPLEMENT = 'implement',
  /** Run tests to validate the solution. */
  TEST = 'test',
  /** Create and submit a pull request. */
  SUBMIT = 'submit',
  /** Monitor submission and handle feedback. */
  MONITOR = 'monitor',
}

// ---------------------------------------------------------------------------
// Agent communication
// ---------------------------------------------------------------------------

/** Message passed between agents in the orchestration pipeline. */
export interface AgentMessage {
  /** Unique message identifier. */
  readonly id: string;
  /** Timestamp of message creation. */
  readonly timestamp: string;
  /** Role of the sending agent. */
  readonly from: AgentRole;
  /** Role of the receiving agent. */
  readonly to: AgentRole;
  /** Message type for routing. */
  readonly type: MessageType;
  /** Message payload (type varies by message type). */
  readonly payload: Record<string, unknown>;
  /** Optional error details if the message indicates failure. */
  readonly error?: string;
}

/** Types of inter-agent messages. */
export enum MessageType {
  /** Request an agent to perform a task. */
  TASK_REQUEST = 'task_request',
  /** Response to a task request with results. */
  TASK_RESPONSE = 'task_response',
  /** Status update from an agent. */
  STATUS_UPDATE = 'status_update',
  /** Error notification from an agent. */
  ERROR = 'error',
  /** Completion notification. */
  COMPLETION = 'completion',
}

// ---------------------------------------------------------------------------
// Bounty analysis
// ---------------------------------------------------------------------------

/** Result of analyzing a bounty for suitability. */
export interface BountyAnalysis {
  /** Bounty identifier. */
  readonly bountyId: string;
  /** Bounty title. */
  readonly title: string;
  /** How well the agent's skills match (0-1). */
  readonly skillMatchScore: number;
  /** Estimated difficulty (1-10). */
  readonly estimatedDifficulty: number;
  /** Estimated effort in hours. */
  readonly estimatedEffortHours: number;
  /** Reward amount in $FNDRY. */
  readonly rewardAmount: number;
  /** Value-to-effort ratio (higher is better). */
  readonly valueRatio: number;
  /** Key requirements extracted from the description. */
  readonly requirements: string[];
  /** Recommended approach summary. */
  readonly recommendedApproach: string;
  /** Whether the agent should pursue this bounty. */
  readonly shouldPursue: boolean;
  /** Confidence in the analysis (0-1). */
  readonly confidence: number;
}

// ---------------------------------------------------------------------------
// Solution building
// ---------------------------------------------------------------------------

/** Result of the solution implementation phase. */
export interface SolutionResult {
  /** Bounty identifier. */
  readonly bountyId: string;
  /** Files that were created or modified. */
  readonly files: SolutionFile[];
  /** Whether the solution passes all tests. */
  readonly testsPassing: boolean;
  /** Number of tests run. */
  readonly testsRun: number;
  /** Number of tests passed. */
  readonly testsPassed: number;
  /** Number of tests failed. */
  readonly testsFailed: number;
  /** Coverage percentage (0-100). */
  readonly coveragePercent: number;
  /** Linting errors found. */
  readonly lintErrors: number;
  /** Whether the solution is ready for submission. */
  readonly readyForSubmission: boolean;
  /** Summary of changes made. */
  readonly summary: string;
}

/** A single file in a solution. */
export interface SolutionFile {
  /** File path relative to the repository root. */
  readonly path: string;
  /** Whether the file was created (true) or modified (false). */
  readonly isNew: boolean;
  /** Number of lines added. */
  readonly linesAdded: number;
  /** Number of lines removed. */
  readonly linesRemoved: number;
  /** File content (for new files). */
  readonly content?: string;
}

// ---------------------------------------------------------------------------
// Test results
// ---------------------------------------------------------------------------

/** Result of running the test suite. */
export interface TestResult {
  /** Whether all tests passed. */
  readonly passed: boolean;
  /** Total number of tests. */
  readonly total: number;
  /** Number of passed tests. */
  readonly passedCount: number;
  /** Number of failed tests. */
  readonly failedCount: number;
  /** Number of skipped tests. */
  readonly skippedCount: number;
  /** Duration in milliseconds. */
  readonly durationMs: number;
  /** Individual test results. */
  readonly results: TestSuiteResult[];
}

/** Mutable version of TestResult for internal use. */
export interface MutableTestResult {
  passed: boolean;
  total: number;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  durationMs: number;
  results: MutableTestSuiteResult[];
}

/** Result for a single test suite. */
export interface TestSuiteResult {
  /** Test file path. */
  readonly file: string;
  /** Whether all tests in this suite passed. */
  readonly passed: boolean;
  /** Individual test case results. */
  readonly tests: TestCaseResult[];
}

/** Mutable version of TestSuiteResult for internal use. */
export interface MutableTestSuiteResult {
  file: string;
  passed: boolean;
  tests: TestCaseResult[];
}

/** Result for a single test case. */
export interface TestCaseResult {
  /** Test name. */
  readonly name: string;
  /** Whether the test passed. */
  readonly passed: boolean;
  /** Duration in milliseconds. */
  readonly durationMs: number;
  /** Error message if failed. */
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// PR submission
// ---------------------------------------------------------------------------

/** Result of a PR submission attempt. */
export interface PRSubmissionResult {
  /** Whether the PR was successfully created. */
  readonly success: boolean;
  /** PR URL if created. */
  readonly prUrl?: string;
  /** PR number if created. */
  readonly prNumber?: number;
  /** Branch name used for the PR. */
  readonly branchName: string;
  /** PR title. */
  readonly prTitle: string;
  /** PR body/description. */
  readonly prBody: string;
  /** Error message if submission failed. */
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/** Overall state of a bounty-hunting mission. */
export interface MissionState {
  /** Unique mission identifier. */
  readonly missionId: string;
  /** Current target bounty (if selected). */
  readonly bountyId: string | null;
  /** Current pipeline stage. */
  readonly currentStage: TaskType;
  /** States of all agents in the pipeline. */
  readonly agentStates: Record<AgentRole, AgentState>;
  /** Whether the mission is actively running. */
  readonly isActive: boolean;
  /** Whether the mission has completed successfully. */
  readonly isComplete: boolean;
  /** Whether the mission failed. */
  readonly isFailed: boolean;
  /** Error message if mission failed. */
  readonly errorMessage?: string;
  /** Timestamp when the mission was created. */
  readonly createdAt: string;
  /** Timestamp of the last state change. */
  readonly updatedAt: string;
  /** Timestamp when the mission completed (if applicable). */
  readonly completedAt?: string;
  /** Results from each pipeline stage. */
  readonly stageResults: Partial<Record<TaskType, Record<string, unknown>>>;
}

/** Mutable version of MissionState for internal use by the orchestrator. */
export interface MutableMissionState {
  missionId: string;
  bountyId: string | null;
  currentStage: TaskType;
  agentStates: Record<AgentRole, AgentState>;
  isActive: boolean;
  isComplete: boolean;
  isFailed: boolean;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  stageResults: Partial<Record<TaskType, Record<string, unknown>>>;
}

/** Configuration for the agent orchestrator. */
export interface AgentOrchestratorConfig {
  /** Maximum number of concurrent agent tasks. */
  readonly maxConcurrentAgents: number;
  /** Maximum retries per task before marking as failed. */
  readonly maxRetries: number;
  /** Timeout per task in milliseconds. */
  readonly taskTimeoutMs: number;
  /** Whether to auto-select bounties or wait for manual selection. */
  readonly autoSelectBounty: boolean;
  /** Minimum reward amount to consider (in $FNDRY). */
  readonly minRewardAmount: number;
  /** Maximum estimated effort to consider (in hours). */
  readonly maxEffortHours: number;
  /** Skills the agent team possesses. */
  readonly agentSkills: string[];
  /** GitHub repository to work on. */
  readonly targetRepo: string;
  /** Base URL for the SolFoundry API. */
  readonly apiBaseUrl: string;
  /** Authentication token for API requests. */
  readonly authToken?: string;
}

/** Default orchestrator configuration. */
export const DEFAULT_ORCHESTRATOR_CONFIG: AgentOrchestratorConfig = {
  maxConcurrentAgents: 3,
  maxRetries: 2,
  taskTimeoutMs: 300_000, // 5 minutes
  autoSelectBounty: true,
  minRewardAmount: 100,
  maxEffortHours: 40,
  agentSkills: ['typescript', 'javascript', 'rust', 'python', 'solidity'],
  targetRepo: 'SolFoundry/solfoundry',
  apiBaseUrl: 'https://api.solfoundry.io',
};

// ---------------------------------------------------------------------------
// Event types (for real-time monitoring)
// ---------------------------------------------------------------------------

/** Events emitted during bounty-hunting operations. */
export interface AgentEvent {
  /** Event type identifier. */
  readonly type: AgentEventType;
  /** Timestamp of the event. */
  readonly timestamp: string;
  /** Agent role associated with the event. */
  readonly agent: AgentRole;
  /** Event description. */
  readonly message: string;
  /** Optional event data. */
  readonly data?: Record<string, unknown>;
}

/** Types of events the agent system can emit. */
export enum AgentEventType {
  /** Agent started a task. */
  AGENT_STARTED = 'agent_started',
  /** Agent completed a task. */
  AGENT_COMPLETED = 'agent_completed',
  /** Agent encountered an error. */
  AGENT_ERROR = 'agent_error',
  /** New bounty discovered. */
  BOUNTY_DISCOVERED = 'bounty_discovered',
  /** Bounty selected for pursuit. */
  BOUNTY_SELECTED = 'bounty_selected',
  /** Solution implementation started. */
  SOLUTION_STARTED = 'solution_started',
  /** Solution implementation completed. */
  SOLUTION_COMPLETED = 'solution_completed',
  /** Tests started running. */
  TESTS_STARTED = 'tests_started',
  /** Tests completed. */
  TESTS_COMPLETED = 'tests_completed',
  /** PR creation started. */
  PR_STARTED = 'pr_started',
  /** PR successfully submitted. */
  PR_SUBMITTED = 'pr_submitted',
  /** PR submission failed. */
  PR_FAILED = 'pr_failed',
  /** Mission completed successfully. */
  MISSION_COMPLETE = 'mission_complete',
  /** Mission failed. */
  MISSION_FAILED = 'mission_failed',
  /** Status update (heartbeat). */
  STATUS_UPDATE = 'status_update',
}
