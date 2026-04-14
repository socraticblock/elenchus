import { v4 as uuidv4 } from 'uuid';
import type { Exchange, ExchangeSignals, ThreadMeta, ThreadStats } from '../types';
import {
  detectDecisionLanguage,
  detectAgreement,
  detectNegation,
  detectQuestion,
} from './keywords';

const THREAD_KEY_PREFIX = 'elenchus_thread_';

function threadKey(slug: string): string {
  return `${THREAD_KEY_PREFIX}${slug}`;
}

// Compute signals for a single exchange
function computeSignals(exchange: Partial<Exchange>): ExchangeSignals {
  const text = exchange.content || '';
  const charCount = text.length;

  return {
    isQuestion: detectQuestion(text),
    isAgreement: detectAgreement(text, charCount),
    isNegation: detectNegation(text, charCount),
    referencesPrior: exchange.signals?.referencesPrior ?? null,
    decisionLanguage: detectDecisionLanguage(text),
  };
}

// Compute updated thread stats from exchanges
function computeStats(exchanges: Exchange[]): ThreadStats {
  if (exchanges.length === 0) {
    const now = new Date().toISOString();
    return {
      totalExchanges: 0,
      humanExchanges: 0,
      aiExchanges: 0,
      firstExchange: now,
      lastExchange: now,
      timeSpanMinutes: 0,
      hasBranches: false,
      convergenceSignals: 0,
      decisionLanguageCount: 0,
    };
  }

  const humanExchanges = exchanges.filter((e) => e.participant === 'human');
  const aiExchanges = exchanges.filter((e) => e.participant === 'ai');

  const firstTs = new Date(exchanges[0].timestamp).getTime();
  const lastTs = new Date(exchanges[exchanges.length - 1].timestamp).getTime();
  const timeSpanMinutes = (lastTs - firstTs) / 60_000;

  const hasBranches = exchanges.some((e) => e.signals.referencesPrior !== null);

  const convergenceSignals = exchanges.filter(
    (e) => e.signals.isAgreement || e.signals.isNegation
  ).length;

  const decisionLanguageCount = exchanges.filter(
    (e) => e.signals.decisionLanguage
  ).length;

  return {
    totalExchanges: exchanges.length,
    humanExchanges: humanExchanges.length,
    aiExchanges: aiExchanges.length,
    firstExchange: exchanges[0].timestamp,
    lastExchange: exchanges[exchanges.length - 1].timestamp,
    timeSpanMinutes,
    hasBranches,
    convergenceSignals,
    decisionLanguageCount,
  };
}

export class ThreadEngine {
  // Read thread metadata for a node
  readThread(slug: string): ThreadMeta | null {
    try {
      const raw = localStorage.getItem(threadKey(slug));
      if (!raw) return null;
      return JSON.parse(raw) as ThreadMeta;
    } catch {
      return null;
    }
  }

  // Append a new exchange to a node's thread
  append(slug: string, nodeId: string, participant: 'human' | 'ai', content: string): Exchange {
    let thread = this.readThread(slug);

    if (!thread) {
      thread = {
        nodeId,
        slug,
        exchanges: [],
        stats: computeStats([]),
      };
    }

    const position = thread.exchanges.length;
    const exchange: Exchange = {
      id: uuidv4(),
      participant,
      timestamp: new Date().toISOString(),
      content,
      charCount: content.length,
      position,
      signals: computeSignals({ content }),
    };

    thread.exchanges.push(exchange);
    thread.stats = computeStats(thread.exchanges);

    localStorage.setItem(threadKey(slug), JSON.stringify(thread));
    return exchange;
  }

  // Get all exchanges for a node
  getExchanges(slug: string): Exchange[] {
    const thread = this.readThread(slug);
    return thread?.exchanges || [];
  }

  // Check if a thread exists
  hasThread(slug: string): boolean {
    return localStorage.getItem(threadKey(slug)) !== null;
  }

  // Delete a thread
  deleteThread(slug: string): void {
    localStorage.removeItem(threadKey(slug));
  }

  // List all thread slugs
  listThreads(): string[] {
    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith(THREAD_KEY_PREFIX)
    );
    return keys.map((k) => k.slice(THREAD_KEY_PREFIX.length));
  }
}
