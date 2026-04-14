import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { NodeStore } from '../core/node-store.js';
import { ThreadEngine } from '../core/thread-engine.js';
import { GitManager } from '../core/git-manager.js';
import { AiClient } from '../core/ai-client.js';
import type { AiConfig, AiMessage } from '../core/ai-client.js';
import path from 'path';
import fs from 'fs/promises';

const ELENCHUS_CONTEXT_FILE = 'elenchus-context.json';

interface ElenchusContext {
  domain?: string;
  project?: string;
  openQuestion?: string;
  recentDecisions?: string[];
  workStyle?: string;
}

function loadElenchusContext(dataDir: string): ElenchusContext | null {
  try {
    const raw = require(path.join(dataDir, ELENCHUS_CONTEXT_FILE));
    return raw as ElenchusContext;
  } catch {
    return null;
  }
}

export function createMcpServer(
  nodeStore: NodeStore,
  threadEngine: ThreadEngine,
  gitManager: GitManager,
  aiConfig: AiConfig
) {
  const aiClient = new AiClient(aiConfig);
  const dataDir = nodeStore.getNodesDir().replace('/nodes', '');

  const server = new McpServer({
    name: 'elenchus',
    version: '0.1.0',
  });

  // elenchus_search
  server.registerTool(
    'elenchus_search',
    {
      title: 'Search Nodes',
      description: 'Search nodes and threads by text. Returns matching nodes with snippets.',
      inputSchema: {
        query: z.string().describe('The search query'),
      },
    },
    async ({ query }) => {
      const results = await nodeStore.search(query);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ results, count: results.length }),
          },
        ],
      };
    }
  );

  // elenchus_read
  server.registerTool(
    'elenchus_read',
    {
      title: 'Read Node',
      description: 'Read a node and its full thread history.',
      inputSchema: {
        nodeId: z.string().describe('Node ID or slug'),
      },
    },
    async ({ nodeId }) => {
      const node = await nodeStore.read(nodeId);
      if (!node) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Node not found' }) }],
          isError: true,
        };
      }
      const thread = await threadEngine.readThread(node.slug);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ node, thread }, null, 2),
          },
        ],
      };
    }
  );

  // elenchus_write
  server.registerTool(
    'elenchus_write',
    {
      title: 'Write to Thread',
      description: 'Append an exchange to a node thread and receive an AI response.',
      inputSchema: {
        nodeId: z.string().describe('Node ID or slug'),
        participant: z.enum(['human', 'ai']).describe('Who is writing'),
        content: z.string().describe('The exchange content'),
      },
    },
    async ({ nodeId, participant, content }) => {
      const node = await nodeStore.read(nodeId);
      if (!node) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Node not found' }) }],
          isError: true,
        };
      }

      const exchange = await threadEngine.append(
        node.slug,
        node.id,
        participant,
        content
      );

      const ctx = loadElenchusContext(dataDir);

      let aiResponse: string | null = null;
      if (participant === 'human') {
        try {
          const thread = await threadEngine.readThread(node.slug);
          const systemPrompt = AiClient.buildSystemPrompt(ctx ?? undefined);
          const conversationMessages: AiMessage[] = [
            { role: 'system', content: systemPrompt },
            ...AiClient.buildConversationContext(thread?.exchanges || []),
          ];

          const aiResult = await aiClient.chat(conversationMessages);
          aiResponse = aiResult.content;

          await threadEngine.append(node.slug, node.id, 'ai', aiResponse);
        } catch (err) {
          console.error('AI call failed:', err);
        }
      }

      const thread = await threadEngine.readThread(node.slug);
      if (thread) {
        await gitManager.queueThreadChange(
          node.slug,
          1,
          participant === 'human' ? 1 : 0,
          participant === 'ai' ? 1 : 0
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                exchange,
                aiResponse,
                threadStats: thread?.stats || null,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // elenchus_create
  server.registerTool(
    'elenchus_create',
    {
      title: 'Create Node',
      description: 'Create a new node.',
      inputSchema: {
        title: z.string().describe('Node title'),
        content: z.string().optional().describe('Initial node content (optional)'),
      },
    },
    async ({ title, content }) => {
      const node = await nodeStore.create(title, content ?? '');
      await gitManager.queueNodeChange(node.slug, 'create');
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ node }, null, 2),
          },
        ],
      };
    }
  );

  // elenchus_list
  server.registerTool(
    'elenchus_list',
    {
      title: 'List Nodes',
      description: 'List all nodes, optionally filtered by state or tag.',
      inputSchema: {
        state: z.enum(['open', 'decided', 'archived']).optional().describe('Filter by state'),
        tag: z.string().optional().describe('Filter by tag'),
      },
    },
    async ({ state, tag }) => {
      const filter = {
        ...(state ? { state } : {}),
        ...(tag ? { tag } : {}),
      };
      const nodes = await nodeStore.list(filter);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ nodes, count: nodes.length }, null, 2),
          },
        ],
      };
    }
  );

  // elenchus_update_state
  server.registerTool(
    'elenchus_update_state',
    {
      title: 'Update Node State',
      description: 'Change a node state.',
      inputSchema: {
        nodeId: z.string().describe('Node ID or slug'),
        state: z.enum(['open', 'decided', 'archived']).describe('New state'),
      },
    },
    async ({ nodeId, state }) => {
      const node = await nodeStore.read(nodeId);
      if (!node) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Node not found' }) }],
          isError: true,
        };
      }

      const oldState = node.state;
      const updated = await nodeStore.updateState(nodeId, state);
      await gitManager.queueNodeChange(node.slug, 'state-change', `${oldState} → ${state}`);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ node: updated }, null, 2),
          },
        ],
      };
    }
  );

  return server;
}
