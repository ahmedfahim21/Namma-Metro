/**
 * A clock the live-train view runs on. It normally tracks the real time, but
 * can be sped up or dragged to another time of day. Kept outside React state
 * so that only the layers that draw trains re-render as it ticks.
 */
export interface SimClock {
  subscribe(listener: () => void): () => void;
  /** Simulated instant as epoch milliseconds; 0 before the clock has started. */
  getSnapshot(): number;
  setSpeed(multiplier: number): void;
  /** Jump to a time of day (seconds past midnight) on the current simulated day. */
  jumpTo(epochMs: number): void;
  resetToNow(): void;
}

export function createSimClock({ calm }: { calm: boolean }): SimClock {
  const listeners = new Set<() => void>();
  let simulated = 0;
  let snapshot = 0;
  let speed = 1;
  let frame: number | null = null;
  let lastFrame = 0;
  let lastNotify = 0;

  const notify = (now: number) => {
    snapshot = simulated;
    lastNotify = now;
    for (const listener of listeners) listener();
  };

  const tick = (now: number) => {
    simulated += (now - lastFrame) * speed;
    lastFrame = now;
    // In real time a train barely moves in a second; redraw every frame only when sped up.
    const interval = calm ? 10_000 : speed === 1 ? 1000 : 0;
    if (now - lastNotify >= interval) notify(now);
    frame = requestAnimationFrame(tick);
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      if (frame === null) {
        if (simulated === 0) simulated = Date.now();
        lastFrame = performance.now();
        notify(lastFrame);
        frame = requestAnimationFrame(tick);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && frame !== null) {
          cancelAnimationFrame(frame);
          frame = null;
        }
      };
    },
    getSnapshot: () => snapshot,
    setSpeed(multiplier) {
      speed = multiplier;
    },
    jumpTo(epochMs) {
      simulated = epochMs;
      notify(performance.now());
    },
    resetToNow() {
      simulated = Date.now();
      notify(performance.now());
    },
  };
}
