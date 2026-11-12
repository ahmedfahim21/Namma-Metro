import { type Graph, type LineNode, type Edge, nodeKey } from "./graph";

/** Minimal binary min-heap keyed by a numeric priority. */
class MinHeap<T> {
  private items: { priority: number; value: T }[] = [];

  push(priority: number, value: T) {
    this.items.push({ priority, value });
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].priority <= this.items[i].priority) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop(): T | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < this.items.length && this.items[l].priority < this.items[smallest].priority) smallest = l;
        if (r < this.items.length && this.items[r].priority < this.items[smallest].priority) smallest = r;
        if (smallest === i) break;
        [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
        i = smallest;
      }
    }
    return top.value;
  }

  get size() {
    return this.items.length;
  }
}

export interface WeightFn {
  /** Returns the priority cost of taking this edge; lower is preferred. */
  (edge: Edge): number;
}

export interface PathStep {
  node: LineNode;
  edge?: Edge; // edge taken to arrive at `node` (undefined for the start node)
}

/**
 * Multi-source, multi-target Dijkstra over the line-expanded graph.
 * Returns the lowest-priority path from any of `sources` to any of `targets`,
 * or null if unreachable.
 */
export function shortestPath(
  graph: Graph,
  sources: LineNode[],
  targets: LineNode[],
  weight: WeightFn,
): PathStep[] | null {
  const targetKeys = new Set(targets.map(nodeKey));
  const dist = new Map<string, number>();
  const prev = new Map<string, PathStep>();
  const heap = new MinHeap<LineNode>();

  for (const s of sources) {
    dist.set(nodeKey(s), 0);
    heap.push(0, s);
  }

  const visited = new Set<string>();

  while (heap.size > 0) {
    const current = heap.pop()!;
    const currentKey = nodeKey(current);
    if (visited.has(currentKey)) continue;
    visited.add(currentKey);

    if (targetKeys.has(currentKey)) {
      // Reconstruct path.
      const path: PathStep[] = [];
      let cursor: LineNode | undefined = current;
      let cursorKey = currentKey;
      while (cursor) {
        const step = prev.get(cursorKey);
        path.unshift({ node: cursor, edge: step?.edge });
        if (!step) break;
        cursor = step.node;
        cursorKey = nodeKey(cursor);
      }
      return path;
    }

    const currentDist = dist.get(currentKey) ?? Infinity;
    const edges = graph.adjacency.get(currentKey) ?? [];
    for (const edge of edges) {
      const toKey = nodeKey(edge.to);
      const w = weight(edge);
      const nd = currentDist + w;
      if (nd < (dist.get(toKey) ?? Infinity)) {
        dist.set(toKey, nd);
        prev.set(toKey, { node: current, edge });
        heap.push(nd, edge.to);
      }
    }
  }

  return null;
}

/**
 * Single-source Dijkstra to everywhere: the lowest cost to reach every node
 * from any of `sources`, plus the step taken to arrive at it.
 */
export function shortestTree(
  graph: Graph,
  sources: LineNode[],
  weight: WeightFn,
): { cost: Map<string, number>; arrivedBy: Map<string, PathStep> } {
  const cost = new Map<string, number>();
  const arrivedBy = new Map<string, PathStep>();
  const heap = new MinHeap<LineNode>();
  for (const s of sources) {
    cost.set(nodeKey(s), 0);
    heap.push(0, s);
  }
  const visited = new Set<string>();
  while (heap.size > 0) {
    const current = heap.pop()!;
    const currentKey = nodeKey(current);
    if (visited.has(currentKey)) continue;
    visited.add(currentKey);
    const currentCost = cost.get(currentKey) ?? Infinity;
    for (const edge of graph.adjacency.get(currentKey) ?? []) {
      const toKey = nodeKey(edge.to);
      const next = currentCost + weight(edge);
      if (next < (cost.get(toKey) ?? Infinity)) {
        cost.set(toKey, next);
        arrivedBy.set(toKey, { node: current, edge });
        heap.push(next, edge.to);
      }
    }
  }
  return { cost, arrivedBy };
}
