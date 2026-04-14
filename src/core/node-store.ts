import { v4 as uuidv4 } from 'uuid';
import type { Node, NodeSummary, SearchResult, NodeFrontmatter } from '../types';

// Slugify a title into a URL-safe string
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Parse YAML frontmatter from markdown content
function parseFrontmatter(raw: string): { frontmatter: Partial<NodeFrontmatter>; content: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, content: raw };

  const [, fmRaw, content] = match;
  const frontmatter: Partial<NodeFrontmatter> = {};

  for (const line of fmRaw.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();

    if (key === 'tags' || key === 'aliases' || key === 'links') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (frontmatter as any)[key] = JSON.parse(val);
      } catch {
        frontmatter[key] = [];
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (frontmatter as any)[key] = val;
    }
  }

  return { frontmatter, content: content.trim() };
}

// Serialize node back to markdown with frontmatter
function serializeNode(node: Node): string {
  const fm: NodeFrontmatter = {
    id: node.id,
    title: node.title,
    state: node.state,
    created: node.created,
    updated: node.updated,
    tags: node.tags,
    aliases: node.aliases,
    links: node.links,
  };

  const fmLines = Object.entries(fm)
    .map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: ${JSON.stringify(v)}`;
      return `${k}: ${v}`;
    })
    .join('\n');

  return `---\n${fmLines}\n---\n\n# ${node.title}\n\n${node.content}`;
}

// localStorage-based node store for the demo
// In the real app, this is replaced by filesystem operations via MCP

const STORAGE_KEY = 'elenchus_nodes';

interface StoredNodes {
  [slug: string]: string; // slug -> raw markdown
}

function readStorage(): StoredNodes {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeStorage(nodes: StoredNodes): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
}

export class NodeStore {
  // Create a new node
  create(title: string, initialContent = ''): Node {
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

    const nodes = readStorage();
    nodes[slug] = serializeNode(node);
    writeStorage(nodes);

    return node;
  }

  // Read a node by ID
  read(idOrSlug: string): Node | null {
    const nodes = readStorage();

    // Try slug first
    if (nodes[idOrSlug]) {
      return this.parseNode(idOrSlug, nodes[idOrSlug]);
    }

    // Try by ID
    for (const [slug, raw] of Object.entries(nodes)) {
      const parsed = this.parseNode(slug, raw);
      if (parsed?.id === idOrSlug) return parsed;
    }

    return null;
  }

  // Update node content and/or frontmatter
  update(idOrSlug: string, updates: Partial<Pick<Node, 'content' | 'title' | 'state' | 'tags' | 'aliases' | 'links'>>): Node | null {
    const node = this.read(idOrSlug);
    if (!node) return null;

    const updated: Node = {
      ...node,
      ...updates,
      updated: new Date().toISOString(),
    };

    const nodes = readStorage();
    nodes[updated.slug] = serializeNode(updated);
    writeStorage(nodes);

    return updated;
  }

  // List all nodes, optionally filtered
  list(filter?: { state?: Node['state']; tag?: string }): NodeSummary[] {
    const nodes = readStorage();
    const summaries: NodeSummary[] = [];

    for (const [slug, raw] of Object.entries(nodes)) {
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
    }

    return summaries.sort((a, b) => b.updated.localeCompare(a.updated));
  }

  // Search across titles, content, and thread text
  search(query: string): SearchResult[] {
    const nodes = readStorage();
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const [slug, raw] of Object.entries(nodes)) {
      const node = this.parseNode(slug, raw);
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

  // Delete a node
  delete(idOrSlug: string): boolean {
    const node = this.read(idOrSlug);
    if (!node) return false;

    const nodes = readStorage();
    delete nodes[node.slug];
    writeStorage(nodes);
    return true;
  }

  // Check if store is empty
  isEmpty(): boolean {
    const nodes = readStorage();
    return Object.keys(nodes).length === 0;
  }

  private parseNode(slug: string, raw: string): Node | null {
    try {
      const { frontmatter, content } = parseFrontmatter(raw);
      return {
        id: frontmatter.id || uuidv4(),
        title: frontmatter.title || slug,
        slug,
        state: frontmatter.state || 'open',
        created: frontmatter.created || new Date().toISOString(),
        updated: frontmatter.updated || new Date().toISOString(),
        tags: frontmatter.tags || [],
        aliases: frontmatter.aliases || [],
        links: frontmatter.links || [],
        content,
      };
    } catch {
      return null;
    }
  }
}
