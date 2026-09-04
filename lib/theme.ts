export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "nm-theme";
const listeners = new Set<() => void>();

/**
 * Inlined in <head> before paint so a stored preference is applied before
 * first render — without it the page flashes the system theme on load.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}}catch(e){}})();`;

export function getThemePreference(): ThemePreference {
  if (typeof document === "undefined") return "system";
  const attr = document.documentElement.dataset.theme;
  return attr === "light" || attr === "dark" ? attr : "system";
}

export function setThemePreference(next: ThemePreference) {
  if (next === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = next;
  }
  try {
    if (next === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private browsing or storage disabled — the in-memory choice still holds
    // for this page view, it just won't survive a reload.
  }
  listeners.forEach((l) => l());
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getServerThemeSnapshot(): ThemePreference {
  return "system";
}
