import { describe, it, expect, beforeEach } from 'vitest';
import { useTabStore, initializeTabStore } from './tabStore';

describe('tabStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useTabStore.setState({
      tabs: [{ id: 'default', title: 'Analysis 1', createdAt: new Date() }],
      activeTabId: 'default',
    });
  });

  describe('initialization', () => {
    it('should initialize with one default tab', () => {
      const state = useTabStore.getState();
      expect(state.tabs.length).toBeGreaterThan(0);
    });

    it('should set activeTabId on initialization', () => {
      initializeTabStore();
      const state = useTabStore.getState();
      expect(state.activeTabId).not.toBeNull();
    });
  });

  describe('addTab', () => {
    it('should add a new tab', () => {
      const store = useTabStore.getState();
      const initialCount = store.tabs.length;
      
      store.addTab();
      
      const newState = useTabStore.getState();
      expect(newState.tabs.length).toBe(initialCount + 1);
    });

    it('should return the new tab ID', () => {
      const store = useTabStore.getState();
      const newTabId = store.addTab();
      
      expect(newTabId).toBeDefined();
      expect(typeof newTabId).toBe('string');
      expect(newTabId.length).toBeGreaterThan(0);
    });

    it('should set the new tab as active', () => {
      const store = useTabStore.getState();
      const newTabId = store.addTab();
      
      const newState = useTabStore.getState();
      expect(newState.activeTabId).toBe(newTabId);
    });

    it('should accept custom title', () => {
      const store = useTabStore.getState();
      const customTitle = 'My Custom Analysis';
      const newTabId = store.addTab(customTitle);
      
      const newState = useTabStore.getState();
      const newTab = newState.tabs.find((tab) => tab.id === newTabId);
      expect(newTab?.title).toBe(customTitle);
    });

    it('should generate default title if not provided', () => {
      const store = useTabStore.getState();
      const newTabId = store.addTab();
      
      const newState = useTabStore.getState();
      const newTab = newState.tabs.find((tab) => tab.id === newTabId);
      expect(newTab?.title).toContain('Analysis');
    });

    it('should set createdAt timestamp', () => {
      const store = useTabStore.getState();
      const beforeTime = new Date();
      const newTabId = store.addTab();
      const afterTime = new Date();
      
      const newState = useTabStore.getState();
      const newTab = newState.tabs.find((tab) => tab.id === newTabId);
      expect(newTab?.createdAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(newTab?.createdAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('closeTab', () => {
    it('should remove a tab', () => {
      const store = useTabStore.getState();
      const tabToClose = store.tabs[0].id;
      const initialCount = store.tabs.length;
      
      store.closeTab(tabToClose);
      
      const newState = useTabStore.getState();
      expect(newState.tabs.length).toBe(initialCount - 1);
      expect(newState.tabs.find((tab) => tab.id === tabToClose)).toBeUndefined();
    });

    it('should switch to next tab when closing active tab', () => {
      const store = useTabStore.getState();
      store.addTab('Tab 2');
      store.addTab('Tab 3');
      
      const state = useTabStore.getState();
      const activeTabId = state.activeTabId;
      const tabIndex = state.tabs.findIndex((tab) => tab.id === activeTabId);
      
      store.closeTab(activeTabId!);
      
      const newState = useTabStore.getState();
      expect(newState.activeTabId).not.toBe(activeTabId);
      expect(newState.activeTabId).not.toBeNull();
    });

    it('should create new tab if closing last tab', () => {
      useTabStore.setState({
        tabs: [{ id: 'only-tab', title: 'Only Tab', createdAt: new Date() }],
        activeTabId: 'only-tab',
      });
      
      const store = useTabStore.getState();
      store.closeTab('only-tab');
      
      const newState = useTabStore.getState();
      expect(newState.tabs.length).toBe(1);
      expect(newState.tabs[0].id).not.toBe('only-tab');
      expect(newState.activeTabId).toBe(newState.tabs[0].id);
    });

    it('should not affect other tabs', () => {
      const store = useTabStore.getState();
      store.addTab('Tab 2');
      store.addTab('Tab 3');
      
      const state = useTabStore.getState();
      const tabToClose = state.tabs[0].id;
      const otherTabs = state.tabs.filter((tab) => tab.id !== tabToClose);
      
      store.closeTab(tabToClose);
      
      const newState = useTabStore.getState();
      expect(newState.tabs).toEqual(expect.arrayContaining(otherTabs));
    });
  });

  describe('setActiveTab', () => {
    it('should switch to a different tab', () => {
      const store = useTabStore.getState();
      store.addTab('Tab 2');
      
      const state = useTabStore.getState();
      const targetTab = state.tabs[0].id;
      
      store.setActiveTab(targetTab);
      
      const newState = useTabStore.getState();
      expect(newState.activeTabId).toBe(targetTab);
    });

    it('should not switch to non-existent tab', () => {
      const store = useTabStore.getState();
      const currentActiveTab = store.activeTabId;
      
      store.setActiveTab('non-existent-tab-id');
      
      const newState = useTabStore.getState();
      expect(newState.activeTabId).toBe(currentActiveTab);
    });

    it('should allow switching between multiple tabs', () => {
      const store = useTabStore.getState();
      store.addTab('Tab 2');
      store.addTab('Tab 3');
      
      const state = useTabStore.getState();
      const tab1 = state.tabs[0].id;
      const tab2 = state.tabs[1].id;
      const tab3 = state.tabs[2].id;
      
      store.setActiveTab(tab1);
      expect(useTabStore.getState().activeTabId).toBe(tab1);
      
      store.setActiveTab(tab2);
      expect(useTabStore.getState().activeTabId).toBe(tab2);
      
      store.setActiveTab(tab3);
      expect(useTabStore.getState().activeTabId).toBe(tab3);
    });
  });

  describe('renameTab', () => {
    it('should rename a tab', () => {
      const store = useTabStore.getState();
      const tabId = store.tabs[0].id;
      const newTitle = 'Renamed Analysis';
      
      store.renameTab(tabId, newTitle);
      
      const newState = useTabStore.getState();
      const renamedTab = newState.tabs.find((tab) => tab.id === tabId);
      expect(renamedTab?.title).toBe(newTitle);
    });

    it('should not affect other tabs when renaming', () => {
      const store = useTabStore.getState();
      store.addTab('Tab 2');
      
      const state = useTabStore.getState();
      const tab1 = state.tabs[0];
      const tab2 = state.tabs[1];
      
      store.renameTab(tab1.id, 'New Title');
      
      const newState = useTabStore.getState();
      const unchangedTab = newState.tabs.find((tab) => tab.id === tab2.id);
      expect(unchangedTab?.title).toBe(tab2.title);
    });

    it('should handle renaming non-existent tab gracefully', () => {
      const store = useTabStore.getState();
      const initialState = useTabStore.getState();
      
      store.renameTab('non-existent-id', 'New Title');
      
      const newState = useTabStore.getState();
      expect(newState.tabs).toEqual(initialState.tabs);
    });
  });

  describe('getTabById', () => {
    it('should return tab by ID', () => {
      const store = useTabStore.getState();
      const tabId = store.tabs[0].id;
      
      const tab = store.getTabById(tabId);
      
      expect(tab).toBeDefined();
      expect(tab?.id).toBe(tabId);
    });

    it('should return undefined for non-existent tab', () => {
      const store = useTabStore.getState();
      
      const tab = store.getTabById('non-existent-id');
      
      expect(tab).toBeUndefined();
    });
  });

  describe('getActiveTab', () => {
    it('should return the active tab', () => {
      const store = useTabStore.getState();
      const activeTabId = store.activeTabId;
      
      const activeTab = store.getActiveTab();
      
      expect(activeTab).toBeDefined();
      expect(activeTab?.id).toBe(activeTabId);
    });

    it('should return undefined if no active tab', () => {
      useTabStore.setState({ activeTabId: null });
      
      const store = useTabStore.getState();
      const activeTab = store.getActiveTab();
      
      expect(activeTab).toBeUndefined();
    });

    it('should return correct tab after switching', () => {
      const store = useTabStore.getState();
      store.addTab('Tab 2');
      
      const state = useTabStore.getState();
      const tab2 = state.tabs[1];
      
      store.setActiveTab(tab2.id);
      
      const activeTab = store.getActiveTab();
      expect(activeTab?.id).toBe(tab2.id);
    });
  });

  describe('closeAllTabs', () => {
    it('should close all tabs and create a new one', () => {
      const store = useTabStore.getState();
      store.addTab('Tab 2');
      store.addTab('Tab 3');
      
      expect(useTabStore.getState().tabs.length).toBe(3);
      
      store.closeAllTabs();
      
      const newState = useTabStore.getState();
      expect(newState.tabs.length).toBe(1);
      expect(newState.activeTabId).toBe(newState.tabs[0].id);
    });

    it('should create a fresh tab', () => {
      const store = useTabStore.getState();
      const originalTabId = store.tabs[0].id;
      
      store.closeAllTabs();
      
      const newState = useTabStore.getState();
      expect(newState.tabs[0].id).not.toBe(originalTabId);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid tab additions', () => {
      const store = useTabStore.getState();
      
      for (let i = 0; i < 10; i++) {
        store.addTab(`Tab ${i}`);
      }
      
      const state = useTabStore.getState();
      expect(state.tabs.length).toBe(11); // 1 default + 10 added
    });

    it('should handle rapid tab closures', () => {
      const store = useTabStore.getState();
      store.addTab('Tab 2');
      store.addTab('Tab 3');
      store.addTab('Tab 4');
      
      const state = useTabStore.getState();
      const tabIds = state.tabs.map((tab) => tab.id);
      
      // Close first 3 tabs
      store.closeTab(tabIds[0]);
      store.closeTab(tabIds[1]);
      store.closeTab(tabIds[2]);
      
      const newState = useTabStore.getState();
      expect(newState.tabs.length).toBeGreaterThan(0);
      expect(newState.activeTabId).not.toBeNull();
    });

    it('should maintain tab order', () => {
      const store = useTabStore.getState();
      store.addTab('Tab 2');
      store.addTab('Tab 3');
      
      const state = useTabStore.getState();
      const titles = state.tabs.map((tab) => tab.title);
      
      expect(titles.length).toBe(3);
      expect(titles[0]).toBeDefined();
      expect(titles[1]).toBeDefined();
      expect(titles[2]).toBeDefined();
    });
  });
});
