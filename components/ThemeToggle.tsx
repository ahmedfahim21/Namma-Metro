"use client";

import { useSyncExternalStore } from "react";
import {
  getServerThemeSnapshot,
  getThemePreference,
  setThemePreference,
  subscribeTheme,
  type ThemePreference,
} from "@/lib/theme";

const ORDER: ThemePreference[] = ["system", "light", "dark"];
const LABEL: Record<ThemePreference, string> = {
  system: "Match system theme",
  light: "Light theme",
  dark: "Dark theme",
};

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, getThemePreference, getServerThemeSnapshot);

  return (
    <button
      type="button"
      onClick={() => setThemePreference(ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length])}
      className="grid h-8 w-8 place-items-center rounded-md text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
      title={LABEL[theme]}
      aria-label={LABEL[theme]}
    >
      {theme === "dark" ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      ) : theme === "light" ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5m16.2-6.7-1.6 1.6M6.9 17.1l-1.6 1.6m13.4 0-1.6-1.6M6.9 6.9 5.3 5.3"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}
