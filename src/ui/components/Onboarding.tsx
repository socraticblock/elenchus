import { useState } from 'react';
import { COLD_START_QUESTIONS, saveElenchusContext, completeOnboarding } from '../../core/cold-start';
import type { ElenchusContext } from '../../types';

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<ElenchusContext>>({});

  const totalSteps = COLD_START_QUESTIONS.length;
  const current = COLD_START_QUESTIONS[step];
  const isLast = step === totalSteps - 1;

  function handleNext(value: string) {
    const newAnswers = { ...answers, [current.id]: value };
    setAnswers(newAnswers);

    if (isLast) {
      // Save context and complete onboarding
      saveElenchusContext(newAnswers);
      completeOnboarding();
      onComplete();
    } else {
      setStep(step + 1);
    }
  }

  function handleBack() {
    if (step > 0) setStep(step - 1);
  }

  const isOptionQuestion = 'options' in current && current.options;

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0a0a0f] px-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="mb-8 flex items-center gap-2">
          <div className="text-xs font-mono text-[#71717a]">
            {step + 1} / {totalSteps}
          </div>
          <div className="flex flex-1 gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-[#6366f1]' : 'bg-[#1e1e2e]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Welcome */}
        {step === 0 && (
          <div className="mb-8">
            <h1 className="mb-2 font-mono text-2xl font-semibold text-[#e4e4e7]">
              Elenchus
            </h1>
            <p className="font-mono text-sm text-[#71717a]">
              Collaborative Thinking Space for Human + AI
            </p>
          </div>
        )}

        {/* Question */}
        <div className="mb-6">
          <p className="mb-4 font-mono text-base text-[#e4e4e7]">{current.question}</p>
          <p className="mb-4 text-xs text-[#71717a]">{current.hint}</p>
        </div>

        {/* Input */}
        {isOptionQuestion ? (
          <div className="mb-8 flex flex-col gap-3">
            {current.options!.map((opt: { value: string; label: string }) => (
              <button
                key={opt.value}
                onClick={() => handleNext(opt.value)}
                className="group flex items-center gap-3 rounded-lg border border-[#1e1e2e] bg-[#14141f] px-4 py-3 text-left transition-all hover:border-[#6366f1]"
              >
                <div className="h-2 w-2 rounded-full bg-[#6366f1] opacity-0 transition-opacity group-hover:opacity-100" />
                <span className="font-mono text-sm text-[#e4e4e7]">{opt.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mb-8">
            <input
              type="text"
              value={(answers as Record<string, string>)[current.id] || ''}
              onChange={(e) =>
                setAnswers({ ...answers, [current.id]: e.target.value })
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (answers as Record<string, string>)[current.id]?.trim();
                  if (val) handleNext(val);
                }
              }}
              placeholder={current.placeholder}
              autoFocus
              className="w-full rounded-lg border border-[#1e1e2e] bg-[#14141f] px-4 py-3 font-mono text-sm text-[#e4e4e7] placeholder-[#71717a] outline-none transition-colors focus:border-[#6366f1]"
            />
            <p className="mt-2 text-xs text-[#71717a]">
              Press Enter to continue
            </p>
          </div>
        )}

        {/* Nav */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={step === 0}
            className={`font-mono text-xs text-[#71717a] transition-colors ${
              step > 0 ? 'hover:text-[#e4e4e7] cursor-pointer' : 'cursor-default opacity-30'
            }`}
          >
            ← Back
          </button>

          {!isOptionQuestion && (
            <button
              onClick={() => {
                const val = (answers as Record<string, string>)[current.id]?.trim();
                if (val) handleNext(val);
              }}
              disabled={!(answers as Record<string, string>)[current.id]?.trim()}
              className={`rounded-lg px-4 py-2 font-mono text-sm transition-all ${
                (answers as Record<string, string>)[current.id]?.trim()
                  ? 'bg-[#6366f1] text-white cursor-pointer hover:bg-[#5558e3]'
                  : 'bg-[#1e1e2e] text-[#71717a] cursor-default'
              }`}
            >
              {isLast ? 'Get Started →' : 'Continue →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
