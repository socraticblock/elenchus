import { useState, useRef, useEffect } from 'react';
import type { Node } from '../../types';
import { ThreadEngine } from '../../core/thread-engine';
import { getElenchusContext } from '../../core/cold-start';
import type { Exchange } from '../../types';

const threadEngine = new ThreadEngine();

interface ChatViewProps {
  node: Node;
  onClose: () => void;
  onUpdate: (updates: Partial<Node>) => void;
}

// Demo AI responses for the prototype
const DEMO_RESPONSES = [
  "That's an interesting angle. What specifically are you trying to solve with this?",
  "I see the tension here. Let me surface the contradiction: you're arguing X but earlier in this thread you mentioned Y, which seems to point in a different direction.",
  "Have you considered how this connects to your decision about the token economy? There might be an implicit assumption you're making that carries over.",
  "This reminds me of the elenchus method — Socrates would say: let's examine what you mean by that precisely. Can you define X more carefully?",
  "Good thinking. The thread here is converging — it sounds like you're landing on an approach. Want to summarize what you've decided so far?",
  "I notice this thread has been exploring this topic for a while. Sometimes the best next step is to let it stay open and come back with fresh eyes tomorrow.",
  "Here's what I'm seeing across your reasoning: you're balancing A and B. The decision probably hinges on which one you weight more heavily. What does your gut say?",
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StateToggle({
  state,
  onChange,
}: {
  state: Node['state'];
  onChange: (s: Node['state']) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {(['open', 'decided', 'archived'] as Node['state'][]).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors ${
            state === s
              ? s === 'open'
                ? 'bg-[#f59e0b] text-black'
                : s === 'decided'
                  ? 'bg-[#22c55e] text-black'
                  : 'bg-[#71717a] text-black'
              : 'bg-[#1e1e2e] text-[#71717a] hover:text-[#e4e4e7]'
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export default function ChatView({ node, onClose, onUpdate }: ChatViewProps) {
  const [exchanges, setExchanges] = useState<Exchange[]>(() =>
    threadEngine.getExchanges(node.slug)
  );
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const context = getElenchusContext();

  useEffect(() => {
    // Reload exchanges when node changes
    setExchanges(threadEngine.getExchanges(node.slug));
  }, [node.slug]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [exchanges]);

  async function handleSend() {
    const text = input.trim();
    if (!text) return;

    setInput('');
    setIsTyping(true);

    // Write human exchange
    threadEngine.append(node.slug, node.id, 'human', text);
    setExchanges([...threadEngine.getExchanges(node.slug)]);

    // Demo AI response after a short delay
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));

    const demoResponse =
      DEMO_RESPONSES[Math.floor(Math.random() * DEMO_RESPONSES.length)];

    // Add context-aware prefix if we have it
    const contextPrefix =
      exchanges.length === 0 && context?.domain
        ? `[Context: ${context.domain} — ${context.project}] `
        : '';

    threadEngine.append(
      node.slug,
      node.id,
      'ai',
      contextPrefix + demoResponse
    );
    setExchanges([...threadEngine.getExchanges(node.slug)]);
    setIsTyping(false);
  }

  function handleStateChange(state: Node['state']) {
    onUpdate({ state });
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1e1e2e] bg-[#0a0a0f] px-6 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="rounded px-2 py-1 font-mono text-xs text-[#71717a] transition-colors hover:bg-[#14141f] hover:text-[#e4e4e7]"
          >
            ← Back
          </button>
          <div className="h-4 w-px bg-[#1e1e2e]" />
          <h2 className="truncate font-mono text-sm font-medium text-[#e4e4e7]">
            {node.title}
          </h2>
        </div>
        <StateToggle state={node.state} onChange={handleStateChange} />
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {exchanges.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="mb-2 font-mono text-sm text-[#e4e4e7]">
                Start the thinking
              </p>
              <p className="font-mono text-xs text-[#71717a]">
                Your thinking starts here. Every exchange is saved.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {exchanges.map((ex) => (
              <div key={ex.id}>
                {/* Decision language indicator */}
                {ex.signals.decisionLanguage && (
                  <div className="mb-1 flex items-center gap-1">
                    <span className="h-px flex-1 bg-[#22c55e]/30" />
                    <span className="font-mono text-[9px] text-[#22c55e]/60 uppercase tracking-widest px-2">
                      decision
                    </span>
                    <span className="h-px flex-1 bg-[#22c55e]/30" />
                  </div>
                )}

                <div className={`flex gap-3 ${ex.participant === 'human' ? '' : ''}`}>
                  {/* Avatar */}
                  <div
                    className={`mt-0.5 h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-mono font-semibold ${
                      ex.participant === 'human'
                        ? 'bg-[#6366f1] text-white'
                        : 'bg-[#22c55e] text-black'
                    }`}
                  >
                    {ex.participant === 'human' ? 'H' : 'AI'}
                  </div>

                  {/* Message */}
                  <div className="flex-1 min-w-0">
                    <div className="mb-1 flex items-baseline gap-2">
                      <span
                        className={`font-mono text-xs font-semibold ${
                          ex.participant === 'human'
                            ? 'text-[#6366f1]'
                            : 'text-[#22c55e]'
                        }`}
                      >
                        {ex.participant === 'human' ? 'You' : 'Elenchus'}
                      </span>
                      <span className="font-mono text-[10px] text-[#71717a]">
                        {formatTime(ex.timestamp)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-[#e4e4e7]">
                      {ex.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex gap-3">
                <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-[#22c55e] flex items-center justify-center text-[10px] font-mono font-semibold text-black">
                  AI
                </div>
                <div className="flex-1">
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className="font-mono text-xs font-semibold text-[#22c55e]">
                      Elenchus
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#71717a] [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#71717a] [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#71717a] [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      {node.state !== 'archived' && (
        <div className="border-t border-[#1e1e2e] p-4">
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Think with Elenchus..."
              rows={1}
              className="flex-1 resize-none rounded-lg border border-[#1e1e2e] bg-[#14141f] px-4 py-3 font-mono text-sm text-[#e4e4e7] placeholder-[#71717a] outline-none transition-colors focus:border-[#6366f1]"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className={`rounded-lg px-4 py-3 font-mono text-sm transition-all ${
                input.trim() && !isTyping
                  ? 'bg-[#6366f1] text-white hover:bg-[#5558e3] cursor-pointer'
                  : 'bg-[#1e1e2e] text-[#71717a] cursor-default'
              }`}
            >
              Send
            </button>
          </div>
          <p className="mt-2 text-center font-mono text-[10px] text-[#71717a]">
            Press Enter to send · Shift+Enter for newline
          </p>
        </div>
      )}
    </div>
  );
}
