/** UI invalidation only; memory_nodes remains the single source of truth. */
export const MEMORY_NODES_CHANGED = 'sully:memory-nodes-changed';

export function notifyMemoryNodesChanged(charId?: string): void {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(MEMORY_NODES_CHANGED, { detail: { charId } }));
    }
}
