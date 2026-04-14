import type { ElenchusContext } from '../types';

const CONTEXT_KEY = 'elenchus_context';
const ONBOARDING_KEY = 'elenchus_onboarding_done';

export const COLD_START_QUESTIONS = [
  {
    id: 'domain',
    question: 'What domain are you working in?',
    placeholder: 'e.g., game design, ML research, software architecture',
    hint: 'This helps Elenchus speak your language from the first message.',
  },
  {
    id: 'project',
    question: "What's the project or focus you're currently working on?",
    placeholder: 'e.g., Sakartvelo Defenders tower defense, startup research',
    hint: 'Elenchus will keep this in context for all your threads.',
  },
  {
    id: 'openQuestion',
    question: "What's the biggest open question you're wrestling with right now?",
    placeholder: 'e.g., token economy mechanics, which framework to use',
    hint: 'Start your first thread with this — Elenchus will hold it alongside you.',
  },
  {
    id: 'recentDecisions',
    question:
      'Any topics you recently made decisions about that you\'d like to track?',
    placeholder: 'e.g., abandoned hard cap approach, chose Vite over CRA',
    hint: 'You can create nodes for these right now, or let them emerge naturally.',
  },
  {
    id: 'workStyle',
    question: 'How do you prefer to work?',
    placeholder: 'More exploratory (open threads, loose thinking) or more decisive (quick crystallization)?',
    hint: 'Elenchus adapts to your pace. Neither is wrong.',
    options: [
      { value: 'exploratory', label: 'Exploratory — open threads, loose thinking' },
      { value: 'decisive', label: 'Decisive — quick crystallization into firm decisions' },
    ],
  },
] as const;

export function isOnboardingComplete(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === 'true';
}

export function completeOnboarding(): void {
  localStorage.setItem(ONBOARDING_KEY, 'true');
}

export function getElenchusContext(): ElenchusContext | null {
  try {
    const raw = localStorage.getItem(CONTEXT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ElenchusContext;
  } catch {
    return null;
  }
}

export function saveElenchusContext(context: Partial<ElenchusContext>): ElenchusContext {
  const existing = getElenchusContext();
  const merged: ElenchusContext = {
    domain: context.domain ?? existing?.domain ?? '',
    project: context.project ?? existing?.project ?? '',
    openQuestion: context.openQuestion ?? existing?.openQuestion ?? '',
    recentDecisions: context.recentDecisions ?? existing?.recentDecisions ?? [],
    workStyle: context.workStyle ?? existing?.workStyle ?? 'exploratory',
  };

  localStorage.setItem(CONTEXT_KEY, JSON.stringify(merged));
  return merged;
}

export function resetOnboarding(): void {
  localStorage.removeItem(CONTEXT_KEY);
  localStorage.removeItem(ONBOARDING_KEY);
}
