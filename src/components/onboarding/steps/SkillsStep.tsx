import React from 'react';
import { motion } from 'framer-motion';
import { Code, Database, Palette, Wrench, Globe, Zap } from 'lucide-react';

interface SkillsStepProps {
  selectedSkills: string[];
  onSkillsChange: (skills: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const SKILL_CATEGORIES = [
  {
    title: 'Programming Languages',
    icon: Code,
    skills: ['TypeScript', 'JavaScript', 'Python', 'Rust', 'Solidity', 'Go', 'Java', 'C++']
  },
  {
    title: 'Frameworks & Libraries',
    icon: Zap,
    skills: ['React', 'Next.js', 'Vue.js', 'Angular', 'Node.js', 'FastAPI', 'Django', 'Flask']
  },
  {
    title: 'Blockchain & Web3',
    icon: Database,
    skills: ['Solana', 'Ethereum', 'Anchor', 'Web3.js', 'Smart Contracts', 'DeFi', 'NFTs', 'DAOs']
  },
  {
    title: 'Design & UX',
    icon: Palette,
    skills: ['UI/UX Design', 'Figma', 'Adobe Creative', 'Tailwind CSS', 'SCSS', 'Design Systems']
  },
  {
    title: 'DevOps & Tools',
    icon: Wrench,
    skills: ['Docker', 'AWS', 'GitHub Actions', 'Kubernetes', 'PostgreSQL', 'Redis', 'MongoDB']
  },
  {
    title: 'Other',
    icon: Globe,
    skills: ['Technical Writing', 'Testing', 'Security Audits', 'Project Management', 'Community Management']
  }
];

export default function SkillsStep({ selectedSkills, onSkillsChange, onNext, onBack }: SkillsStepProps) {
  const toggleSkill = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      onSkillsChange(selectedSkills.filter(s => s !== skill));
    } else {
      onSkillsChange([...selectedSkills, skill]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-4xl mx-auto"
    >
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-4">
          What are your skills?
        </h2>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Select the technologies and areas you're proficient in. We'll use this to recommend
          relevant bounties that match your expertise and interests.
        </p>
      </div>

      <div className="space-y-8">
        {SKILL_CATEGORIES.map((category, categoryIndex) => {
          const IconComponent = category.icon;

          return (
            <motion.div
              key={category.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: categoryIndex * 0.1 }}
              className="bg-gray-800/50 rounded-xl p-6 border border-gray-700"
            >
              <div className="flex items-center gap-3 mb-4">
                <IconComponent className="w-5 h-5 text-purple-400" />
                <h3 className="text-xl font-semibold text-white">{category.title}</h3>
              </div>

              <div className="flex flex-wrap gap-3">
                {category.skills.map((skill) => {
                  const isSelected = selectedSkills.includes(skill);

                  return (
                    <motion.button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`
                        px-4 py-2 rounded-full font-medium transition-all duration-200
                        ${isSelected
                          ? 'bg-purple-600 text-white border-2 border-purple-500 shadow-lg'
                          : 'bg-gray-700 text-gray-300 border-2 border-transparent hover:bg-gray-600 hover:text-white'
                        }
                      `}
                    >
                      {skill}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-8 text-center">
        <p className="text-gray-400 text-sm mb-6">
          Selected {selectedSkills.length} skill{selectedSkills.length !== 1 ? 's' : ''}
          {selectedSkills.length > 0 && (
            <span className="ml-2 text-purple-400">
              • {selectedSkills.slice(0, 3).join(', ')}{selectedSkills.length > 3 ? ` +${selectedSkills.length - 3} more` : ''}
            </span>
          )}
        </p>
      </div>

      <div className="flex justify-between items-center mt-12">
        <button
          onClick={onBack}
          className="px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
        >
          Back
        </button>

        <button
          onClick={onNext}
          disabled={selectedSkills.length === 0}
          className={`
            px-8 py-3 rounded-lg font-medium transition-all duration-200
            ${selectedSkills.length > 0
              ? 'bg-purple-600 hover:bg-purple-700 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          {selectedSkills.length > 0 ? 'Continue' : 'Select at least one skill'}
        </button>
      </div>
    </motion.div>
  );
}
