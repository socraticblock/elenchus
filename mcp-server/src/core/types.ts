// Shared types between MCP server modules

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

export interface ExchangeSignals {
  isQuestion: boolean;
  isAgreement: boolean;
  isNegation: boolean;
  referencesPrior: string | null;
  decisionLanguage: boolean;
}

export interface Exchange {
  id: string;
  participant: 'human' | 'ai';
  timestamp: string;
  content: string;
  charCount: number;
  position: number;
  signals: ExchangeSignals;
}

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

export interface ThreadMeta {
  nodeId: string;
  slug: string;
  exchanges: Exchange[];
  stats: ThreadStats;
}
