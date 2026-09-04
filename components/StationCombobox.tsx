"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Station } from "@/packages/network/src/schema";
import { searchStations, displayName } from "@/lib/network";
import { LineDot } from "./LineBadge";

/** Splits a name around the matched query so the match can be emphasised. */
function highlight(name: string, query: string) {
  const idx = name.toLowerCase().indexOf(query.trim().toLowerCase());
  if (!query.trim() || idx === -1) return <>{name}</>;
  const end = idx + query.trim().length;
  return (
    <>
      {name.slice(0, idx)}
      <b className="font-semibold">{name.slice(idx, end)}</b>
      {name.slice(end)}
    </>
  );
}

export function StationCombobox({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: Station | null;
  onChange: (station: Station | null) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value ? displayName(value) : "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const inputId = useId();

  // Keep the visible text in sync when the parent changes the selection
  // (swap button, route-page defaults) rather than the user typing.
  const selectedName = value ? displayName(value) : null;
  const lastSelectedRef = useRef(selectedName);
  useEffect(() => {
    if (lastSelectedRef.current !== selectedName) {
      lastSelectedRef.current = selectedName;
      setQuery(selectedName ?? "");
    }
  }, [selectedName]);

  const results = useMemo(() => {
    if (!open) return [];
    // An exact match means the field is showing a settled selection, not a
    // search — offer the whole list rather than the one thing already chosen.
    if (value && query === displayName(value)) return searchStations("", 8, value.id);
    return searchStations(query, 8);
  }, [query, open, value]);

  const showList = open && results.length > 0;

  function commit(station: Station) {
    onChange(station);
    setQuery(displayName(station));
    setOpen(false);
    setActive(0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(0);
        return;
      }
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (results.length === 0 ? 0 : (i + delta + results.length) % results.length));
      return;
    }
    if (e.key === "Enter" && showList && results[active]) {
      e.preventDefault();
      commit(results[active]);
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      setActive(0);
    }
  }

  return (
    <div className="relative">
      <label htmlFor={inputId} className="eyebrow block">
        {label}
      </label>
      <div className="mt-0.5 flex items-center gap-2">
        <input
          id={inputId}
          ref={inputRef}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-transparent text-[0.9375rem] font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink-faint"
          placeholder={placeholder ?? "Search stations"}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
            if (value) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
        {query && (
          <button
            type="button"
            aria-label={`Clear ${label.toLowerCase()}`}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-sunken hover:text-ink"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery("");
              onChange(null);
              inputRef.current?.focus();
              setOpen(true);
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path
                d="M2.5 2.5l7 7m0-7-7 7"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+10px)] z-20 max-h-72 overflow-auto rounded-lg border border-hairline-strong bg-surface py-1 shadow-[0_12px_32px_-8px_rgb(0_0_0/0.18)]"
        >
          {results.map((station, i) => (
            <li key={station.id}>
              <button
                type="button"
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                  i === active ? "bg-sunken" : ""
                }`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(station);
                }}
              >
                <span className="flex shrink-0 items-center gap-1">
                  {station.lines.map((m) => (
                    <LineDot key={m.line} line={m.line} size={7} />
                  ))}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink">
                  {highlight(displayName(station), query)}
                </span>
                {station.interchange && (
                  <span className="shrink-0 text-[0.6875rem] text-ink-faint">Interchange</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
