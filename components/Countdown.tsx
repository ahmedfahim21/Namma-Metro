"use client";

import { useEffect, useState } from "react";

const R = 9;
const CIRCUMFERENCE = 2 * Math.PI * R;

function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Ticks down to the next departure once a second, rolling to the following
 * train when it reaches zero. Isolated in its own component so the
 * per-second re-render doesn't touch the rest of the itinerary card.
 */
export function Countdown({
  seconds,
  headwaySeconds,
}: {
  seconds: number;
  headwaySeconds: number;
}) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - started) / 1000;
      const left = seconds - elapsed;
      // Past this departure — count down to the one after it.
      setRemaining(left > 0 ? left : headwaySeconds + (left % headwaySeconds));
    }, 1000);
    return () => clearInterval(id);
  }, [seconds, headwaySeconds]);

  const progress = Math.min(1, Math.max(0, remaining / Math.max(1, headwaySeconds)));

  return (
    <span className="inline-flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden className="shrink-0 -rotate-90">
        <circle cx="11" cy="11" r={R} fill="none" stroke="var(--hairline-strong)" strokeWidth="2.5" />
        <circle
          cx="11"
          cy="11"
          r={R}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span className="tnum text-[1.0625rem] font-semibold text-ink" aria-live="off">
        {mmss(remaining)}
      </span>
    </span>
  );
}
