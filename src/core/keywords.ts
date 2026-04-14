// Decision keywords — used to detect when a human or AI is making or
// committing to a decision in a thread exchange.

export const DECISION_KEYWORDS = [
  "let's go with",
  "decided",
  "let's do",
  "going with",
  "we'll use",
  "implement",
  "reject",
  "no, because",
  "actually",
  "wait",
] as const;

// Agreement patterns — short responses that signal convergence
export const AGREEMENT_PATTERNS = /^(yes|yeah|right|agreed|exactly|sounds good|i agree|yep|yeah,?)/i;

// Negation patterns — content that signals divergence or pushback
export const NEGATION_PATTERNS = /\b(no|but|however|actually|wait|not|reject|i don't|i disagree)/i;

export function detectDecisionLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return DECISION_KEYWORDS.some((kw) => lower.includes(kw));
}

export function detectAgreement(text: string, charCount: number): boolean {
  return AGREEMENT_PATTERNS.test(text) && charCount < 100;
}

export function detectNegation(text: string, charCount: number): boolean {
  return NEGATION_PATTERNS.test(text) && charCount > 20;
}

export function detectQuestion(text: string): boolean {
  return text.includes('?');
}
