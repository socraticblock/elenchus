#!/usr/bin/env node

// Elenchus MCP Server
// Connects to Hermes (or any MCP client) over stdio

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { NodeStore } from './core/node-store.js';
import { ThreadEngine } from './core/thread-engine.js';
import { GitManager } from './core/git-manager.js';
import { createMcpServer } from './mcp/tools.js';
import path from 'path';
import fs from 'fs/promises';

// Config from environment
function getConfig() {
  const dataDir = process.env.ELENCHUS_DATA_DIR || path.join(process.env.HOME || '/root', 'elenchus', 'data');
  const aiBaseUrl = process.env.ELENCHUS_AI_BASE_URL || 'https://api.minimax.io/v1';
  const aiApiKey = process.env.ELENCHUS_AI_API_KEY || process.env.MINIMAX_API_KEY || '';
  const aiModel = process.env.ELENCHUS_AI_MODEL || 'MiniMax-M2.7';
  const gitDebounceMs = parseInt(process.env.ELENCHUS_GIT_DEBOUNCE_MS || '30000', 10);

  return { dataDir, aiBaseUrl, aiApiKey, aiModel, gitDebounceMs };
}

async function main() {
  const config = getConfig();

  // Validate data dir
  const dataDir = path.resolve(config.dataDir);
  const nodesDir = path.join(dataDir, 'nodes');

  // Ensure directories exist
  await fs.mkdir(nodesDir, { recursive: true });

  // Initialize stores
  const nodeStore = new NodeStore(dataDir);
  const threadEngine = new ThreadEngine(nodesDir);
  const gitManager = new GitManager(dataDir, config.gitDebounceMs);

  await nodeStore.init();
  await threadEngine.init();
  await gitManager.init();

  // AI config — require API key
  if (!config.aiApiKey) {
    console.error('ERROR: ELENCHUS_AI_API_KEY or MINIMAX_API_KEY environment variable is required');
    process.exit(1);
  }

  const aiConfig = {
    baseUrl: config.aiBaseUrl,
    apiKey: config.aiApiKey,
    model: config.aiModel,
  };

  // Create MCP server
  const server = createMcpServer(nodeStore, threadEngine, gitManager, aiConfig);

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Keep process alive
  process.on('SIGINT', async () => {
    await gitManager.flushAll();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await gitManager.flushAll();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
