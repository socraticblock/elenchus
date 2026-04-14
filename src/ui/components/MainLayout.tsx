import { useState, useEffect } from 'react';
import type { Node, NodeSummary } from '../../types';
import { NodeStore } from '../../core/node-store';
import NodeNav from './NodeNav';
import ChatView from './ChatView';

const nodeStore = new NodeStore();

export default function MainLayout() {
  const [nodes, setNodes] = useState<NodeSummary[]>([]);
  const [activeNode, setActiveNode] = useState<Node | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'decided' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewNodeModal, setShowNewNodeModal] = useState(false);
  const [newNodeTitle, setNewNodeTitle] = useState('');

  function refreshNodes() {
    const f = filter === 'all' ? undefined : { state: filter as Node['state'] };
    setNodes(nodeStore.list(f));
  }

  function handleSelectNode(summary: NodeSummary) {
    const node = nodeStore.read(summary.id);
    setActiveNode(node);
  }

  function handleCreateNode(title: string) {
    const node = nodeStore.create(title);
    setShowNewNodeModal(false);
    setNewNodeTitle('');
    refreshNodes();
    setActiveNode(node);
  }

  function handleUpdateNode(updates: Partial<Node>) {
    if (!activeNode) return;
    const updated = nodeStore.update(activeNode.slug, updates);
    if (updated) setActiveNode(updated);
    refreshNodes();
  }

  function handleCloseNode() {
    setActiveNode(null);
  }

  useEffect(() => {
    refreshNodes();
  }, [filter]);

  return (
    <div className="flex h-full w-full bg-[#0a0a0f]">
      {/* Sidebar */}
      <NodeNav
        nodes={nodes}
        activeSlug={activeNode?.slug}
        filter={filter}
        searchQuery={searchQuery}
        onSelect={handleSelectNode}
        onFilterChange={setFilter}
        onSearchChange={setSearchQuery}
        onNewNode={() => setShowNewNodeModal(true)}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeNode ? (
          <ChatView
            node={activeNode}
            onClose={handleCloseNode}
            onUpdate={handleUpdateNode}
          />
        ) : (
          <EmptyState onNewNode={() => setShowNewNodeModal(true)} />
        )}
      </div>

      {/* New Node Modal */}
      {showNewNodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[#1e1e2e] bg-[#14141f] p-6 shadow-2xl">
            <h2 className="mb-4 font-mono text-base font-semibold text-[#e4e4e7]">
              Create a new thread
            </h2>
            <input
              type="text"
              value={newNodeTitle}
              onChange={(e) => setNewNodeTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newNodeTitle.trim()) {
                  handleCreateNode(newNodeTitle.trim());
                }
                if (e.key === 'Escape') {
                  setShowNewNodeModal(false);
                  setNewNodeTitle('');
                }
              }}
              placeholder="What's on your mind?"
              autoFocus
              className="mb-4 w-full rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] px-4 py-3 font-mono text-sm text-[#e4e4e7] placeholder-[#71717a] outline-none transition-colors focus:border-[#6366f1]"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowNewNodeModal(false);
                  setNewNodeTitle('');
                }}
                className="rounded-lg px-4 py-2 font-mono text-sm text-[#71717a] transition-colors hover:text-[#e4e4e7]"
              >
                Cancel
              </button>
              <button
                onClick={() => newNodeTitle.trim() && handleCreateNode(newNodeTitle.trim())}
                disabled={!newNodeTitle.trim()}
                className={`rounded-lg px-4 py-2 font-mono text-sm transition-all ${
                  newNodeTitle.trim()
                    ? 'bg-[#6366f1] text-white hover:bg-[#5558e3] cursor-pointer'
                    : 'bg-[#1e1e2e] text-[#71717a] cursor-default'
                }`}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onNewNode }: { onNewNode: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h2 className="mb-2 font-mono text-lg font-medium text-[#e4e4e7]">
          No thread selected
        </h2>
        <p className="font-mono text-sm text-[#71717a]">
          Pick a node from the sidebar, or start a new thread.
        </p>
      </div>
      <button
        onClick={onNewNode}
        className="rounded-lg bg-[#6366f1] px-6 py-3 font-mono text-sm text-white transition-colors hover:bg-[#5558e3]"
      >
        Start a new thread →
      </button>
    </div>
  );
}
