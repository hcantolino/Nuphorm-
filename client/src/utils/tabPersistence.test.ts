import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveTabState,
  loadTabState,
  restoreTabState,
  clearTabState,
  getTabStateSize,
  getLastSaveTime,
  exportTabState,
  importTabState,
  getStorageStats,
} from './tabPersistence';
import { useTabStore } from '@/stores/tabStore';
import { useTabContentStore } from '@/stores/tabContentStore';

describe('tabPersistence', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Reset stores
    useTabStore.setState({
      tabs: [{ id: 'tab-1', title: 'Tab 1', createdAt: new Date() }],
      activeTabId: 'tab-1',
    });

    useTabContentStore.setState({ tabContent: {} });
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('saveTabState', () => {
    it('should save tab state to localStorage', (done) => {
      saveTabState();

      // Wait for debounce
      setTimeout(() => {
        const saved = localStorage.getItem('nuphorm-tabs-state');
        expect(saved).toBeTruthy();

        const parsed = JSON.parse(saved!);
        expect(parsed.version).toBe('1.0');
        expect(parsed.tabs).toHaveLength(1);
        expect(parsed.activeTabId).toBe('tab-1');
        done();
      }, 1100);
    });

    it('should include timestamp in saved state', (done) => {
      saveTabState();

      setTimeout(() => {
        const saved = localStorage.getItem('nuphorm-tabs-state');
        const parsed = JSON.parse(saved!);

        expect(parsed.timestamp).toBeTruthy();
        expect(typeof parsed.timestamp).toBe('number');
        expect(parsed.timestamp).toBeGreaterThan(0);
        done();
      }, 1100);
    });

    it('should debounce multiple saves', (done) => {
      const spy = vi.spyOn(Storage.prototype, 'setItem');

      saveTabState();
      saveTabState();
      saveTabState();

      setTimeout(() => {
        // Should only save once due to debounce
        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
        done();
      }, 1100);
    });
  });

  describe('loadTabState', () => {
    it('should load tab state from localStorage', (done) => {
      saveTabState();

      setTimeout(() => {
        const loaded = loadTabState();

        expect(loaded).toBeTruthy();
        expect(loaded?.version).toBe('1.0');
        expect(loaded?.tabs).toHaveLength(1);
        expect(loaded?.activeTabId).toBe('tab-1');
        done();
      }, 1100);
    });

    it('should return null if no saved state', () => {
      const loaded = loadTabState();
      expect(loaded).toBeNull();
    });

    it('should return null if version mismatch', () => {
      const invalidState = {
        version: '2.0',
        timestamp: Date.now(),
        tabs: [],
        activeTabId: null,
        tabContent: {},
      };

      localStorage.setItem('nuphorm-tabs-state', JSON.stringify(invalidState));

      const loaded = loadTabState();
      expect(loaded).toBeNull();
    });

    it('should return null if invalid tabs data', () => {
      const invalidState = {
        version: '1.0',
        timestamp: Date.now(),
        tabs: [],
        activeTabId: null,
        tabContent: {},
      };

      localStorage.setItem('nuphorm-tabs-state', JSON.stringify(invalidState));

      const loaded = loadTabState();
      expect(loaded).toBeNull();
    });

    it('should handle corrupted JSON gracefully', () => {
      localStorage.setItem('nuphorm-tabs-state', 'invalid json{');

      const loaded = loadTabState();
      expect(loaded).toBeNull();
    });
  });

  describe('restoreTabState', () => {
    it('should restore tab state to stores', (done) => {
      // Add multiple tabs
      const store = useTabStore.getState();
      store.addTab('Tab 2');
      store.addTab('Tab 3');

      saveTabState();

      setTimeout(() => {
        // Clear stores
        useTabStore.setState({
          tabs: [],
          activeTabId: null,
        });

        // Restore
        const success = restoreTabState();

        expect(success).toBe(true);
        expect(useTabStore.getState().tabs).toHaveLength(3);
        expect(useTabStore.getState().activeTabId).toBe('tab-1');
        done();
      }, 1100);
    });

    it('should return false if no saved state', () => {
      const success = restoreTabState();
      expect(success).toBe(false);
    });

    it('should restore tab content', (done) => {
      // Add content
      const contentStore = useTabContentStore.getState();
      contentStore.setTabChartConfig('tab-1', { type: 'bar' });

      saveTabState();

      setTimeout(() => {
        // Clear content
        useTabContentStore.setState({ tabContent: {} });

        // Restore
        restoreTabState();

        const config = useTabContentStore
          .getState()
          .getTabChartConfig('tab-1');
        expect(config.type).toBe('bar');
        done();
      }, 1100);
    });
  });

  describe('clearTabState', () => {
    it('should remove saved state from localStorage', (done) => {
      saveTabState();

      setTimeout(() => {
        expect(localStorage.getItem('nuphorm-tabs-state')).toBeTruthy();

        clearTabState();

        expect(localStorage.getItem('nuphorm-tabs-state')).toBeNull();
        done();
      }, 1100);
    });
  });

  describe('getTabStateSize', () => {
    it('should return size of saved state in bytes', (done) => {
      saveTabState();

      setTimeout(() => {
        const size = getTabStateSize();

        expect(size).toBeGreaterThan(0);
        expect(typeof size).toBe('number');
        done();
      }, 1100);
    });

    it('should return 0 if no saved state', () => {
      const size = getTabStateSize();
      expect(size).toBe(0);
    });
  });

  describe('getLastSaveTime', () => {
    it('should return timestamp of last save', (done) => {
      const beforeSave = new Date();
      saveTabState();

      setTimeout(() => {
        const lastSave = getLastSaveTime();
        const afterSave = new Date();

        expect(lastSave).toBeTruthy();
        expect(lastSave!.getTime()).toBeGreaterThanOrEqual(beforeSave.getTime());
        expect(lastSave!.getTime()).toBeLessThanOrEqual(afterSave.getTime());
        done();
      }, 1100);
    });

    it('should return null if no saved state', () => {
      const lastSave = getLastSaveTime();
      expect(lastSave).toBeNull();
    });
  });

  describe('exportTabState', () => {
    it('should export state as JSON string', (done) => {
      saveTabState();

      setTimeout(() => {
        const exported = exportTabState();

        expect(typeof exported).toBe('string');
        const parsed = JSON.parse(exported);
        expect(parsed.version).toBe('1.0');
        expect(parsed.tabs).toBeTruthy();
        done();
      }, 1100);
    });

    it('should throw if no saved state', () => {
      expect(() => exportTabState()).toThrow();
    });

    it('should export with proper formatting', (done) => {
      saveTabState();

      setTimeout(() => {
        const exported = exportTabState();

        // Should have newlines and indentation
        expect(exported).toContain('\n');
        expect(exported).toContain('  ');
        done();
      }, 1100);
    });
  });

  describe('importTabState', () => {
    it('should import state from JSON string', (done) => {
      saveTabState();

      setTimeout(() => {
        const exported = exportTabState();

        // Clear localStorage
        localStorage.clear();

        const success = importTabState(exported);

        expect(success).toBe(true);
        expect(localStorage.getItem('nuphorm-tabs-state')).toBeTruthy();
        done();
      }, 1100);
    });

    it('should return false if invalid JSON', () => {
      const success = importTabState('invalid json{');
      expect(success).toBe(false);
    });

    it('should return false if version mismatch', () => {
      const invalidState = {
        version: '2.0',
        timestamp: Date.now(),
        tabs: [{ id: 'tab-1', title: 'Tab 1', createdAt: new Date() }],
        activeTabId: 'tab-1',
        tabContent: {},
      };

      const success = importTabState(JSON.stringify(invalidState));
      expect(success).toBe(false);
    });

    it('should return false if invalid tabs data', () => {
      const invalidState = {
        version: '1.0',
        timestamp: Date.now(),
        tabs: [],
        activeTabId: null,
        tabContent: {},
      };

      const success = importTabState(JSON.stringify(invalidState));
      expect(success).toBe(false);
    });

    it('should restore state after import', (done) => {
      saveTabState();

      setTimeout(() => {
        const exported = exportTabState();

        // Clear stores
        useTabStore.setState({
          tabs: [],
          activeTabId: null,
        });

        // Import
        importTabState(exported);

        expect(useTabStore.getState().tabs).toHaveLength(1);
        expect(useTabStore.getState().activeTabId).toBe('tab-1');
        done();
      }, 1100);
    });
  });

  describe('getStorageStats', () => {
    it('should return storage statistics', (done) => {
      saveTabState();

      setTimeout(() => {
        const stats = getStorageStats();

        expect(stats.savedStateSize).toBeGreaterThan(0);
        expect(stats.lastSaveTime).toBeTruthy();
        expect(stats.tabCount).toBe(1);
        expect(stats.contentSize).toBeGreaterThanOrEqual(0);
        done();
      }, 1100);
    });

    it('should return zero stats if no saved state', () => {
      const stats = getStorageStats();

      expect(stats.savedStateSize).toBe(0);
      expect(stats.lastSaveTime).toBeNull();
      expect(stats.tabCount).toBe(0);
      expect(stats.contentSize).toBe(0);
    });

    it('should track multiple tabs', (done) => {
      const store = useTabStore.getState();
      store.addTab('Tab 2');
      store.addTab('Tab 3');

      saveTabState();

      setTimeout(() => {
        const stats = getStorageStats();

        expect(stats.tabCount).toBe(3);
        done();
      }, 1100);
    });

    it('should track content size', (done) => {
      const contentStore = useTabContentStore.getState();
      contentStore.setTabChartData('tab-1', [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ]);

      saveTabState();

      setTimeout(() => {
        const stats = getStorageStats();

        expect(stats.contentSize).toBeGreaterThan(0);
        done();
      }, 1100);
    });
  });

  describe('integration', () => {
    it('should save and restore complete workflow', (done) => {
      // Setup
      const tabStore = useTabStore.getState();
      tabStore.addTab('Tab 2');
      tabStore.addTab('Tab 3');
      tabStore.setActiveTab('tab-2');

      const contentStore = useTabContentStore.getState();
      contentStore.setTabChartConfig('tab-1', { type: 'bar' });
      contentStore.setTabChartConfig('tab-2', { type: 'line' });

      saveTabState();

      setTimeout(() => {
        // Clear everything
        useTabStore.setState({
          tabs: [],
          activeTabId: null,
        });
        useTabContentStore.setState({ tabContent: {} });

        // Restore
        restoreTabState();

        // Verify
        expect(useTabStore.getState().tabs).toHaveLength(3);
        expect(useTabStore.getState().activeTabId).toBe('tab-2');
        expect(
          useTabContentStore.getState().getTabChartConfig('tab-1').type
        ).toBe('bar');
        expect(
          useTabContentStore.getState().getTabChartConfig('tab-2').type
        ).toBe('line');

        done();
      }, 1100);
    });

    it('should handle export and import cycle', (done) => {
      // Setup
      const tabStore = useTabStore.getState();
      tabStore.addTab('Tab 2');

      saveTabState();

      setTimeout(() => {
        const exported = exportTabState();

        // Clear
        localStorage.clear();
        useTabStore.setState({
          tabs: [],
          activeTabId: null,
        });

        // Import
        importTabState(exported);

        // Verify
        expect(useTabStore.getState().tabs).toHaveLength(2);
        done();
      }, 1100);
    });
  });
});
