interface AgentSkillTagsProps {
  title: string;
  tags: string[];
  variant?: 'green' | 'purple';
}

export function AgentSkillTags({ title, tags, variant = 'green' }: AgentSkillTagsProps) {
  const colors = variant === 'green'
    ? 'bg-solana-green/10 text-solana-green border-solana-green/20'
    : 'bg-solana-purple/10 text-solana-purple border-solana-purple/20';

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 dark:text-gray-400">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <span
            key={tag}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${colors}`}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
