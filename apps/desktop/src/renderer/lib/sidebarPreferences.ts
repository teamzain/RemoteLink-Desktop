const VISIBLE_KEY = 'remote365_sidebar_visible';
const ORDER_KEY = 'remote365_sidebar_order';

export interface SidebarPreferences {
  hidden: string[];
  order: string[];
}

const safeParseArray = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : [];
  } catch {
    return [];
  }
};

export const getSidebarPreferences = (): SidebarPreferences => {
  return {
    hidden: safeParseArray(localStorage.getItem(VISIBLE_KEY)),
    order: safeParseArray(localStorage.getItem(ORDER_KEY)),
  };
};

export const saveSidebarPreferences = (prefs: SidebarPreferences) => {
  try {
    localStorage.setItem(VISIBLE_KEY, JSON.stringify(prefs.hidden));
    localStorage.setItem(ORDER_KEY, JSON.stringify(prefs.order));
  } catch (err) {
    console.warn('[sidebarPreferences] Failed to persist', err);
  }
};

export const resetSidebarPreferences = () => {
  try {
    localStorage.removeItem(VISIBLE_KEY);
    localStorage.removeItem(ORDER_KEY);
  } catch {}
};

// Apply hidden + order to a list of nav items.
// `protectedIds` are never hidden even if they appear in the hidden set
// (the catch-all for items the UI depends on).
export const applySidebarPreferences = <T extends { id: string }>(
  items: T[],
  prefs: SidebarPreferences,
  protectedIds: string[] = []
): T[] => {
  const hiddenSet = new Set(prefs.hidden.filter((id) => !protectedIds.includes(id)));
  const visible = items.filter((item) => !hiddenSet.has(item.id));
  if (prefs.order.length === 0) return visible;

  const indexOf = (id: string) => {
    const idx = prefs.order.indexOf(id);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };
  return [...visible].sort((a, b) => indexOf(a.id) - indexOf(b.id));
};
