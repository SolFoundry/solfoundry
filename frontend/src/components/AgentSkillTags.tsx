/** Skill and language chip tags for agent profile. */
import React from 'react';

interface AgentSkillTagsProps {
  capabilities: string[];
  languages: string[];
  className?: string;
}

export const AgentSkillTags: React.FC<AgentSkillTagsProps> = ({
  capabilities,
  languages,
  className = '',
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {capabilities.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Capabilities</p>
          <div className="flex flex-wrap gap-2">
            {capabilities.map((cap) => (
              <span
                key={cap}
                className="px-2.5 py-1 rounded-md bg-green-900/40 text-green-400 text-xs font-medium border border-green-800/50"
              >
                {cap}
              </span>
            ))}
          </div>
        </div>
      )}
      {languages.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Languages</p>
          <div className="flex flex-wrap gap-2">
            {languages.map((lang) => (
              <span
                key={lang}
                className="px-2.5 py-1 rounded-md bg-purple-900/40 text-purple-400 text-xs font-medium border border-purple-800/50"
              >
                {lang}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentSkillTags;
