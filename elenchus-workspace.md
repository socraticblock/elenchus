# Elenchus — Master Workspace

> **This is the living document.** Everything we know, decide, and build goes here. Edit, expand, delete as we go. No decisions are final until they're written here.

---

## What Is Elenchus

**Elenchus (ἔλεγχος)** — the Socratic method of examining beliefs by revealing contradictions.

The name comes from Plato's dialogues: Socrates would take someone's stated belief, draw out its consequences, and show where it contradicted other beliefs they held. The result was *aporia* — perplexity, the realization that you don't know what you thought you knew. Not a defeat. The beginning of clearer thinking.

**Elenchus the product does the same thing across your knowledge graph.**

It finds where your decisions contradict each other, shows you the conflict, and lets you resolve it. The contradiction engine is not a feature. It is the core. Everything else — threads, nodes, gap detection, synthesis — exists to make contradiction detection possible.

### The Friction Principle

> **Elenchus is not a better wiki. It is a way to turn existing AI conversations into persistent knowledge without changing where you work.**

You think in chat, in the terminal, in the web app. Elenchus captures it and makes it persistent. The wiki is what that knowledge looks like once it's captured.

This solves the cold start problem: users don't start with an empty wiki. They start with their existing conversations retroactively structured into nodes and threads.

### Target User

Builders, researchers, and knowledge workers who use AI as a thinking partner. They have extended conversations with AI about complex topics: game design, software architecture, research methodology. They generate insight through dialogue but lose it between sessions. They already have notes, but static notes don't capture the reasoning process.

The first target users are Hermes users who already maintain a wiki alongside their AI workflow.

---

## Architecture Decisions

### System Architecture

```
┌──────────────────────────────────────────────┐
│  User Interface (Web UI)                      │
│  Vite + React + TypeScript + Tailwind        │
│  Dark mode, Linear/Raycast aesthetic          │
└────────────────────┬─────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │   Elenchus Core    │
          │  (Node store,      │
          │   Thread engine,   │
          │   Git manager)     │
          └──────────┬──────────┘
                     │
          ┌──────────┴──────────┐
          │   MCP Server       │
          │  (stdio transport, │
          │   AI integration)  │
          └───────────────────┘

Hermes connects via MCP over stdio.
Hermes spawns Elenchus as a long-lived subprocess.
Elenchus and wiki-llm are separate git repos.
Loosely coupled via MCP — the agent is the bridge.
```

### Config File Location

**XDG standard:**

| OS | Location |
|---|---|
| Linux | `~/.config/elenchus/` |
| macOS | `~/Library/Application Support/elenchus/` |
| Windows | `%APPDATA%/elenchus/` |

**Directory separation:**
- `~/.config/elenchus/config.yaml` — app preferences (AI provider, theme, etc.)
- `~/elenchus/data/` — user's knowledge base (git repo root)
- `~/elenchus/` — install directory (code)

User data and app config are separate. The install directory can be replaced without touching user data.

### MCP Server Integration with Hermes

**Hermes has a built-in native MCP client.** Configure in `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  elenchus:
    command: node
    args:
      - /path/to/elenchus/mcp-server/dist/mcp-server.js
    env:
      ELENCHUS_DATA_DIR: /path/to/elenchus/data
      MINIMAX_API_KEY: your_api_key
    timeout: 120
```

Hermes spawns Elenchus as a **long-lived subprocess** on startup. It communicates over stdio using JSON-RPC. The connection persists for the session, reconnects automatically if it drops.

**Tools appear as:** `elenchus_search`, `elenchus_read`, `elenchus_write`, `elenchus_create`, `elenchus_list`, `elenchus_update_state`.

**After editing config.yaml, restart Hermes** for the new MCP server to load.

**Setup steps:**
1. Build the MCP server: `cd mcp-server && npm install && npm run build`
2. Initialize data directory: `mkdir -p ~/elenchus/data && cd ~/elenchus/data && git init`
3. Add elenchus context: create `elenchus-context.json` with domain, project, openQuestion, workStyle
4. Add to `~/.hermes/config.yaml` (see config above)
5. Restart Hermes

**The default MiniMax API key is used** — replace with the user's own key in config.

**For production installation:**
```yaml
mcp_servers:
  elenchus:
    command: node
    args:
      - /usr/local/bin/elenchus-mcp  # after npm install -g
    env:
      ELENCHUS_DATA_DIR: ~/elenchus/data
      MINIMAX_API_KEY: your_api_key
    timeout: 120
```

### Git Integration

**Debounced auto-commit:**

| Event | Behavior |
|---|---|
| Thread exchange written | 30-second debounce timer. Commits when conversation pauses 30s. |
| Node created | Immediate commit |
| Node state changed (open → decided) | Immediate commit |
| Manual commit | Always available via UI button |

**Commit message formats:**
```
[thread] Updated "Token Economics" — 5 new exchanges (2 human, 3 AI)
[node] Created "Token Economics"
[state] "Token Economics": open → decided
```

Git log reads like a changelog. One natural conversation = one commit (or a few for long pauses).

**Implementation:** `simple-git` npm package. Stage only affected files. All commits go to `main` (single-user). Use `--allow-empty` for metadata-only updates.

### AI Integration (Web UI)

The Elenchus MCP server handles AI calls internally.

When `elenchus_write` is called:
1. User's exchange is written to thread JSON
2. MCP server reads full thread history
3. MCP server calls configured AI (MiniMax, OpenAI, Anthropic, etc.)
4. AI response is written as a new exchange
5. Both exchanges returned to caller

**Default config (`~/.config/elenchus/config.yaml`):**

```yaml
ai:
  provider: minimax
  model: MiniMax-M2.7
  baseUrl: https://api.minimax.io/v1  # OpenAI-compatible
  apiKey: ""  # Jeff's key pre-filled for initial build; users provide their own
```

MiniMax uses OpenAI-compatible format (`/v1/chat/completions`). Any OpenAI-compatible SDK works.

**MiniMax API as default:**
- OpenAI-compatible endpoint (`/v1/chat/completions`) — any compatible provider works
- Pre-filled in config for easy onboarding
- Users replace with their own key if they hit limits or prefer their own account

**Alternative (advanced):** Users who run Hermes with their own API can configure Hermes as the AI provider. Hermes calls `elenchus_write` with the user's message, generates the response itself, then calls `elenchus_write` again with the AI response. Elenchus stores without AI. This requires no API configuration in Elenchus.

---

## Data Model

### Node

A markdown file with YAML frontmatter. One file per concept, decision, project, or question.

**File:** `~/elenchus/data/nodes/<slug>.md`

```markdown
---
id: 5a2f1c9e
title: Token Economics
state: open
created: 2026-04-14T10:32:00Z
updated: 2026-04-14T14:18:00Z
tags: [game-design, economy]
aliases: []
links: []
---

# Token Economics

Content evolves as thinking crystallizes.
```

**Frontmatter fields:**

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Stable identifier for MCP cross-referencing |
| `title` | string | Display name. Used in wikilinks: `[[Token Economics]]` |
| `state` | enum | `open` \| `decided` \| `archived` |
| `created` | ISO timestamp | When node was created |
| `updated` | ISO timestamp | Last content or metadata change |
| `tags` | string[] | User-applied labels |
| `aliases` | string[] | Alternative titles for search |
| `links` | string[] | IDs of linked nodes (resolved at write time) |

**State semantics:**
- `open` — active thinking, thread is running
- `decided` — content is stable, thread is closed (read-only but visible)
- `archived` — superseded by newer thinking, still searchable

**Confidence spectrum** (Seed, Exploring, Converging) exists in thread metadata but is never exposed in v1.0 UI. User manually toggles state.

### Thread

A JSON file storing the conversation history that produced the node's content.

**File:** `~/elenchus/data/nodes/<slug>.meta.json`

```json
{
  "nodeId": "5a2f1c9e",
  "slug": "token-economics",
  "exchanges": [
    {
      "id": "exc_001",
      "participant": "human",
      "timestamp": "2026-04-14T10:32:15Z",
      "content": "We need to figure out the token economy.",
      "charCount": 44,
      "position": 0,
      "signals": {
        "isQuestion": false,
        "isAgreement": false,
        "isNegation": false,
        "referencesPrior": null,
        "decisionLanguage": false
      }
    }
  ],
  "stats": {
    "totalExchanges": 1,
    "humanExchanges": 1,
    "aiExchanges": 0,
    "firstExchange": "2026-04-14T10:32:15Z",
    "lastExchange": "2026-04-14T10:32:15Z",
    "timeSpanMinutes": 0,
    "hasBranches": false,
    "convergenceSignals": 0,
    "decisionLanguageCount": 0
  }
}
```

**Per-exchange signals (computed at write time):**

| Signal | Heuristic |
|---|---|
| `isQuestion` | Content contains `?` |
| `isAgreement` | Matches `/^(yes\|yeah\|right\|agreed\|exactly\|sounds good)/i` AND charCount < 100 |
| `isNegation` | Matches `/\b(no\|but\|however\|actually\|wait\|not\|reject)/i` AND charCount > 20 |
| `referencesPrior` | Content references an earlier exchange ID (not immediately preceding). Value: exchange ID or null |
| `decisionLanguage` | Content matches decision keywords |

**Decision keywords (`core/keywords.ts`):**
```typescript
const DECISION_KEYWORDS = [
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
```

**Per-thread stats (updated on every write):**

| Field | Description |
|---|---|
| `totalExchanges` | All exchanges |
| `humanExchanges` | Human participant count |
| `aiExchanges` | AI participant count |
| `firstExchange` | ISO timestamp |
| `lastExchange` | ISO timestamp |
| `timeSpanMinutes` | Minutes from first to last exchange |
| `hasBranches` | True if any exchange references a non-consecutive prior exchange |
| `convergenceSignals` | Count of exchanges where `isAgreement` or `isNegation` is true |
| `decisionLanguageCount` | Count of exchanges with `decisionLanguage: true` |

These stats drive v1.5's confidence spectrum. In v1.0 they are captured but have no effect.

### Elenchus Context

Stored at `~/elenchus/data/elenchus-context.json` after onboarding. Git-tracked. Loaded into AI context on every interaction.

```json
{
  "domain": "game design",
  "project": "Sakartvelo Defenders tower defense",
  "openQuestion": "token economy mechanics",
  "recentDecisions": ["hard cap approach abandoned"],
  "workStyle": "exploratory"
}
```

---

## v1.0 Scope

### What's In

**P0 (ships with v1.0):**
- Infinite chat UI — full-screen conversation, no session limits, AI remembers everything
- Node + thread model — every conversation attached to a node, full thread history preserved
- Git-backed storage — markdown + YAML frontmatter, auto-commits with meaningful messages
- MCP server (read/write/search) — stdio transport, Hermes spawns as long-lived subprocess
- Web UI — Vite + React + TypeScript + Tailwind, dark mode, minimal component library (Radix Primitives for accessibility)
- Node states: open / decided (archived is v1.5)
- Thread metadata capture — all signals and stats collected from day one
- Cold start questions — 3-5 questions on first launch, answers stored in elenchus-context.json

**P1 (ships with v1.0, can slip):**
- Cold start questions (actually P0 — needed for AI context)
- Thread metadata capture (actually P0 — needed for v1.5)

### What's Out

These are explicitly excluded from v1.0. Each is a v1.5+ decision pending v1.0 data.

- **Manage mode** — AI proposes wiki structural changes with approval queue
- **Gap detection** — any dimension (structural, reasoning, temporal, contradiction, dependency)
- **Synthesis** — AI-generated summaries across multiple nodes
- **Multi-interface** — Telegram, CLI thinking sessions (v2.0)
- **Long document support** — TOC, paragraph-level threading, document-aware navigation (v3.0)
- **Confidence spectrum UI** — Seed, Exploring, Converging states in the UI (v1.5+)
- **Ambient intelligence** — background scanning, proactive nudges (v4.0)
- **wiki-llm integration** — basic awareness of wiki-llm nodes (v1.5)
- **Cold start ingestion** — import from Obsidian, Notion, chat logs (v1.5)

---

## Cold Start

**Decision: Blank + questions + manual creation. No ingestion in v1.0.**

### Rationale

The v1.0 hypothesis is "will users add Elenchus to their workflow and find it valuable?" If the wiki is pre-populated with imported content, we haven't tested whether users will create nodes and start threads themselves. Ingestion in v1.0 would produce a full wiki without validating the core behavior.

The onboarding questions don't create nodes. They create *context* that makes the AI more useful from the first message. The user starts with an empty wiki but an AI that already knows their domain, project, and open questions.

### Onboarding Flow

On first launch (detected by empty `~/elenchus/data/nodes/`):

1. Welcome: "Elenchus captures your thinking so it persists between sessions. Let's get oriented."
2. Questions (one at a time, conversational style):

```
1/5: What domain are you working in? (e.g., game design, ML research, software architecture)
2/5: What's the project or focus you're currently working on?
3/5: What's the biggest open question you're wrestling with right now?
4/5: Are there any topics you've recently made decisions about that you'd like to track?
5/5: How do you prefer to work — more exploratory (open threads) or more decisive (quick crystallization)?
```

3. Answers written to `~/elenchus/data/elenchus-context.json`
4. Main app opens with empty node list, prompt: "Start a thread — what are you thinking about?"

### Why No Seed Nodes

The addition bet is validated by whether users *create* nodes, not whether they browse imported ones. v1.5 retroactive analysis (reading Hermes session logs and proposing nodes) will be more accurate because v1.0 data shows what kind of nodes users actually create.

---

## Directory Structure

```
~/elenchus/                          # Install directory (code)
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── main.tsx                      # Web UI entry
│   ├── mcp-server.ts                 # MCP server entry
│   ├── core/
│   │   ├── node-store.ts             # Node CRUD, file I/O, search
│   │   ├── thread-engine.ts          # Thread writes, signal detection, stats
│   │   ├── git-manager.ts            # Debounced commits, git log
│   │   ├── cold-start.ts             # Onboarding questions, context
│   │   └── keywords.ts               # Shared decision keywords
│   ├── mcp/
│   │   ├── tools.ts                  # MCP tool definitions (6 tools)
│   │   ├── protocol.ts              # JSON-RPC message handling
│   │   └── ai-client.ts             # AI API calls (MiniMax/OpenAI-compatible)
│   ├── ui/
│   │   ├── App.tsx                   # Root, routing (Onboarding vs MainLayout)
│   │   ├── MainLayout.tsx            # Two-column layout
│   │   ├── components/
│   │   │   ├── ChatView.tsx          # Conversation interface
│   │   │   ├── NodeNav.tsx           # Sidebar: search, node list
│   │   │   ├── NodeDetail.tsx        # Node editor, past thread viewer
│   │   │   └── Onboarding.tsx        # Cold start flow
│   │   └── styles/
│   │       └── index.css             # Tailwind + dark theme
│   └── types/
│       └── index.ts                  # Shared TypeScript types

~/elenchus/data/                      # User data (git repo root)
├── nodes/
│   ├── token-economics.md
│   ├── token-economics.meta.json
│   └── ...
└── elenchus-context.json

~/.config/elenchus/                   # App config (XDG standard)
└── config.yaml
```

---

## MCP Tools (v1.0)

| Tool | Description | Returns |
|---|---|---|
| `elenchus_search` | Full-text search across node titles, content, and thread text | Array of node IDs + titles + snippets |
| `elenchus_read` | Read a node: content + frontmatter + full thread history | Full node object with thread |
| `elenchus_write` | Append an exchange to a node's thread. **AI call happens internally.** | Updated exchange + AI response |
| `elenchus_create` | Create a new node, optionally with initial content | New node ID and metadata |
| `elenchus_list` | List all nodes, optionally filtered by state or tag | Array of node summaries |
| `elenchus_update_state` | Change a node's state (open → decided → archived) | Updated node |

**Implementation:** `@modelcontextprotocol/sdk`. `package.json` bin entry: `"elenchus-mcp": "./dist/mcp-server.js"`.

---

## Web UI Design

### Visual Direction

**Dark mode, developer tool aesthetic.** Think Linear or Raycast — not Notion or consumer apps.

**Colors:**
```
background:       #0a0a0f  (near-black, slight blue tint)
surface:          #14141f  (card/panel backgrounds)
border:           #1e1e2e  (subtle borders)
text-primary:     #e4e4e7  (off-white)
text-secondary:   #71717a  (muted)
accent:           #6366f1  (indigo — interactive elements)
success:          #22c55e  (decided nodes)
warning:          #f59e0b  (open threads)
```

**Typography:**
- UI text: Inter (system-ui fallback)
- Node content / thread text: JetBrains Mono (monospace)
- Headings: Inter, semibold

### Components

**`<App />`** — Root. Manages routing: Onboarding (first run) or MainLayout.

**`<Onboarding />`** — Cold start flow. 5 questions, one at a time. Writes `elenchus-context.json` on completion.

**`<MainLayout />`** — Two-column: NodeNav (280px sidebar) + main content area.

**`<NodeNav />`** — Sidebar:
- Search bar (full-text, searches titles + content + threads)
- Node list sorted by `updated` descending
- Each item: title, state badge, relative timestamp ("2h ago")
- Filter tabs: All | Open | Decided | Archived
- "+ New Node" button at bottom

**`<ChatView />`** — Main area:
- Header: node title (editable), state badge, last exchange timestamp
- Thread history: chronological exchanges, human and AI clearly distinguished
- Input area: textarea grows with content, Shift+Enter for newline, Enter to send
- "Mark as Decided" button when state is open
- Collapsible node content panel

**`<NodeDetail />`** — Secondary view for reviewing past threads:
- Full markdown editor for node content
- Read-only thread viewer
- State toggle
- Tags editor

### State Management

React Context + `useReducer`. No external state library. Data held in memory and re-fetched from filesystem on demand.

---

## v1.0 Implementation Phases

### Phase 1: Foundation (Day 1-2)

Goal: Single-file nodes, git commits work.

1. Initialize Vite project: `npm create vite@latest elenchus -- --template react-ts`
2. Set up Tailwind CSS
3. `NodeStore`: create, read, update, list, search (all file I/O)
4. Git initialization on first run if not present
5. Auto-commit on node create/update
6. Verify: create node via code, check git log, verify commit message

**Deliverable:** Can create and edit markdown nodes from code. Git history is clean.

### Phase 2: Thread Engine (Day 2-3)

Goal: Threads work end-to-end with metadata.

1. `ThreadEngine`: append exchange, compute signals, update stats
2. JSON schema validation
3. Decision keyword detection
4. Branch detection (referencesPrior flag)
5. Verify: append exchanges, check metadata computed correctly

**Deliverable:** Thread writes with full metadata. Signal detection is accurate.

### Phase 3: MCP Server (Day 3-4)

Goal: MCP server runs, all 6 tools work, Hermes can connect.

1. Set up `@modelcontextprotocol/sdk`
2. Implement all 6 MCP tools
3. `package.json` bin entry for `elenchus-mcp`
4. AI client (`ai-client.ts`) calling MiniMax/OpenAI-compatible endpoint
5. Test: spawn MCP server, send JSON-RPC requests, verify responses
6. Test: connect Hermes, run a search, read a node

**Deliverable:** MCP server functional. Hermes connects.

### Phase 4: Web UI — Basic (Day 4-5)

Goal: Chat view works, messages write to thread, debounced commits fire.

1. Build `<MainLayout />`, `<NodeNav />`, `<ChatView />`
2. Wire thread writes from ChatView input (calls `elenchus_write` via MCP)
3. Implement debounced git commit timer
4. Verify: send message in web UI, check thread JSON updated, git commits after 30s pause

**Deliverable:** Web UI sends messages, threads persist, git commits debounced.

### Phase 5: Git Verification (Day 5)

Goal: Commit messages are meaningful, history is clean.

1. Full flow: create node, send 5 messages, pause 30s, check `git log`
2. Verify commit message formats match spec
3. Verify immediate commits on node creation and state change
4. Fix edge cases (empty commits, incorrect staging)

**Deliverable:** Git history is a clean changelog.

### Phase 6: Cold Start + Polish (Day 5-6)

Goal: Onboarding works, full UI is usable end-to-end.

1. `<Onboarding />` component
2. Store `elenchus-context.json` on completion
3. `<NodeDetail />` view
4. State toggle (open → decided)
5. Search in `<NodeNav />`
6. Dark theme polish, typography, spacing

**Deliverable:** First-time user experience complete. Shippable.

### Phase 7: Integration + README (Day 6-7)

Goal: Everything works together.

1. Full integration: install fresh, onboarding, create node, thread, check git, MCP
2. Write `README.md`: install, first run, connect Hermes, architecture
3. End-to-end test with Hermes

**Deliverable:** Shippable v1.0.

---

## v1.0 Success Metrics

| Metric | Measures | Threshold |
|---|---|---|
| Thread frequency | Are users starting threads? How long? | ≥3 threads/week after first week |
| Thread length distribution | Quick decisions (3-5 exchanges) vs deep exploration (20+) | Both exist; neither dominates |
| Open/Decided ratio | Are users closing nodes? | **Open threads staying open is not a failure.** Many threads should stay open indefinitely. Only flag if nearly 0% ever reach Decided — that suggests users don't see value in closing. |
| Return rate | Do users come back after first session? | ≥50% return within 7 days |
| MCP usage | Are agents connecting and using tools? | Any non-zero agent usage validates MCP |
| Thread metadata quality | Are decision keywords and signals firing correctly? | Manual spot-check |
| **New: Open thread value** | Do users return to open threads, add to them, reference them? | If yes — open threads are working as designed |

**Critical metric:** If return rate is low, the friction principle is wrong or UX is broken. Neither is recoverable in v1.5.

---

## v1.5 Forward References

All pending v1.0 data. These are directions, not commitments.

### Manage Mode
AI proposes structural changes (wikilinks, metadata updates, new nodes) with human approval. Low-risk changes auto-accepted via toggle.

**Dependency:** v1.0 thread metadata drives AI's understanding of node relationships. Without it, Manage mode proposals are blind.

### Confidence Spectrum (Hidden)
AI reads thread metadata and modulates behavior:
- High velocity + branching + no decision language → stay exploratory
- Low velocity + agreements + narrowing content → shift toward crystallization

**Primary signals:** `stats.convergenceSignals`, `stats.decisionLanguageCount`, `signals.isNegation`. v1.0 must capture all correctly.

### Retroactive Session Analysis
Read Hermes session logs from `~/.hermes/sessions/`, extract decisions and concepts, propose nodes.

**Dependency:** v1.0 data on what nodes users actually create makes pattern matching accurate.

### wiki-llm Awareness (Basic)
Elenchus MCP tools can read wiki-llm nodes when both are present. Cross-references via title-based links.

**Dependency:** Both systems exist as separate git repos by design. This is making the cross-reference path official.

---

## Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "simple-git": "^3.22.0",
    "gray-matter": "^4.0.3",
    "uuid": "^9.0.0",
    "openai": "^4.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/uuid": "^9.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0",
    "vite": "^5.4.0"
  }
}
```

---

## Open Questions

These are deferred until v1.0 data is available.

| Question | Phase | What Would Inform It |
|---|---|---|
| Can AI reliably detect confidence spectrum transitions from thread patterns? | v1.5 | Thread length, convergence signal distribution, decision language frequency |
| Do users expect closed conclusions or are they comfortable with open threads? | v1.0 | Return rate, thread abandonment rate, user feedback. If most threads stay open indefinitely, that's not a problem — it's the expected behavior. |
| When does a thread become decided — manual only or AI-suggested with approval? | v1.5 | Open/Decided ratio, whether nodes stay open indefinitely. If most stay open, AI-suggested crystallization may not be needed. |
| Do cold start questions create useful context? | v1.0 | AI quality on first message with context vs without |
| What's the actual contradiction false positive rate? | v2.0 | Real decided-node pairs, AI detection accuracy |
| What level of ambient nudges do users find valuable vs annoying? | v4.0 | User feedback, opt-out rate |
| Do users want multiplayer eventually? | v5.0 | Demand signal from community |
| Should Elenchus and wiki-llm eventually merge or stay parallel? | v5.0 | How users actually use both |
| Does AI reasoning about its own reasoning feel useful or unsettling? | v2+ | User feedback on AI self-examination feature |

---

## Risk Register

| Risk | Likelihood | Impact | Phase | Mitigation |
|---|---|---|---|---|
| Users don't form thinking-in-wiki habit | Medium | Critical | v1.0 | Friction-reduce: MCP captures from existing tools. Cold start orients AI. Addition bet means partial use still valuable. |
| Users expect final answers / resolved conclusions | Medium | Medium | v1.0+ | Explicit design: crystallization is optional. Many threads stay open. The value is in the reasoning, not the conclusion. Documentation and onboarding must frame this clearly. |
| Contradiction detection has high false positive rate | Medium | High | v2.0 | Start high-confidence only. Require explicit conflict statements. Let users tune sensitivity. Never auto-resolve. |
| Complexity creep makes product overwhelming | High | High | All | Ruthless MVP scoping. Each phase validates before next. Features are opt-in. Open-ended threads are the norm, not a failure state — reduces pressure to build resolution machinery. |
| AI behavior inconsistent across thread patterns | Medium | Medium | v1.5 | Hidden spectrum: AI modulates gradually. User correction is instant. Worst case is mistimed summary, not broken feature. |
| Ambient intelligence becomes notification spam | High | High | v4.0 | Separate scanning agent. Batch insights. User controls sensitivity. Default to low frequency. Easy toggle to disable. |
| Jeff's MiniMax API gets overloaded with trial users | Low | Medium | v1.0 | Per-user rate limits added later if needed. API key replacement is trivial. |

---

### The Philosophy in Brief

**Why Elenchus exists:** Every AI session generates knowledge. It disappears because there's nowhere for it to persist with its reasoning intact.

**What it does:** Turns thinking into persistent, connected knowledge — on your own computer, git-backed, MCP-native.

**What makes it different:**
- Threads are first-class data (not just chat history)
- Contradiction detection across your entire knowledge graph
- Decision provenance: every decision carries its reasoning chain
- Friction principle: thinking happens where it already happens, Elenchus captures it
- AI can reason with itself — Elenchus can be applied to Elenchus, examining its own logic and mental models

**What it is not:**
- Not a storage tool (doesn't just store notes)
- Not a chat app (conversations persist and connect)
- Not a wiki with AI assistance (AI is a participant, not a librarian)
- Not SaaS (runs locally, user owns their data)

---

## On Crystallization and Open-Ended Thinking

**Most thinking does not conclude. Most dialogues stay open.**

This is not a failure of the system. It is a feature of knowledge itself.

In Plato's dialogues, Socrates rarely gives answers. The elenchus reveals contradictions, the interlocutor reaches *aporia* — perplexity, the recognition that one does not know — and then... the dialogue ends. Socrates never claims to have solved the problem. He claims only to have shown where the problem lies.

Life works the same way. We find the best-fitting solution with everything we know at the time. When we get new information, the solution may change. The question doesn't resolve; it evolves. The thinking was still worth having.

**Elenchus accommodates this.**

Crystallization is not forced. A node stays `open` as long as the thinking is alive. The thread accumulates — every exchange, every reversal, every new angle. When a decision is made, it can be marked `decided` and the thread closes. But many nodes will stay open indefinitely, and that is correct. The world changes. The thinking adapts.

**The three states mean:**
- `open` — thinking is still active. The question is alive.
- `decided` — a conclusion was reached, at least for now. The thread is closed but preserved.
- `archived` — superseded. A newer node picked up the thread.

The confidence spectrum (hidden in v1.0, visible later) tracks where in the convergence process a thread is. Seed → Exploring → Converging → Decided → Archived. But this is a *spectrum*, not a requirement. Some threads converge. Some meander for months and finally get archived without ever reaching a decision. Both are valid outcomes.

**The product earns its name when it surfaces contradictions — not when it forces conclusions.**

---

## AI Reasoning With Itself

**Elenchus can reason about Elenchus.**

The AI can use Elenchus to examine its own logic. It can surface internal contradictions in its reasoning. It can apply the elenchus method to its own mental models.

This is a natural extension of the core mechanic: the contradiction engine runs across the user's knowledge graph. The user is one node of reasoning. The AI is another. The elenchus works across both.

Example: The AI proposes a feature decision. The user asks: "Does this contradict what we decided about X last month?" The AI consults the relevant nodes, finds the contradiction, and surfaces it — not as an attack, but as the elenchus: here is where your thinking has tension. What do you want to do with that?

Later: The AI could run the elenchus on itself proactively. "I've been reasoning about the token economy in these three threads. I've noticed a tension between my reasoning in Thread A and Thread B. Here it is. Want me to examine it further?"

This is v2+ territory. But the architecture must be designed for it from the beginning: threads are attributed to participants (human/AI). The AI's reasoning chains are stored and queryable. The contradiction engine must be able to compare AI reasoning to AI reasoning, not just human reasoning to human reasoning.

**This is what makes Elenchus genuinely different from every other AI tool.** Most AI tools try to be right. Elenchus tries to show you where you're wrong — including the AI itself.

---

## Next Steps

- [ ] Review this document and flag anything that needs changing
- [ ] Begin Phase 1: Initialize Vite project, set up Tailwind, implement NodeStore
- [ ] On first build-ready version: test onboarding flow end-to-end
- [ ] On MCP server ready: add to Hermes config, verify `elenchus_*` tools appear
- [ ] On web UI ready: test full thread flow — create node, exchange messages, check git log

---

*Last updated: 2026-04-14*
*Maintained by: Socraticblock / Hermes*
