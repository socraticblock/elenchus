# Elenchus

> Collaborative Thinking Space for Human + AI

Elenchus is a thinking environment where ideas develop through conversation, crystallize into decisions, and persist as connected knowledge — on your own computer.

**Status:** v1.0 in development — follow updates at [elenchus.vercel.app](https://elenchus.vercel.app)

---

## What Is Elenchus

Elenchus (ἔλεγχος) is the Socratic method applied to your knowledge graph. It finds where your decisions contradict each other and shows you the contradiction — so you can resolve it.

Every thread exchange is saved. Every decision carries its reasoning. Contradictions surface automatically. The AI thinks alongside you, and remembers everything.

**The friction principle:** Thinking happens in chat, in the terminal, in the web app. Elenchus captures it. The wiki is what that knowledge looks like once it's captured.

---

## Demo

The current deployment at [elenchus.vercel.app](https://elenchus.vercel.app) runs in demo mode — data is stored in your browser's localStorage. It demonstrates the core UI and interaction patterns. The full version will persist to your local filesystem via MCP.

---

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Architecture

- **Web UI:** Vite + React + TypeScript + Tailwind CSS
- **Data:** Markdown + YAML frontmatter (nodes), JSON (thread metadata)
- **MCP Server:** Node.js, stdio transport, connects to Hermes
- **Storage:** Local filesystem with git versioning
- **AI:** MiniMax M2.7 via OpenAI-compatible API

---

## v1.0 Roadmap

See [elenchus-v1.0-roadmap.md](elenchus-v1.0-roadmap.md) for the full technical spec.

---

## Philosophy

Most thinking does not conclude. Most dialogues stay open. That is not a failure — it is a feature of knowledge itself.

Elenchus accommodates this. A thread stays `open` as long as thinking is active. It can be marked `decided` when a conclusion is reached, and `archived` when superseded. But many threads will stay open indefinitely, and that is correct.

The product earns its name when it surfaces contradictions — not when it forces conclusions.
