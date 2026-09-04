"use client";

import { useId, useMemo, useState } from "react";
import type { Station } from "@/packages/network/src/schema";
import { searchStations } from "@/lib/network";

export function StationCombobox({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: Station | null;
  onChange: (station: Station) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const id = useId();

  const results = useMemo(() => searchStations(query), [query]);

  return (
    <div className="relative flex-1">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
        {label}
      </label>
      <input
        id={id}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
        placeholder={placeholder ?? "Search a station"}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        autoComplete="off"
      />
      {open && query && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-surface shadow-lg">
          {results.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-background"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(s);
                  setQuery(s.name);
                  setOpen(false);
                }}
              >
                {s.name}
                {s.interchange && (
                  <span className="ml-2 text-xs text-muted">interchange</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
