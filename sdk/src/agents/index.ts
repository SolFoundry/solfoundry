/**
 * Autonomous Bounty-Hunting Agent System.
 *
 * Multi-agent orchestration framework for discovering, analyzing,
 * implementing, testing, and submitting solutions to SolFoundry bounties.
 *
 * @module agents
 */

// Types
export type {
  AgentMessage,
  BountyAnalysis,
  SolutionResult,
  SolutionFile,
  TestResult,
  TestSuiteResult,
  TestCaseResult,
  PRSubmissionResult,
  MissionState,
  AgentOrchestratorConfig,
  AgentEvent,
} from './types.js';

export {
  AgentRole,
  AgentState,
  TaskType,
  MessageType,
  AgentEventType,
  DEFAULT_ORCHESTRATOR_CONFIG,
} from './types.js';

// Agents
export { BountyHunterAgent } from './BountyHunterAgent.js';
export type { BountyHunterEventHandler } from './BountyHunterAgent.js';

export { SolutionBuilder } from './SolutionBuilder.js';
export type { SolutionBuilderEventHandler } from './SolutionBuilder.js';

export { TestRunner } from './TestRunner.js';
export type { TestRunnerEventHandler, TestRunnerConfig } from './TestRunner.js';

export { PRSubmitter } from './PRSubmitter.js';
export type { PRSubmitterEventHandler } from './PRSubmitter.js';

export { AgentOrchestrator } from './AgentOrchestrator.js';
export type { OrchestratorEventHandler } from './AgentOrchestrator.js';
