import { useState, useEffect } from 'react';
import { isOnboardingComplete } from './core/cold-start';
import Onboarding from './ui/components/Onboarding';
import MainLayout from './ui/components/MainLayout';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    setOnboardingDone(isOnboardingComplete());
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#0a0a0f]">
        <div className="text-[#71717a] font-mono text-sm">Loading Elenchus...</div>
      </div>
    );
  }

  if (!onboardingDone) {
    return <Onboarding onComplete={() => setOnboardingDone(true)} />;
  }

  return <MainLayout />;
}
