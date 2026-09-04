const LINE_COLORS: Record<string, string> = {
  purple: "var(--line-purple)",
  green: "var(--line-green)",
  yellow: "var(--line-yellow)",
  pink: "var(--line-pink)",
  blue: "var(--line-blue)",
};

export function lineColor(line: string): string {
  return LINE_COLORS[line] ?? "#888";
}

export function LineBadge({ line, label }: { line: string; label?: string }) {
  const name = label ?? `${line.charAt(0).toUpperCase()}${line.slice(1)} Line`;
  return (
    <span className="line-badge" style={{ color: lineColor(line) }}>
      <span className="line-dot" style={{ background: lineColor(line) }} />
      {name}
    </span>
  );
}
