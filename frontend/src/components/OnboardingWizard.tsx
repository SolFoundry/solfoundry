import React, { useState, useEffect } from 'react';
import Modal from './common/Modal';

interface OnboardingWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
}

const SKILLS = [
    'React', 'TypeScript', 'Python', 'Solidity', 'FastAPI',
    'Rust', 'Tailwind CSS', 'Next.js', 'PostgreSQL', 'Docker'
];

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ isOpen, onClose, onComplete }) => {
    const [step, setStep] = useState(1);
    const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
    const [isWalletConnecting, setIsWalletConnecting] = useState(false);
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [recommendedBounties, setRecommendedBounties] = useState<any[]>([]);
    const [loadingBounties, setLoadingBounties] = useState(false);

    const totalSteps = 4;

    const nextStep = () => setStep((s) => Math.min(s + 1, totalSteps));
    const prevStep = () => setStep((s) => Math.max(s - 1, 1));

    const handleSkip = () => {
        localStorage.setItem('sf_onboarded', 'true');
        onClose();
    };

    const handleFinish = () => {
        localStorage.setItem('sf_onboarded', 'true');
        onComplete();
    };

    const toggleSkill = (skill: string) => {
        setSelectedSkills(prev =>
            prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
        );
    };

    const mockConnectWallet = () => {
        setIsWalletConnecting(true);
        setTimeout(() => {
            setWalletAddress('Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7');
            setIsWalletConnecting(false);
        }, 1500);
    };

    // Fetch recommended bounties when reaching step 4
    useEffect(() => {
        if (step === 4 && selectedSkills.length > 0) {
            setLoadingBounties(true);
            fetch(`/api/bounties/recommended?skills=${selectedSkills.join(',')}&limit=3`)
                .then(res => res.json())
                .then(data => {
                    setRecommendedBounties(Array.isArray(data) ? data : []);
                    setLoadingBounties(false);
                })
                .catch(() => setLoadingBounties(false));
        }
    }, [step, selectedSkills]);

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div className="space-y-6 py-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-solana-purple to-solana-green rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/20">
                            <span className="text-2xl font-bold text-white">SF</span>
                        </div>
                        <div className="text-center space-y-3">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Welcome to SolFoundry</h2>
                            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                                The autonomous AI software factory on Solana. ship code, earn $FNDRY, and let our agents handle the overhead.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 gap-4 mt-8">
                            <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                                    <span className="text-blue-400">🚀</span>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold dark:text-white text-gray-900">Pick a Bounty</h4>
                                    <p className="text-xs text-gray-500">Choose tasks from Tier 1 (Open Race) to Tier 3 (Claim-Based).</p>
                                </div>
                            </div>
                            <div className="bg-white/5 p-4 dark:bg-gray-800/5 rounded-xl border border-white/10 flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                                    <span className="text-green-400">🤖</span>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold dark:text-white text-gray-900">AI Review</h4>
                                    <p className="text-xs text-gray-500">Our agents automatically score your PRs for quality and speed.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="space-y-6 py-4">
                        <div className="text-center space-y-3">
                            <h2 className="text-2xl font-bold text-white tracking-tight">Connect Your Wallet</h2>
                            <p className="text-gray-400">
                                You'll need a Solana wallet to receive payouts and participate in gated bounties.
                            </p>
                        </div>

                        <div className="py-8">
                            {walletAddress ? (
                                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center animate-in fade-in zoom-in-95 duration-300">
                                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                        </svg>
                                    </div>
                                    <p className="text-sm font-bold text-green-400 mb-1">Wallet Connected</p>
                                    <code className="text-xs text-green-500/80 font-mono break-all px-4 block">
                                        {walletAddress}
                                    </code>
                                </div>
                            ) : (
                                <button
                                    onClick={mockConnectWallet}
                                    disabled={isWalletConnecting}
                                    className="w-full py-4 rounded-xl bg-gradient-to-r from-solana-purple to-solana-green text-white font-bold text-lg shadow-xl shadow-purple-500/20 hover:opacity-90 transition-all flex items-center justify-center gap-3 active:scale-95"
                                >
                                    {isWalletConnecting ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Connecting...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                                            </svg>
                                            Connect Solana Wallet
                                        </>
                                    )}
                                </button>
                            )}
                        </div>

                        <p className="text-center text-xs text-gray-500 italic">
                            Don't have a wallet? You can skip this and browse for now.
                        </p>
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-6 py-4">
                        <div className="text-center space-y-3">
                            <h2 className="text-2xl font-bold text-white tracking-tight">Pick Your Skills</h2>
                            <p className="text-gray-400">
                                We'll personalize your bounty recommendations based on what you do best.
                            </p>
                        </div>

                        <div className="flex flex-wrap justify-center gap-3 py-4">
                            {SKILLS.map((skill) => {
                                const isSelected = selectedSkills.includes(skill);
                                return (
                                    <button
                                        key={skill}
                                        onClick={() => toggleSkill(skill)}
                                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${isSelected
                                                ? 'bg-solana-green/10 border-solana-green text-solana-green'
                                                : 'bg-white/5 border-white/5 text-gray-400 hover:border-white/20'
                                            }`}
                                    >
                                        {skill}
                                    </button>
                                );
                            })}
                        </div>

                        {selectedSkills.length === 0 && (
                            <p className="text-center text-xs text-gray-500">
                                Select at least one skill to get recommendations.
                            </p>
                        )}
                    </div>
                );
            case 4:
                return (
                    <div className="space-y-6 py-4">
                        <div className="text-center space-y-3">
                            <h2 className="text-2xl font-bold text-white tracking-tight">Your First Bounty</h2>
                            <p className="text-gray-400">
                                Here are a few T1 bounties that match your skills.
                            </p>
                        </div>

                        <div className="space-y-3 mt-4">
                            {loadingBounties ? (
                                <div className="py-12 flex justify-center">
                                    <svg className="animate-spin h-8 w-8 text-solana-green" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                </div>
                            ) : recommendedBounties.length > 0 ? (
                                recommendedBounties.map((b) => (
                                    <div key={b.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between group hover:border-solana-green/30 transition-colors">
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-bold text-white group-hover:text-solana-green transition-colors">{b.title}</h4>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-bold text-solana-green">{b.reward_amount?.toLocaleString() || b.rewardAmount?.toLocaleString()} $FNDRY</span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 uppercase">Tier 1</span>
                                            </div>
                                        </div>
                                        <button className="px-3 py-1.5 rounded-lg bg-solana-green text-black text-xs font-bold hover:bg-solana-green/90 transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0">
                                            Claim
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                                    <p className="text-sm text-gray-500">No specific matches found. Check the full bounty board!</p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={handleSkip} maxWidth="lg">
            <div className="px-8 pt-8 pb-6">
                {/* Progress Bar */}
                <div className="flex items-center gap-2 mb-8">
                    {[1, 2, 3, 4].map((s) => (
                        <div
                            key={s}
                            className={`h-1.5 rounded-full flex-1 transition-all duration-500 ${s <= step ? 'bg-gradient-to-r from-solana-purple to-solana-green' : 'bg-white/10'
                                }`}
                        />
                    ))}
                </div>

                {/* Step Content */}
                <div className="min-h-[360px] flex flex-col justify-center">
                    {renderStep()}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between mt-10">
                    <button
                        onClick={handleSkip}
                        className="text-sm font-bold text-gray-500 hover:text-white transition-colors"
                    >
                        Skip for now
                    </button>

                    <div className="flex items-center gap-3">
                        {step > 1 && (
                            <button
                                onClick={prevStep}
                                className="px-6 py-2 rounded-xl text-sm font-bold text-white hover:bg-white/5 transition-all"
                            >
                                Back
                            </button>
                        )}

                        <button
                            onClick={step === totalSteps ? handleFinish : nextStep}
                            className="px-8 py-2.5 rounded-xl text-sm font-bold bg-white text-black hover:bg-gray-200 transition-all active:scale-95"
                        >
                            {step === totalSteps ? 'Get Started' : 'Continue'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default OnboardingWizard;
