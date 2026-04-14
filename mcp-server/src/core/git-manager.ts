import { simpleGit, type SimpleGit } from 'simple-git';
import fs from 'fs/promises';

export interface Change {
  type: 'thread' | 'create' | 'state-change' | 'meta';
  exchangeCount?: number;
  humanCount?: number;
  aiCount?: number;
  detail?: string;
}

export class GitManager {
  private git: SimpleGit;
  private pending: Map<string, Change[]> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private readonly DEBOUNCE_MS: number;
  private readonly authorName: string;
  private readonly authorEmail: string;
  private dataDir: string;

  constructor(
    dataDir: string,
    debounceMs = 30_000,
    authorName = 'Elenchus',
    authorEmail = 'elenchus@local'
  ) {
    this.dataDir = dataDir;
    this.DEBOUNCE_MS = debounceMs;
    this.authorName = authorName;
    this.authorEmail = authorEmail;
    this.git = simpleGit(dataDir);
  }

  async init(): Promise<void> {
    try {
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        await this.git.init();
        await this.git.addConfig('user.name', this.authorName);
        await this.git.addConfig('user.email', this.authorEmail);
        await this.git.commit('Initial commit');
      }
    } catch {
      // Git not available, run without git
    }
  }

  async queueThreadChange(
    slug: string,
    exchangeCount: number,
    humanCount: number,
    aiCount: number
  ): Promise<void> {
    this.pending.set(slug, [{ type: 'thread', exchangeCount, humanCount, aiCount }]);
    this.resetDebounce(slug);
  }

  async queueNodeChange(
    slug: string,
    changeType: 'create' | 'state-change',
    detail?: string
  ): Promise<void> {
    this.pending.set(slug, [{ type: changeType, detail }]);
    await this.commitImmediately(slug);
  }

  private resetDebounce(slug: string): void {
    const existing = this.timers.get(slug);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      await this.commit(slug);
    }, this.DEBOUNCE_MS);

    this.timers.set(slug, timer);
  }

  private async commit(slug: string): Promise<void> {
    const changes = this.pending.get(slug);
    if (!changes) return;

    try {
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) return;

      const msg = this.formatMessage(slug, changes);
      const files = await this.affectedFiles(slug);

      // Always stage and commit even if no actual changes (for metadata)
      await this.git.add(files.length > 0 ? files : ['.']);
      await this.git.commit(msg);
    } catch {
      // Git not available or commit failed
    }

    this.pending.delete(slug);
    this.timers.delete(slug);
  }

  private async commitImmediately(slug: string): Promise<void> {
    const timer = this.timers.get(slug);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(slug);
    }
    await this.commit(slug);
  }

  private formatMessage(slug: string, changes: Change[]): string {
    const title = this.nodeTitle(slug);
    const parts: string[] = [];

    for (const change of changes) {
      switch (change.type) {
        case 'thread':
          parts.push(
            `[thread] Updated "${title}" — ${change.exchangeCount} new exchange${change.exchangeCount !== 1 ? 's' : ''} (${change.humanCount} human, ${change.aiCount} AI)`
          );
          break;
        case 'create':
          parts.push(`[node] Created "${title}"`);
          break;
        case 'state-change':
          parts.push(`[state] "${title}": ${change.detail}`);
          break;
        case 'meta':
          parts.push(`[meta] Updated thread metadata for "${title}"`);
          break;
      }
    }

    return parts.join('\n');
  }

  private async affectedFiles(slug: string): Promise<string[]> {
    const files: string[] = [];
    const nodesDir = this.dataDir;

    try {
      await fs.access(`${nodesDir}/${slug}.md`);
      files.push(`${slug}.md`);
    } catch {
      // ignore
    }

    try {
      await fs.access(`${nodesDir}/${slug}.meta.json`);
      files.push(`${slug}.meta.json`);
    } catch {
      // ignore
    }

    return files;
  }

  private nodeTitle(slug: string): string {
    // Slugs are title-like from slugify()
    return slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  async flushAll(): Promise<void> {
    const slugs = [...this.pending.keys()];
    for (const slug of slugs) {
      const timer = this.timers.get(slug);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(slug);
      }
      await this.commit(slug);
    }
  }
}
