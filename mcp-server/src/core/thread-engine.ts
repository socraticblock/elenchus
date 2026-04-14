import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Exchange, ExchangeSignals, ThreadMeta, ThreadStats } from './types.js';
import {
  detectDecisionLanguage,
  detectAgreement,
  detectNegation,
  detectQuestion,
} from './keywords.js';

const THREAD_SUFFIX = '.meta.json';

function threadPath(nodesDir: string, slug: string): string {
  return path.join(nodesDir, `${slug}${THREAD_SUFFIX}`);
}

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
  private nodesDir: string;

  constructor(nodesDir: string) {
    this.nodesDir = nodesDir;
  }

  async init(): Promise<void> {
    // Thread files live alongside nodes, no separate init needed
  }

  async readThread(slug: string): Promise<ThreadMeta | null> {
    try {
      const raw = await fs.readFile(threadPath(this.nodesDir, slug), 'utf-8');
      return JSON.parse(raw) as ThreadMeta;
    } catch {
      return null;
    }
  }

  async append(
    slug: string,
    nodeId: string,
    participant: 'human' | 'ai',
    content: string
  ): Promise<Exchange> {
    let thread: ThreadMeta;

    try {
      const raw = await fs.readFile(threadPath(this.nodesDir, slug), 'utf-8');
      thread = JSON.parse(raw) as ThreadMeta;
    } catch {
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

    await fs.writeFile(threadPath(this.nodesDir, slug), JSON.stringify(thread, null, 2), 'utf-8');

    return exchange;
  }

  async getExchanges(slug: string): Promise<Exchange[]> {
    const thread = await this.readThread(slug);
    return thread?.exchanges || [];
  }

  async hasThread(slug: string): Promise<boolean> {
    try {
      await fs.access(threadPath(this.nodesDir, slug));
      return true;
    } catch {
      return false;
    }
  }

  async deleteThread(slug: string): Promise<void> {
    try {
      await fs.unlink(threadPath(this.nodesDir, slug));
    } catch {
      // ignore
    }
  }

  async listThreads(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.nodesDir);
      return files
        .filter((f) => f.endsWith(THREAD_SUFFIX))
        .map((f) => f.replace(THREAD_SUFFIX, ''));
    } catch {
      return [];
    }
  }
}
