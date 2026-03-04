/**
 * Tab Persistence Utilities
 * Save and restore tab state from localStorage
 */

import { useTabStore, Tab } from '@/stores/tabStore';
import { useTabContentStore, TabContentState } from '@/stores/tabContentStore';
// NEW: persist AI panel results (charts, tables, interpretations) across project switches + reloads
import {
  useAIPanelStore,
  PanelResult,
  TabCustomizations,
} from '@/stores/aiPanelStore';

const STORAGE_KEY = 'nuphorm-tabs-state';
const STORAGE_VERSION = '1.0';

// Per-project tab snapshots: nuphorm-proj-tabs-{projectId}
const PROJECT_TABS_KEY_PREFIX = 'nuphorm-proj-tabs-';

// ── AI panel data snapshot type ───────────────────────────────────────────────

/**
 * NEW: Serializable slice of useAIPanelStore — the three records that hold all
 * per-tab analysis results and visual customizations.
 */
export interface AIPanelData {
  resultsByTab: Record<string, PanelResult[]>;
  activeResultIdByTab: Record<string, string | null>;
  customizationsByTab: Record<string, TabCustomizations>;
}

// ── Size guard ────────────────────────────────────────────────────────────────

/**
 * NEW: Trim large arrays inside panel results so a snapshot never blows past
 * localStorage's ~5 MB per-origin limit.
 *
 * Rules:
 *  • tableData rows → capped at 100 rows (the raw dataset table)
 *  • chart labels / dataset points → capped at 500 entries
 *  • Everything else (analysis text, stats table, edits) → kept in full
 */
function sanitizeAIPanelData(data: AIPanelData): AIPanelData {
  const sanitizeResult = (r: PanelResult): PanelResult => ({
    ...r,
    tableData: r.tableData
      ? {
          headers: r.tableData.headers,
          rows: Array.isArray(r.tableData.rows)
            ? r.tableData.rows.slice(0, 100)
            : r.tableData.rows,
        }
      : undefined,
    analysisResults: r.analysisResults
      ? {
          ...r.analysisResults,
          chart_data: r.analysisResults.chart_data
            ? {
                ...r.analysisResults.chart_data,
                labels: Array.isArray(r.analysisResults.chart_data.labels)
                  ? r.analysisResults.chart_data.labels.slice(0, 500)
                  : r.analysisResults.chart_data.labels,
                datasets: Array.isArray(r.analysisResults.chart_data.datasets)
                  ? r.analysisResults.chart_data.datasets.map((ds: any) => ({
                      ...ds,
                      data: Array.isArray(ds.data) ? ds.data.slice(0, 500) : ds.data,
                    }))
                  : r.analysisResults.chart_data.datasets,
              }
            : r.analysisResults.chart_data,
        }
      : r.analysisResults,
  });

  return {
    resultsByTab: Object.fromEntries(
      Object.entries(data.resultsByTab).map(([tabId, results]) => [
        tabId,
        results.map(sanitizeResult),
      ])
    ),
    activeResultIdByTab: data.activeResultIdByTab,
    customizationsByTab: data.customizationsByTab,
  };
}

/**
 * NEW: Read the current aiPanelStore state into a serializable snapshot.
 */
function readAIPanelData(): AIPanelData {
  const { resultsByTab, activeResultIdByTab, customizationsByTab } =
    useAIPanelStore.getState();
  return sanitizeAIPanelData({ resultsByTab, activeResultIdByTab, customizationsByTab });
}

// ── Per-project tab snapshot types ───────────────────────────────────────────

interface ProjectTabSnapshot {
  version: string;
  tabs: Tab[];
  activeTabId: string | null;
  tabContent: Record<string, TabContentState>;
  // NEW: AI-generated results, active result pointers, and chart customizations
  aiPanelData?: AIPanelData;
}

// ── Per-project snapshot helpers ─────────────────────────────────────────────

/**
 * Save the current project's full tab state to localStorage.
 * Call this before switching away from a project.
 *
 * NEW: now also captures aiPanelStore (results, customizations, active result)
 *      so switching back to a project restores all previously-generated outputs.
 * UNCHANGED: same call signature — callers do not need to change.
 */
export const saveProjectTabSnapshot = (
  projectId: string,
  tabs: Tab[],
  activeTabId: string | null,
  tabContent: Record<string, TabContentState>
): void => {
  try {
    if (!projectId) return;
    // NEW: include AI panel results in the snapshot
    const aiPanelData = readAIPanelData();
    const snapshot: ProjectTabSnapshot = {
      version: STORAGE_VERSION,
      tabs,
      activeTabId,
      tabContent,
      aiPanelData,                    // NEW
    };
    localStorage.setItem(`${PROJECT_TABS_KEY_PREFIX}${projectId}`, JSON.stringify(snapshot));
  } catch (error) {
    // QuotaExceededError: retry without tableData rows
    if (
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      console.warn('[TabPersistence] Storage quota exceeded — retrying without tableData rows');
      try {
        if (!projectId) return;
        const aiPanelData = readAIPanelData();
        // Strip tableData rows to free space
        const stripped: AIPanelData = {
          ...aiPanelData,
          resultsByTab: Object.fromEntries(
            Object.entries(aiPanelData.resultsByTab).map(([tabId, results]) => [
              tabId,
              results.map((r) => ({ ...r, tableData: undefined })),
            ])
          ),
        };
        const snapshot: ProjectTabSnapshot = {
          version: STORAGE_VERSION, tabs, activeTabId, tabContent, aiPanelData: stripped,
        };
        localStorage.setItem(`${PROJECT_TABS_KEY_PREFIX}${projectId}`, JSON.stringify(snapshot));
      } catch (_) { /* give up gracefully */ }
    } else {
      console.error('[TabPersistence] Failed to save project tab snapshot:', error);
    }
  }
};

/**
 * Load the tab snapshot for a specific project.
 * Returns null if the project has no saved tabs or data is invalid.
 *
 * NEW: snapshot now includes aiPanelData when available.
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
 * NEW: includes aiPanelData for full cross-session persistence.
 */
interface StoredTabState {
  version: string;
  timestamp: number;
  tabs: Tab[];
  activeTabId: string | null;
  tabContent: Record<string, TabContentState>;
  // NEW: AI panel results persisted for page-reload recovery
  aiPanelData?: AIPanelData;
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
 * Save tab state to localStorage (debounced, 1 s).
 *
 * NEW: also saves aiPanelStore so AI-generated results survive a page reload.
 * REMOVED: was only saving tabStore + tabContentStore — panel results were lost on reload.
 */
export const saveTabState = debounce(() => {
  try {
    const { tabs, activeTabId } = useTabStore.getState();
    const { tabContent } = useTabContentStore.getState();
    // NEW: capture AI panel results
    const aiPanelData = readAIPanelData();

    const state: StoredTabState = {
      version: STORAGE_VERSION,
      timestamp: Date.now(),
      tabs,
      activeTabId,
      tabContent,
      aiPanelData,                    // NEW
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      // Retry without tableData if over quota
      console.warn('[TabPersistence] Quota exceeded on global save — retrying without tableData rows');
      try {
        const { tabs, activeTabId } = useTabStore.getState();
        const { tabContent } = useTabContentStore.getState();
        const aiPanelData = readAIPanelData();
        const stripped: AIPanelData = {
          ...aiPanelData,
          resultsByTab: Object.fromEntries(
            Object.entries(aiPanelData.resultsByTab).map(([tabId, results]) => [
              tabId,
              results.map((r) => ({ ...r, tableData: undefined })),
            ])
          ),
        };
        const state: StoredTabState = {
          version: STORAGE_VERSION, timestamp: Date.now(),
          tabs, activeTabId, tabContent, aiPanelData: stripped,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (_) { /* give up gracefully */ }
    } else {
      console.error('[TabPersistence] Failed to save state:', error);
    }
  }
}, 1000);

/**
 * Load tab state from localStorage
 */
export const loadTabState = (): StoredTabState | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
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

    return state;
  } catch (error) {
    console.error('[TabPersistence] Failed to load state:', error);
    return null;
  }
};

/**
 * Restore tab state from localStorage.
 * Call this on app mount.
 *
 * NEW: also restores aiPanelStore so AI-generated results survive a page reload.
 * REMOVED: was only restoring tabStore + tabContentStore — panel results were lost.
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

    // NEW: restore AI panel results, active pointers, and customizations
    if (saved.aiPanelData) {
      useAIPanelStore.setState({
        resultsByTab:        saved.aiPanelData.resultsByTab,
        activeResultIdByTab: saved.aiPanelData.activeResultIdByTab,
        customizationsByTab: saved.aiPanelData.customizationsByTab,
      });
    }

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
 * Hook to set up auto-save on store changes.
 * Call this in your component's useEffect.
 */
export const useAutoSaveTabState = () => {
  useTabStore.subscribe(() => { saveTabState(); });
  useTabContentStore.subscribe(() => { saveTabState(); });
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

    if (state.version !== STORAGE_VERSION) {
      throw new Error(
        `Version mismatch: expected ${STORAGE_VERSION}, got ${state.version}`
      );
    }

    if (!Array.isArray(state.tabs) || state.tabs.length === 0) {
      throw new Error('Invalid tabs data');
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
      return { savedStateSize: 0, lastSaveTime: null, tabCount: 0, contentSize: 0 };
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
    return { savedStateSize: 0, lastSaveTime: null, tabCount: 0, contentSize: 0 };
  }
};
