import { describe, it, expect, beforeEach } from 'vitest';
import { useTabStore } from './tabStore';

describe('tabStore - reorderTabs', () => {
  beforeEach(() => {
    // Reset store before each test
    useTabStore.setState({
      tabs: [
        { id: 'tab-1', title: 'Tab 1', createdAt: new Date() },
        { id: 'tab-2', title: 'Tab 2', createdAt: new Date() },
        { id: 'tab-3', title: 'Tab 3', createdAt: new Date() },
      ],
      activeTabId: 'tab-1',
    });
  });

  describe('basic reordering', () => {
    it('should move tab from index 0 to index 1', () => {
      const store = useTabStore.getState();
      const initialOrder = store.tabs.map((t) => t.id);

      store.reorderTabs(0, 1);

      const newOrder = useTabStore.getState().tabs.map((t) => t.id);
      expect(newOrder).toEqual(['tab-2', 'tab-1', 'tab-3']);
    });

    it('should move tab from index 1 to index 0', () => {
      const store = useTabStore.getState();

      store.reorderTabs(1, 0);

      const newOrder = useTabStore.getState().tabs.map((t) => t.id);
      expect(newOrder).toEqual(['tab-2', 'tab-1', 'tab-3']);
    });

    it('should move tab from index 0 to end', () => {
      const store = useTabStore.getState();

      store.reorderTabs(0, 2);

      const newOrder = useTabStore.getState().tabs.map((t) => t.id);
      expect(newOrder).toEqual(['tab-2', 'tab-3', 'tab-1']);
    });

    it('should move tab from end to beginning', () => {
      const store = useTabStore.getState();

      store.reorderTabs(2, 0);

      const newOrder = useTabStore.getState().tabs.map((t) => t.id);
      expect(newOrder).toEqual(['tab-3', 'tab-1', 'tab-2']);
    });
  });

  describe('no-op reordering', () => {
    it('should handle reordering to same position', () => {
      const store = useTabStore.getState();
      const initialOrder = store.tabs.map((t) => t.id);

      store.reorderTabs(1, 1);

      const newOrder = useTabStore.getState().tabs.map((t) => t.id);
      expect(newOrder).toEqual(initialOrder);
    });
  });

  describe('edge cases', () => {
    it('should handle reordering with single tab', () => {
      useTabStore.setState({
        tabs: [{ id: 'tab-1', title: 'Tab 1', createdAt: new Date() }],
        activeTabId: 'tab-1',
      });

      const store = useTabStore.getState();
      store.reorderTabs(0, 0);

      const tabs = useTabStore.getState().tabs;
      expect(tabs).toHaveLength(1);
      expect(tabs[0].id).toBe('tab-1');
    });

    it('should handle reordering with two tabs', () => {
      useTabStore.setState({
        tabs: [
          { id: 'tab-1', title: 'Tab 1', createdAt: new Date() },
          { id: 'tab-2', title: 'Tab 2', createdAt: new Date() },
        ],
        activeTabId: 'tab-1',
      });

      const store = useTabStore.getState();
      store.reorderTabs(0, 1);

      const newOrder = useTabStore.getState().tabs.map((t) => t.id);
      expect(newOrder).toEqual(['tab-2', 'tab-1']);
    });

    it('should handle reordering with many tabs', () => {
      const manyTabs = Array.from({ length: 10 }, (_, i) => ({
        id: `tab-${i + 1}`,
        title: `Tab ${i + 1}`,
        createdAt: new Date(),
      }));

      useTabStore.setState({
        tabs: manyTabs,
        activeTabId: 'tab-1',
      });

      const store = useTabStore.getState();
      store.reorderTabs(0, 9);

      const newOrder = useTabStore.getState().tabs.map((t) => t.id);
      expect(newOrder[0]).toBe('tab-2');
      expect(newOrder[9]).toBe('tab-1');
    });
  });

  describe('active tab preservation', () => {
    it('should preserve active tab when reordering', () => {
      const store = useTabStore.getState();
      const activeTabId = store.activeTabId;

      store.reorderTabs(0, 2);

      expect(useTabStore.getState().activeTabId).toBe(activeTabId);
    });

    it('should preserve active tab even when moving it', () => {
      const store = useTabStore.getState();
      store.setActiveTab('tab-2');

      store.reorderTabs(1, 0);

      expect(useTabStore.getState().activeTabId).toBe('tab-2');
    });
  });

  describe('tab data preservation', () => {
    it('should preserve tab data during reorder', () => {
      const store = useTabStore.getState();
      const originalTab = store.tabs[0];

      store.reorderTabs(0, 2);

      const movedTab = useTabStore.getState().tabs[2];
      expect(movedTab).toEqual(originalTab);
    });

    it('should preserve all tab properties', () => {
      const store = useTabStore.getState();
      const originalTabs = store.tabs.map((t) => ({ ...t }));

      store.reorderTabs(0, 1);

      const newTabs = useTabStore.getState().tabs;
      expect(newTabs).toHaveLength(originalTabs.length);

      // Verify all tabs are still present
      const newIds = newTabs.map((t) => t.id);
      const originalIds = originalTabs.map((t) => t.id);
      expect(newIds.sort()).toEqual(originalIds.sort());
    });
  });

  describe('complex reordering sequences', () => {
    it('should handle multiple reorders in sequence', () => {
      const store = useTabStore.getState();

      store.reorderTabs(0, 1);
      expect(useTabStore.getState().tabs.map((t) => t.id)).toEqual([
        'tab-2',
        'tab-1',
        'tab-3',
      ]);

      store.reorderTabs(2, 0);
      expect(useTabStore.getState().tabs.map((t) => t.id)).toEqual([
        'tab-3',
        'tab-2',
        'tab-1',
      ]);

      store.reorderTabs(1, 2);
      expect(useTabStore.getState().tabs.map((t) => t.id)).toEqual([
        'tab-3',
        'tab-1',
        'tab-2',
      ]);
    });

    it('should handle reorder after adding tab', () => {
      const store = useTabStore.getState();
      const newTabId = store.addTab('Tab 4');

      expect(useTabStore.getState().tabs).toHaveLength(4);

      store.reorderTabs(3, 0);

      const newOrder = useTabStore.getState().tabs.map((t) => t.id);
      expect(newOrder[0]).toBe(newTabId);
    });

    it('should handle reorder after closing tab', () => {
      const store = useTabStore.getState();
      store.closeTab('tab-2');

      expect(useTabStore.getState().tabs).toHaveLength(2);

      store.reorderTabs(0, 1);

      const newOrder = useTabStore.getState().tabs.map((t) => t.id);
      expect(newOrder).toEqual(['tab-3', 'tab-1']);
    });
  });
});
