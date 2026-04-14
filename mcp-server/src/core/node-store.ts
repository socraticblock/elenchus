import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import matter from 'gray-matter';

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

export interface Node {
  id: string;
  title: string;
  slug: string;
  state: 'open' | 'decided' | 'archived';
  created: string;
  updated: string;
  tags: string[];
  aliases: string[];
  links: string[];
  content: string;
}

export interface NodeSummary {
  id: string;
  title: string;
  slug: string;
  state: 'open' | 'decided' | 'archived';
  updated: string;
  tags: string[];
}

export interface SearchResult {
  nodeId: string;
  title: string;
  slug: string;
  snippet: string;
  matchType: 'title' | 'content' | 'thread';
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function nodePath(nodesDir: string, slug: string): string {
  return path.join(nodesDir, `${slug}.md`);
}

export class NodeStore {
  private nodesDir: string;

  constructor(dataDir: string) {
    this.nodesDir = path.join(dataDir, 'nodes');
  }

  async init(): Promise<void> {
    await fs.mkdir(this.nodesDir, { recursive: true });
  }

  async create(title: string, initialContent = ''): Promise<Node> {
    const now = new Date().toISOString();
    const slug = slugify(title);
    const id = uuidv4();

    const node: Node = {
      id,
      title,
      slug,
      state: 'open',
      created: now,
      updated: now,
      tags: [],
      aliases: [],
      links: [],
      content: initialContent,
    };

    await this.writeNode(node);
    return node;
  }

  async read(idOrSlug: string): Promise<Node | null> {
    const slug = await this.resolveSlug(idOrSlug);
    if (!slug) return null;

    try {
      const raw = await fs.readFile(nodePath(this.nodesDir, slug), 'utf-8');
      return this.parseNode(slug, raw);
    } catch {
      return null;
    }
  }

  async update(
    idOrSlug: string,
    updates: Partial<Pick<Node, 'content' | 'title' | 'state' | 'tags' | 'aliases' | 'links'>>
  ): Promise<Node | null> {
    const existing = await this.read(idOrSlug);
    if (!existing) return null;

    // If title changed, slug changes
    const slug = updates.title ? slugify(updates.title) : existing.slug;

    const updated: Node = {
      ...existing,
      ...updates,
      slug,
      updated: new Date().toISOString(),
    };

    await this.writeNode(updated);

    // If slug changed, delete old file
    if (slug !== existing.slug) {
      try {
        await fs.unlink(nodePath(this.nodesDir, existing.slug));
      } catch {
        // ignore
      }
    }

    return updated;
  }

  async updateState(idOrSlug: string, state: Node['state']): Promise<Node | null> {
    return this.update(idOrSlug, { state });
  }

  async list(filter?: { state?: Node['state']; tag?: string }): Promise<NodeSummary[]> {
    await this.init();

    const files = await fs.readdir(this.nodesDir);
    const summaries: NodeSummary[] = [];

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const slug = file.replace(/\.md$/, '');
      try {
        const raw = await fs.readFile(nodePath(this.nodesDir, slug), 'utf-8');
        const node = this.parseNode(slug, raw);
        if (!node) continue;

        if (filter?.state && node.state !== filter.state) continue;
        if (filter?.tag && !node.tags.includes(filter.tag)) continue;

        summaries.push({
          id: node.id,
          title: node.title,
          slug: node.slug,
          state: node.state,
          updated: node.updated,
          tags: node.tags,
        });
      } catch {
        continue;
      }
    }

    return summaries.sort((a, b) => b.updated.localeCompare(a.updated));
  }

  async search(query: string): Promise<SearchResult[]> {
    const nodes = await this.list();
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const summary of nodes) {
      const node = await this.read(summary.id);
      if (!node) continue;

      const titleMatch = node.title.toLowerCase().includes(lowerQuery);
      const contentMatch = node.content.toLowerCase().includes(lowerQuery);

      if (titleMatch || contentMatch) {
        results.push({
          nodeId: node.id,
          title: node.title,
          slug: node.slug,
          snippet: titleMatch
            ? node.title
            : node.content.slice(0, 120) + (node.content.length > 120 ? '...' : ''),
          matchType: titleMatch ? 'title' : 'content',
        });
      }
    }

    return results;
  }

  async delete(idOrSlug: string): Promise<boolean> {
    const slug = await this.resolveSlug(idOrSlug);
    if (!slug) return false;

    try {
      await fs.unlink(nodePath(this.nodesDir, slug));
      return true;
    } catch {
      return false;
    }
  }

  async isEmpty(): Promise<boolean> {
    await this.init();
    const files = await fs.readdir(this.nodesDir);
    return files.filter((f) => f.endsWith('.md')).length === 0;
  }

  getNodesDir(): string {
    return this.nodesDir;
  }

  private async resolveSlug(idOrSlug: string): Promise<string | null> {
    // Try as slug first
    try {
      await fs.access(nodePath(this.nodesDir, idOrSlug));
      return idOrSlug;
    } catch {
      // Try by ID
    }

    const files = await fs.readdir(this.nodesDir);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const slug = file.replace(/\.md$/, '');
      try {
        const raw = await fs.readFile(nodePath(this.nodesDir, slug), 'utf-8');
        const node = this.parseNode(slug, raw);
        if (node?.id === idOrSlug) return slug;
      } catch {
        continue;
      }
    }

    return null;
  }

  private async writeNode(node: Node): Promise<void> {
    const fm = {
      id: node.id,
      title: node.title,
      state: node.state,
      created: node.created,
      updated: node.updated,
      tags: node.tags,
      aliases: node.aliases,
      links: node.links,
    };

    const content = matter.stringify(node.content, fm);
    await fs.writeFile(nodePath(this.nodesDir, node.slug), content, 'utf-8');
  }

  private parseNode(slug: string, raw: string): Node | null {
    try {
      const { data, content } = matter(raw);
      return {
        id: data.id || uuidv4(),
        title: data.title || slug,
        slug,
        state: data.state || 'open',
        created: data.created || new Date().toISOString(),
        updated: data.updated || new Date().toISOString(),
        tags: data.tags || [],
        aliases: data.aliases || [],
        links: data.links || [],
        content: content.trim(),
      };
    } catch {
      return null;
    }
  }
}
