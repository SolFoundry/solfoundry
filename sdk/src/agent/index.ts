/**
 * Autonomous Bounty-Hunting Agent System.
 *
 * Provides a multi-LLM agent orchestration pipeline for discovering,
 * planning, implementing, verifying, and submitting solutions to
 * SolFoundry bounties without human intervention.
 *
 * @module agent
 */

// Core types
export type {
  LLMProvider,
  LLMProviderConfig,
  AgentRole as AgentRoleType,
  AgentStep,
  BountyCandidate,
  ImplementationPlan,
  PlanStep,
  TestResult,
  VerificationResult,
  ReviewScore,
  ReviewResult,
  PRSubmissionConfig,
  BountyHunterConfig,
  BountyHunterResult,
} from './types.js';
export { AgentRole, AgentStepStatus } from './types.js';

// Base agent
export { BaseAgent } from './agent.js';
export type {
  LLMMessage,
  CompletionOptions,
  CompletionResponse,
} from './agent.js';

// Role agents
export { PlannerAgent, createPlanner } from './planner.js';
export type { PlannerInput } from './planner.js';
export { ImplementerAgent, createImplementer } from './implementer.js';
export type { GeneratedFile, ImplementationResult, ImplementerInput } from './implementer.js';
export { VerifierAgent, createVerifier } from './verifier.js';
export type { VerifierInput } from './verifier.js';
export { ReviewerAgent, createReviewer } from './reviewer.js';
export type { ReviewerInput } from './reviewer.js';
export { SubmitterAgent, createSubmitter } from './submitter.js';
export type { SubmissionResult, SubmitterInput } from './submitter.js';

// Orchestrator
export { BountyHunter, createBountyHunter } from './orchestrator.js';