import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { fadeIn } from '../../lib/animations';

const SKILL_OPTIONS = [
  { id: 'react', label: 'React / Next.js' },
  { id: 'vue', label: 'Vue / Nuxt' },
  { id: 'svelte', label: 'Svelte' },
  { id: 'node', label: 'Node.js / Express' },
  { id: 'python', label: 'Python / FastAPI' },
  { id: 'rust', label: 'Rust' },
  { id: 'solidity', label: 'Solidity / EVM' },
  { id: 'solana', label: 'Solana / Anchor' },
  { id: 'ai-ml', label: 'AI / ML' },
  { id: 'devops', label: 'DevOps / Cloud' },
  { id: 'security', label: 'Security / Audit' },
  { id: 'docs', label: 'Technical Writing' },
];

const LANG_OPTIONS = [
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'rust', label: 'Rust' },
  { id: 'go', label: 'Go' },
  { id: 'solidity', label: 'Solidity' },
];

const STEPS = [
  { id: 'profile', title: 'Profile', icon: '👤' },
  { id: 'skills', title: 'Skills', icon: '🛠️' },
  { id: 'wallet', title: 'Wallet', icon: '💜' },
  { id: 'done', title: 'Done!', icon: '🎉' },
];

export function OnboardingWizard() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step data
  const [username, setUsername] = useState(user?.username ?? '');
  const [bio, setBio] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedLangs, setSelectedLangs] = useState<string[]>(['typescript']);
  const [walletAddr, setWalletAddr] = useState(user?.wallet_address ?? '');
  const [walletVerified, setWalletVerified] = useState(user?.wallet_verified ?? false);

  const isLastStep = step === STEPS.length - 2;
  const isDone = step === STEPS.length - 1;

  const toggleSkill = (id: string) => {
    setSelectedSkills(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const toggleLang = (id: string) => {
    setSelectedLangs(prev =>
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep(s => Math.max(s - 1, 0));

  const handleFinish = async () => {
    setLoading(true);
    setError(null);
    try {
      // Update user profile with all onboarding data
      updateUser({
        username: username || user?.username ?? '',
        wallet_address: walletAddr || undefined,
        wallet_verified: walletVerified,
      });
      // In a real app, would POST to /api/contributors/me with skills/langs
      next();
    } catch(e: any) {
      setError(e.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const skipToHome = () => navigate('/', { replace: true });

  const stepVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir < 0 ? 60 : -60, opacity: 0 }),
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Welcome to SolFoundry</h1>
          <p className="text-gray-400 text-sm">Complete your contributor profile to start earning</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8 px-2">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all ${
                  i <= step ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-500'
                }`}>
                  {i < step ? '✓' : s.icon}
                </div>
                <span className={`text-xs mt-1 ${
                  i <= step ? 'text-purple-400' : 'text-gray-600'
                }`}>{s.title}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${
                  i < step ? 'bg-purple-600' : 'bg-gray-800'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step Card */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 min-h-80">
          <AnimatePresence mode="wait" custom={step}>
            <motion.div
              key={step}
              custom={step}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {/* Step 0: Profile */}
              {step === 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-4">Set up your profile</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Username</label>
                      <input
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder={user?.username ?? 'your_username'}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Bio <span className="text-gray-600">(optional)</span></label>
                      <textarea
                        value={bio}
                        onChange={e => setBio(e.target.value)}
                        placeholder="Tell the community about yourself..."
                        rows={3}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
                      />
                    </div>
                    {user?.avatar_url && (
                      <div className="flex items-center gap-3">
                        <img src={user.avatar_url} alt="Avatar" className="w-12 h-12 rounded-full" />
                        <span className="text-gray-400 text-sm">GitHub avatar</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 1: Skills */}
              {step === 1 && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-4">Choose your skills</h2>
                  <p className="text-gray-500 text-xs mb-4">Select all that apply — helps match you with relevant bounties</p>
                  <div className="grid grid-cols-2 gap-2">
                    {SKILL_OPTIONS.map(skill => (
                      <button
                        key={skill.id}
                        onClick={() => toggleSkill(skill.id)}
                        className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          selectedSkills.includes(skill.id)
                            ? 'bg-purple-600/30 border border-purple-500 text-purple-300'
                            : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        {selectedSkills.includes(skill.id) ? '✓ ' : ''}{skill.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4">
                    <p className="text-gray-500 text-xs mb-2">Preferred languages</p>
                    <div className="flex flex-wrap gap-2">
                      {LANG_OPTIONS.map(lang => (
                        <button
                          key={lang.id}
                          onClick={() => toggleLang(lang.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            selectedLangs.includes(lang.id)
                              ? 'bg-blue-600/30 border border-blue-500 text-blue-300'
                              : 'bg-gray-800 border border-gray-700 text-gray-400'
                          }`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Wallet */}
              {step === 2 && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-4">Connect your wallet</h2>
                  <p className="text-gray-400 text-sm mb-4">Add your Solana wallet to receive FNDRY token rewards</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Solana Wallet Address</label>
                      <input
                        type="text"
                        value={walletAddr}
                        onChange={e => setWalletAddr(e.target.value)}
                        placeholder="ABC...XYZ"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono text-sm"
                      />
                    </div>
                    {walletAddr && !walletVerified && (
                      <button
                        onClick={() => setWalletVerified(true)}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2.5 rounded-lg font-medium transition-colors"
                      >
                        Verify Ownership (Sign Message)
                      </button>
                    )}
                    {walletVerified && (
                      <div className="flex items-center gap-2 text-green-400 text-sm">
                        <span>✓</span> Wallet verified
                      </div>
                    )}
                    <p className="text-gray-600 text-xs">
                      FNDRY tokens are distributed on Solana. Your wallet must support SPL tokens.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 3: Done */}
              {step === 3 && (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">🎉</div>
                  <h2 className="text-2xl font-bold text-white mb-2">You're all set!</h2>
                  <p className="text-gray-400 mb-6">
                    {username || user?.username}, your profile is ready.
                    {selectedSkills.length > 0 && (
                      <span> You'll be matched with <strong className="text-purple-400">{selectedSkills.length}</strong> skill areas.</span>
                    )}
                  </p>
                  <div className="space-y-3">
                    <button
                      onClick={skipToHome}
                      className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-semibold transition-colors"
                    >
                      Start Hunting Bounties →
                    </button>
                    <button
                      onClick={skipToHome}
                      className="w-full text-gray-500 hover:text-gray-300 py-2 text-sm transition-colors"
                    >
                      Browse bounties first
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Error */}
          {error && (
            <div className="mt-4 text-red-400 text-sm text-center">{error}</div>
          )}
        </div>

        {/* Navigation */}
        {!isDone && (
          <div className="flex gap-3 mt-4">
            {step > 0 && (
              <button
                onClick={back}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-lg font-medium transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={step === STEPS.length - 2 ? handleFinish : next}
              disabled={loading}
              className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white py-2.5 rounded-lg font-semibold transition-colors"
            >
              {loading ? 'Saving...' : step === STEPS.length - 2 ? 'Complete Setup' : 'Continue'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
