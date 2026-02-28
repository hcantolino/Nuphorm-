import { create } from 'zustand';
import { nanoid } from 'nanoid';

/**
 * Tab represents a single workspace session.
 * Each tab has its own AI chat, files, chart settings, and analysis results.
 */
export interface Tab {
  id: string;
  title: string;
  createdAt: Date;
}

interface TabStoreState {
  tabs: Tab[];
  activeTabId: string | null;

  addTab: (title?: string) => string; // Returns new tab ID
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  renameTab: (tabId: string, newTitle: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  getTabById: (tabId: string) => Tab | undefined;
  getActiveTab: () => Tab | undefined;
  /** Resets to a single fresh default tab (used for general resets). */
  closeAllTabs: () => void;
  /**
   * Empties the tab list entirely — tabs=[], activeTabId=null.
   * Used when switching projects so the new project starts with zero tabs.
   * Unlike closeAllTabs, no default tab is created.
   */
  clearAllTabs: () => void;
}

const createDefaultTab = (): Tab => ({
  id: nanoid(),
  title: `Analysis ${new Date().toLocaleTimeString()}`,
  createdAt: new Date(),
});

/**
 * Lazily access sibling stores to avoid circular-import risk at module load time.
 * Both tabContentStore and aiPanelStore do NOT import tabStore, so this is safe.
 */
function getTabContentStore(): { getState: () => { removeTabContent: (id: string) => void; resetTabContent: (id: string) => void } } {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@/stores/tabContentStore').useTabContentStore;
}
function getAIPanelStore(): { getState: () => { removeTab: (id: string) => void } } {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@/stores/aiPanelStore').useAIPanelStore;
}

export const useTabStore = create<TabStoreState>((set, get) => ({
  tabs: [createDefaultTab()],
  activeTabId: null,

  addTab: (title?: string) => {
    const newTab: Tab = {
      id: nanoid(),
      title: title || `Analysis ${new Date().toLocaleTimeString()}`,
      createdAt: new Date(),
    };

    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: newTab.id,
    }));

    // Initialize fresh isolated content for the new tab
    try {
      getTabContentStore().getState().resetTabContent(newTab.id);
    } catch (_) { /* store not yet loaded — harmless */ }

    return newTab.id;
  },

  closeTab: (tabId: string) => {
    set((state) => {
      const newTabs = state.tabs.filter((tab) => tab.id !== tabId);

      if (newTabs.length === 0) {
        const defaultTab = createDefaultTab();
        return { tabs: [defaultTab], activeTabId: defaultTab.id };
      }

      let newActiveTabId = state.activeTabId;
      if (state.activeTabId === tabId) {
        const closedIndex = state.tabs.findIndex((tab) => tab.id === tabId);
        if (closedIndex < newTabs.length) {
          newActiveTabId = newTabs[closedIndex].id;
        } else if (closedIndex > 0) {
          newActiveTabId = newTabs[closedIndex - 1].id;
        } else {
          newActiveTabId = newTabs[0].id;
        }
      }

      return { tabs: newTabs, activeTabId: newActiveTabId };
    });

    // Clean up isolated state for the closed tab
    try {
      getTabContentStore().getState().removeTabContent(tabId);
    } catch (_) { /* harmless */ }
    try {
      getAIPanelStore().getState().removeTab(tabId);
    } catch (_) { /* harmless */ }
    // Remove persisted attached-file list for this tab
    try {
      localStorage.removeItem(`biostat-tab-files-${tabId}`);
    } catch (_) { /* harmless */ }
  },

  setActiveTab: (tabId: string) => {
    set((state) => {
      if (state.tabs.some((tab) => tab.id === tabId)) {
        return { activeTabId: tabId };
      }
      return state;
    });
  },

  renameTab: (tabId: string, newTitle: string) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, title: newTitle } : tab
      ),
    }));
  },

  getTabById: (tabId: string) => get().tabs.find((tab) => tab.id === tabId),

  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find((tab) => tab.id === activeTabId);
  },

  closeAllTabs: () => {
    const { tabs } = get();
    const defaultTab = createDefaultTab();

    // Bulk clean up all existing tabs
    tabs.forEach((tab) => {
      try { getTabContentStore().getState().removeTabContent(tab.id); } catch (_) {}
      try { getAIPanelStore().getState().removeTab(tab.id); } catch (_) {}
      try { localStorage.removeItem(`biostat-tab-files-${tab.id}`); } catch (_) {}
    });

    set({ tabs: [defaultTab], activeTabId: defaultTab.id });
  },

  reorderTabs: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const newTabs = Array.from(state.tabs);
      const [movedTab] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, movedTab);
      return { tabs: newTabs };
    });
  },

  // ADDED: Empties the tab list without creating a replacement default tab.
  // Used for project-switch: the new project starts with zero open tabs and
  // the user clicks "+" to create their first analysis tab.
  clearAllTabs: () => {
    const { tabs } = get();
    tabs.forEach((tab) => {
      try { getTabContentStore().getState().removeTabContent(tab.id); } catch (_) {}
      try { getAIPanelStore().getState().removeTab(tab.id); } catch (_) {}
      try { localStorage.removeItem(`biostat-tab-files-${tab.id}`); } catch (_) {}
    });
    set({ tabs: [], activeTabId: null });
  },
}));

/**
 * Initialize the tab store with the first tab active.
 * Call once when the app loads (if not restoring from localStorage).
 */
export const initializeTabStore = () => {
  const state = useTabStore.getState();
  if (state.activeTabId === null && state.tabs.length > 0) {
    useTabStore.setState({ activeTabId: state.tabs[0].id });
  }
};

/**
 * Restore tabs from a previously saved state (e.g., localStorage).
 */
export const restoreTabsFromState = (tabs: Tab[], activeTabId: string | null) => {
  if (tabs.length > 0) {
    useTabStore.setState({ tabs, activeTabId: activeTabId || tabs[0].id });
  }
};

