/**
 * Tab Persistence Utilities
 * Save and restore tab state from localStorage
 */

import { useTabStore, Tab } from '@/stores/tabStore';
import { useTabContentStore, TabContentState } from '@/stores/tabContentStore';

const STORAGE_KEY = 'nuphorm-tabs-state';
const STORAGE_VERSION = '1.0';

// Per-project tab snapshots: nuphorm-proj-tabs-{projectId}
const PROJECT_TABS_KEY_PREFIX = 'nuphorm-proj-tabs-';

// ── Per-project tab snapshot types ───────────────────────────────────────────

interface ProjectTabSnapshot {
  version: string;
  tabs: Tab[];
  activeTabId: string | null;
  tabContent: Record<string, TabContentState>;
}

// ── Per-project snapshot helpers ─────────────────────────────────────────────

/**
 * Save the current project's tab + content state to localStorage.
 * Call this before switching away from a project.
 */
export const saveProjectTabSnapshot = (
  projectId: string,
  tabs: Tab[],
  activeTabId: string | null,
  tabContent: Record<string, TabContentState>
): void => {
  try {
    if (!projectId) return;
    const snapshot: ProjectTabSnapshot = { version: STORAGE_VERSION, tabs, activeTabId, tabContent };
    localStorage.setItem(`${PROJECT_TABS_KEY_PREFIX}${projectId}`, JSON.stringify(snapshot));
  } catch (error) {
    console.error('[TabPersistence] Failed to save project tab snapshot:', error);
  }
};

/**
 * Load the tab snapshot for a specific project.
 * Returns null if the project has no saved tabs or data is invalid.
 */
export const loadProjectTabSnapshot = (projectId: string): ProjectTabSnapshot | null => {
  try {
    if (!projectId) return null;
    const saved = localStorage.getItem(`${PROJECT_TABS_KEY_PREFIX}${projectId}`);
    if (!saved) return null;
    const snapshot = JSON.parse(saved) as ProjectTabSnapshot;
    if (snapshot.version !== STORAGE_VERSION) return null;
    if (!Array.isArray(snapshot.tabs)) return null;
    return snapshot;
  } catch (error) {
    console.error('[TabPersistence] Failed to load project tab snapshot:', error);
    return null;
  }
};

/**
 * Remove the tab snapshot for a deleted project so localStorage stays clean.
 */
export const deleteProjectTabSnapshot = (projectId: string): void => {
  try {
    if (!projectId) return;
    localStorage.removeItem(`${PROJECT_TABS_KEY_PREFIX}${projectId}`);
  } catch (_) { /* harmless */ }
};

/**
 * Serializable tab state for storage
 */
interface StoredTabState {
  version: string;
  timestamp: number;
  tabs: Tab[];
  activeTabId: string | null;
  tabContent: Record<string, TabContentState>;
}

/**
 * Debounce function to limit save frequency
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}

/**
 * Save tab state to localStorage
 * Debounced to avoid excessive writes
 */
export const saveTabState = debounce(() => {
  try {
    const { tabs, activeTabId } = useTabStore.getState();
    const { tabContent } = useTabContentStore.getState();

    const state: StoredTabState = {
      version: STORAGE_VERSION,
      timestamp: Date.now(),
      tabs,
      activeTabId,
      tabContent,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    console.log('[TabPersistence] State saved to localStorage');
  } catch (error) {
    console.error('[TabPersistence] Failed to save state:', error);
  }
}, 1000);

/**
 * Load tab state from localStorage
 */
export const loadTabState = (): StoredTabState | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      console.log('[TabPersistence] No saved state found');
      return null;
    }

    const state = JSON.parse(saved) as StoredTabState;

    // Validate version
    if (state.version !== STORAGE_VERSION) {
      console.warn(
        '[TabPersistence] Version mismatch, ignoring saved state',
        state.version
      );
      return null;
    }

    // Validate data
    if (!Array.isArray(state.tabs) || state.tabs.length === 0) {
      console.warn('[TabPersistence] Invalid tabs data');
      return null;
    }

    console.log('[TabPersistence] State loaded from localStorage');
    return state;
  } catch (error) {
    console.error('[TabPersistence] Failed to load state:', error);
    return null;
  }
};

/**
 * Restore tab state from localStorage
 * Call this on app mount
 */
export const restoreTabState = () => {
  const saved = loadTabState();
  if (!saved) return false;

  try {
    // Restore tab store state
    useTabStore.setState({
      tabs: saved.tabs,
      activeTabId: saved.activeTabId,
    });

    // Restore tab content store state
    useTabContentStore.setState({
      tabContent: saved.tabContent,
    });

    console.log('[TabPersistence] State restored successfully');
    return true;
  } catch (error) {
    console.error('[TabPersistence] Failed to restore state:', error);
    return false;
  }
};

/**
 * Clear saved tab state
 */
export const clearTabState = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[TabPersistence] Saved state cleared');
  } catch (error) {
    console.error('[TabPersistence] Failed to clear state:', error);
  }
};

/**
 * Get size of saved state in bytes
 */
export const getTabStateSize = (): number => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return 0;
    return new Blob([saved]).size;
  } catch (error) {
    console.error('[TabPersistence] Failed to get state size:', error);
    return 0;
  }
};

/**
 * Get timestamp of last save
 */
export const getLastSaveTime = (): Date | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const state = JSON.parse(saved) as StoredTabState;
    return new Date(state.timestamp);
  } catch (error) {
    console.error('[TabPersistence] Failed to get last save time:', error);
    return null;
  }
};

/**
 * Hook to set up auto-save on store changes
 * Call this in your component's useEffect
 */
export const useAutoSaveTabState = () => {
  // Subscribe to tab store changes
  useTabStore.subscribe(() => {
    saveTabState();
  });

  // Subscribe to tab content store changes
  useTabContentStore.subscribe(() => {
    saveTabState();
  });
};

/**
 * Export state for debugging or manual backup
 */
export const exportTabState = (): string => {
  const saved = loadTabState();
  if (!saved) {
    throw new Error('No saved state to export');
  }
  return JSON.stringify(saved, null, 2);
};

/**
 * Import state from exported JSON
 */
export const importTabState = (json: string): boolean => {
  try {
    const state = JSON.parse(json) as StoredTabState;

    // Validate
    if (state.version !== STORAGE_VERSION) {
      throw new Error(
        `Version mismatch: expected ${STORAGE_VERSION}, got ${state.version}`
      );
    }

    if (!Array.isArray(state.tabs) || state.tabs.length === 0) {
      throw new Error('Invalid tabs data');
    }

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    // Restore
    return restoreTabState();
  } catch (error) {
    console.error('[TabPersistence] Failed to import state:', error);
    return false;
  }
};

/**
 * Storage statistics interface
 */
export interface StorageStats {
  savedStateSize: number;
  lastSaveTime: Date | null;
  tabCount: number;
  contentSize: number;
}

/**
 * Get storage stats
 */
export const getStorageStats = (): StorageStats => {
  try {
    const saved = loadTabState();
    if (!saved) {
      return {
        savedStateSize: 0,
        lastSaveTime: null,
        tabCount: 0,
        contentSize: 0,
      };
    }

    const contentSize = JSON.stringify(saved.tabContent).length;

    return {
      savedStateSize: getTabStateSize(),
      lastSaveTime: new Date(saved.timestamp),
      tabCount: saved.tabs.length,
      contentSize,
    };
  } catch (error) {
    console.error('[TabPersistence] Failed to get storage stats:', error);
    return {
      savedStateSize: 0,
      lastSaveTime: null,
      tabCount: 0,
      contentSize: 0,
    };
  }
};
