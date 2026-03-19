import Link from 'next/link';
import { mockBounties } from '@/data/mockBounties';
import { notFound } from 'next/navigation';

export default function BountyDetailPage({ params }: { params: { id: string } }) {
  const bounty = mockBounties.find(b => b.id === Number(params.id));
  if (!bounty) notFound();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/bounties" className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-green-400 mb-8">
          ← Back to Bounties
        </Link>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{bounty.title}</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{bounty.description}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Reward</div>
              <div className="text-lg font-bold text-green-400">{bounty.reward.toLocaleString()} FNDRY</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tier</div>
              <div className="text-lg font-semibold text-white">{bounty.tier}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</div>
              <div className="text-lg font-semibold text-white capitalize">{bounty.status}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Submissions</div>
              <div className="text-lg font-semibold text-white">{bounty.submissions}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {bounty.skills.map(skill => (
              <span key={skill} className="px-3 py-1 rounded-full text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                {skill}
              </span>
            ))}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Full specification and submission guidelines available on GitHub.
            </p>
            <a
              href={`https://github.com/SolFoundry/solfoundry/issues/${bounty.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-500 text-black font-semibold text-sm hover:bg-green-400 transition-colors"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
