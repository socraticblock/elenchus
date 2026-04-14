// Node frontmatter stored in markdown YAML frontmatter
export interface NodeFrontmatter {
  id: string;
  title: string;
  state: 'open' | 'decided' | 'archived';
  created: string;
  updated: string;
  tags: string[];
  aliases: string[];
  links: string[];
}

// Full node including content
export interface Node {
  id: string;
  title: string;
  state: 'open' | 'decided' | 'archived';
  created: string;
  updated: string;
  tags: string[];
  aliases: string[];
  links: string[];
  content: string;
  slug: string;
}

// Exchange signal heuristics
export interface ExchangeSignals {
  isQuestion: boolean;
  isAgreement: boolean;
  isNegation: boolean;
  referencesPrior: string | null;
  decisionLanguage: boolean;
}

// Per-exchange data
export interface Exchange {
  id: string;
  participant: 'human' | 'ai';
  timestamp: string;
  content: string;
  charCount: number;
  position: number;
  signals: ExchangeSignals;
}

// Thread stats updated on every write
export interface ThreadStats {
  totalExchanges: number;
  humanExchanges: number;
  aiExchanges: number;
  firstExchange: string;
  lastExchange: string;
  timeSpanMinutes: number;
  hasBranches: boolean;
  convergenceSignals: number;
  decisionLanguageCount: number;
}

// Thread metadata stored in .meta.json alongside the node markdown
export interface ThreadMeta {
  nodeId: string;
  slug: string;
  exchanges: Exchange[];
  stats: ThreadStats;
}

// Node list item (lightweight, for sidebar)
export interface NodeSummary {
  id: string;
  title: string;
  slug: string;
  state: 'open' | 'decided' | 'archived';
  updated: string;
  tags: string[];
}

// Search result
export interface SearchResult {
  nodeId: string;
  title: string;
  slug: string;
  snippet: string;
  matchType: 'title' | 'content' | 'thread';
}

// Onboarding context
export interface ElenchusContext {
  domain: string;
  project: string;
  openQuestion: string;
  recentDecisions: string[];
  workStyle: 'exploratory' | 'decisive';
}

// Config
export interface ElenchusConfig {
  ai: {
    provider: string;
    model: string;
    baseUrl: string;
    apiKey: string;
  };
  git: {
    autoCommit: boolean;
    debounceMs: number;
    authorName: string;
    authorEmail: string;
  };
  onboarding: {
    completed: boolean;
    completionDate: string | null;
  };
}
