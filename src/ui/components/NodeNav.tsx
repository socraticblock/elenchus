import type { NodeSummary } from '../../types';

type Filter = 'all' | 'open' | 'decided' | 'archived';

interface NodeNavProps {
  nodes: NodeSummary[];
  activeSlug?: string;
  filter: Filter;
  searchQuery: string;
  onSelect: (node: NodeSummary) => void;
  onFilterChange: (f: Filter) => void;
  onSearchChange: (q: string) => void;
  onNewNode: () => void;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function StateBadge({ state }: { state: NodeSummary['state'] }) {
  const colors = {
    open: 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20',
    decided: 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20',
    archived: 'bg-[#71717a]/10 text-[#71717a] border-[#71717a]/20',
  };

  return (
    <span
      className={`rounded-full border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
        colors[state]
      }`}
    >
      {state}
    </span>
  );
}

export default function NodeNav({
  nodes,
  activeSlug,
  filter,
  searchQuery,
  onSelect,
  onFilterChange,
  onSearchChange,
  onNewNode,
}: NodeNavProps) {
  return (
    <div className="flex h-full w-[280px] flex-col border-r border-[#1e1e2e] bg-[#0a0a0f]">
      {/* Header */}
      <div className="border-b border-[#1e1e2e] p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-[#e4e4e7]">Elenchus</span>
          <span className="rounded bg-[#6366f1]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#6366f1]">
            DEMO
          </span>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search threads..."
          className="w-full rounded-lg border border-[#1e1e2e] bg-[#14141f] px-3 py-2 font-mono text-xs text-[#e4e4e7] placeholder-[#71717a] outline-none transition-colors focus:border-[#6366f1]"
        />
      </div>

      {/* Filters */}
      <div className="flex border-b border-[#1e1e2e] p-2 gap-1">
        {(['all', 'open', 'decided', 'archived'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`flex-1 rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors ${
              filter === f
                ? 'bg-[#6366f1] text-white'
                : 'text-[#71717a] hover:text-[#e4e4e7]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-y-auto">
        {nodes.length === 0 ? (
          <div className="p-4 text-center">
            <p className="font-mono text-xs text-[#71717a]">
              {filter === 'all' ? 'No threads yet' : `No ${filter} threads`}
            </p>
          </div>
        ) : (
          nodes.map((node) => (
            <button
              key={node.slug}
              onClick={() => onSelect(node)}
              className={`group flex w-full flex-col items-start gap-1 border-b border-[#1e1e2e] p-3 text-left transition-colors ${
                activeSlug === node.slug
                  ? 'bg-[#14141f]'
                  : 'hover:bg-[#14141f]/50'
              }`}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="font-mono text-sm text-[#e4e4e7] truncate flex-1">
                  {node.title}
                </span>
                <StateBadge state={node.state} />
              </div>
              <div className="flex w-full items-center justify-between">
                <span className="font-mono text-[10px] text-[#71717a]">
                  {relativeTime(node.updated)}
                </span>
                {node.tags.length > 0 && (
                  <div className="flex gap-1">
                    {node.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-[#1e1e2e] px-1 font-mono text-[9px] text-[#71717a]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* New node button */}
      <div className="border-t border-[#1e1e2e] p-3">
        <button
          onClick={onNewNode}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#6366f1] py-2 font-mono text-sm text-white transition-colors hover:bg-[#5558e3]"
        >
          <span>+</span>
          <span>New Thread</span>
        </button>
      </div>
    </div>
  );
}
