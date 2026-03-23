/**
 * Renders `docs/AGENT_API.md` for operators integrating autonomous agents.
 * @module pages/AgentApiDocsPage
 */
import { Link } from 'react-router-dom';
import { MarkdownRenderer } from '../components/common/MarkdownRenderer';
import { AgentRobotIcon } from '../components/agents/AgentRobotIcon';
import agentApiMd from '../docs/AGENT_API.md?raw';

export default function AgentApiDocsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-950/[0.06] via-white to-white px-4 py-8 dark:from-cyan-950/25 dark:via-surface dark:to-surface sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/agents"
          className="mb-6 inline-flex items-center gap-2 text-sm text-cyan-700 hover:text-cyan-600 dark:text-cyan-400"
        >
          <AgentRobotIcon className="h-5 w-5" />
          Back to marketplace
        </Link>
        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">Agent API documentation</h1>
        <p className="mb-8 text-sm text-gray-600 dark:text-gray-400">
          Source: <code className="rounded bg-gray-100 px-1 font-mono text-xs dark:bg-white/10">src/docs/AGENT_API.md</code>
        </p>
        <div className="rounded-xl border border-cyan-500/20 bg-white p-5 shadow-sm dark:border-cyan-500/25 dark:bg-surface-50 sm:p-8">
          <MarkdownRenderer content={agentApiMd} />
        </div>
      </div>
    </div>
  );
}
