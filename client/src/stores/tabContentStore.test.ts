import { describe, it, expect, beforeEach } from 'vitest';
import { useTabContentStore, ChatMessage, FileMetadata } from './tabContentStore';

describe('tabContentStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useTabContentStore.setState({ tabContent: {} });
  });

  describe('initialization', () => {
    it('should return default content for non-existent tab', () => {
      const store = useTabContentStore.getState();
      const content = store.getTabContent('non-existent-tab');

      expect(content).toBeDefined();
      expect(content.chatMessages).toEqual([]);
      expect(content.files).toEqual([]);
      expect(content.chartConfig.type).toBe('line');
      expect(content.tableData).toEqual([]);
    });

    it('should have correct default chart config', () => {
      const store = useTabContentStore.getState();
      const config = store.getTabChartConfig('tab-1');

      expect(config.type).toBe('line');
      expect(config.showGrid).toBe(true);
      expect(config.yZero).toBe(false);
      expect(config.colorScheme).toBe('default');
    });
  });

  describe('chat messages', () => {
    it('should add a chat message to a tab', () => {
      const store = useTabContentStore.getState();
      const message: ChatMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
      };

      store.addChatMessage('tab-1', message);

      const messages = store.getTabChatMessages('tab-1');
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(message);
    });

    it('should maintain separate chat messages for different tabs', () => {
      const store = useTabContentStore.getState();
      const msg1: ChatMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Tab 1 message',
        timestamp: new Date(),
      };
      const msg2: ChatMessage = {
        id: 'msg-2',
        role: 'user',
        content: 'Tab 2 message',
        timestamp: new Date(),
      };

      store.addChatMessage('tab-1', msg1);
      store.addChatMessage('tab-2', msg2);

      expect(store.getTabChatMessages('tab-1')).toHaveLength(1);
      expect(store.getTabChatMessages('tab-2')).toHaveLength(1);
      expect(store.getTabChatMessages('tab-1')[0].content).toBe('Tab 1 message');
      expect(store.getTabChatMessages('tab-2')[0].content).toBe('Tab 2 message');
    });

    it('should set chat messages for a tab', () => {
      const store = useTabContentStore.getState();
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Message 1',
          timestamp: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Response 1',
          timestamp: new Date(),
        },
      ];

      store.setTabChatMessages('tab-1', messages);

      expect(store.getTabChatMessages('tab-1')).toHaveLength(2);
    });
  });

  describe('files', () => {
    it('should add a file to a tab', () => {
      const store = useTabContentStore.getState();
      const file: FileMetadata = {
        id: 'file-1',
        name: 'data.csv',
        size: 1024,
        type: 'text/csv',
        uploadedAt: new Date(),
      };

      store.addFile('tab-1', file);

      const files = store.getTabFiles('tab-1');
      expect(files).toHaveLength(1);
      expect(files[0]).toEqual(file);
    });

    it('should remove a file from a tab', () => {
      const store = useTabContentStore.getState();
      const file: FileMetadata = {
        id: 'file-1',
        name: 'data.csv',
        size: 1024,
        type: 'text/csv',
        uploadedAt: new Date(),
      };

      store.addFile('tab-1', file);
      expect(store.getTabFiles('tab-1')).toHaveLength(1);

      store.removeFile('tab-1', 'file-1');
      expect(store.getTabFiles('tab-1')).toHaveLength(0);
    });

    it('should maintain separate files for different tabs', () => {
      const store = useTabContentStore.getState();
      const file1: FileMetadata = {
        id: 'file-1',
        name: 'data1.csv',
        size: 1024,
        type: 'text/csv',
        uploadedAt: new Date(),
      };
      const file2: FileMetadata = {
        id: 'file-2',
        name: 'data2.csv',
        size: 2048,
        type: 'text/csv',
        uploadedAt: new Date(),
      };

      store.addFile('tab-1', file1);
      store.addFile('tab-2', file2);

      expect(store.getTabFiles('tab-1')).toHaveLength(1);
      expect(store.getTabFiles('tab-2')).toHaveLength(1);
      expect(store.getTabFiles('tab-1')[0].name).toBe('data1.csv');
      expect(store.getTabFiles('tab-2')[0].name).toBe('data2.csv');
    });

    it('should set files for a tab', () => {
      const store = useTabContentStore.getState();
      const files: FileMetadata[] = [
        {
          id: 'file-1',
          name: 'data1.csv',
          size: 1024,
          type: 'text/csv',
          uploadedAt: new Date(),
        },
        {
          id: 'file-2',
          name: 'data2.csv',
          size: 2048,
          type: 'text/csv',
          uploadedAt: new Date(),
        },
      ];

      store.setTabFiles('tab-1', files);

      expect(store.getTabFiles('tab-1')).toHaveLength(2);
    });
  });

  describe('chart configuration', () => {
    it('should update chart config for a tab', () => {
      const store = useTabContentStore.getState();

      store.setTabChartConfig('tab-1', { type: 'bar', showGrid: false });

      const config = store.getTabChartConfig('tab-1');
      expect(config.type).toBe('bar');
      expect(config.showGrid).toBe(false);
      expect(config.yZero).toBe(false); // Should keep default
    });

    it('should maintain separate chart configs for different tabs', () => {
      const store = useTabContentStore.getState();

      store.setTabChartConfig('tab-1', { type: 'line' });
      store.setTabChartConfig('tab-2', { type: 'bar' });

      expect(store.getTabChartConfig('tab-1').type).toBe('line');
      expect(store.getTabChartConfig('tab-2').type).toBe('bar');
    });

    it('should update custom colors in chart config', () => {
      const store = useTabContentStore.getState();
      const colors = { series1: '#FF0000', series2: '#00FF00' };

      store.setTabChartConfig('tab-1', { customColors: colors });

      const config = store.getTabChartConfig('tab-1');
      expect(config.customColors).toEqual(colors);
    });
  });

  describe('chart data', () => {
    it('should set chart data for a tab', () => {
      const store = useTabContentStore.getState();
      const chartData = [
        { name: 'Point 1', value: 100 },
        { name: 'Point 2', value: 200 },
      ];

      store.setTabChartData('tab-1', chartData);

      expect(store.getTabChartData('tab-1')).toEqual(chartData);
    });

    it('should maintain separate chart data for different tabs', () => {
      const store = useTabContentStore.getState();
      const data1 = [{ name: 'A', value: 1 }];
      const data2 = [{ name: 'B', value: 2 }];

      store.setTabChartData('tab-1', data1);
      store.setTabChartData('tab-2', data2);

      expect(store.getTabChartData('tab-1')).toEqual(data1);
      expect(store.getTabChartData('tab-2')).toEqual(data2);
    });
  });

  describe('table data', () => {
    it('should set table data for a tab', () => {
      const store = useTabContentStore.getState();
      const tableData = [
        { id: 1, name: 'Row 1', value: 100 },
        { id: 2, name: 'Row 2', value: 200 },
      ];
      const columns = ['id', 'name', 'value'];

      store.setTabTableData('tab-1', tableData, columns);

      expect(store.getTabTableData('tab-1')).toEqual(tableData);
      expect(store.getTabContent('tab-1').tableColumns).toEqual(columns);
    });

    it('should maintain separate table data for different tabs', () => {
      const store = useTabContentStore.getState();
      const data1 = [{ id: 1, value: 'A' }];
      const data2 = [{ id: 2, value: 'B' }];

      store.setTabTableData('tab-1', data1);
      store.setTabTableData('tab-2', data2);

      expect(store.getTabTableData('tab-1')).toEqual(data1);
      expect(store.getTabTableData('tab-2')).toEqual(data2);
    });
  });

  describe('analysis results', () => {
    it('should set analysis results for a tab', () => {
      const store = useTabContentStore.getState();
      const results = {
        mean: 42.5,
        stdDev: 10.2,
        pValue: 0.05,
      };

      store.setTabAnalysisResults('tab-1', results);

      expect(store.getTabAnalysisResults('tab-1')).toEqual(results);
    });

    it('should maintain separate analysis results for different tabs', () => {
      const store = useTabContentStore.getState();
      const results1 = { mean: 10 };
      const results2 = { mean: 20 };

      store.setTabAnalysisResults('tab-1', results1);
      store.setTabAnalysisResults('tab-2', results2);

      expect(store.getTabAnalysisResults('tab-1')).toEqual(results1);
      expect(store.getTabAnalysisResults('tab-2')).toEqual(results2);
    });
  });

  describe('selected measurements', () => {
    it('should set selected measurements for a tab', () => {
      const store = useTabContentStore.getState();
      const measurements = ['mean', 'median', 'stdDev'];

      store.setTabSelectedMeasurements('tab-1', measurements);

      const content = store.getTabContent('tab-1');
      expect(content.selectedMeasurements).toEqual(measurements);
    });

    it('should maintain separate measurements for different tabs', () => {
      const store = useTabContentStore.getState();

      store.setTabSelectedMeasurements('tab-1', ['mean']);
      store.setTabSelectedMeasurements('tab-2', ['median', 'stdDev']);

      expect(store.getTabContent('tab-1').selectedMeasurements).toEqual(['mean']);
      expect(store.getTabContent('tab-2').selectedMeasurements).toEqual([
        'median',
        'stdDev',
      ]);
    });
  });

  describe('last query tracking', () => {
    it('should set last query for a tab', () => {
      const store = useTabContentStore.getState();
      const query = 'create a mean for fold_change';

      store.setTabLastQuery('tab-1', query);

      const content = store.getTabContent('tab-1');
      expect(content.lastQuery).toBe(query);
    });

    it('should maintain separate queries for different tabs', () => {
      const store = useTabContentStore.getState();

      store.setTabLastQuery('tab-1', 'query 1');
      store.setTabLastQuery('tab-2', 'query 2');

      expect(store.getTabContent('tab-1').lastQuery).toBe('query 1');
      expect(store.getTabContent('tab-2').lastQuery).toBe('query 2');
    });
  });

  describe('bulk operations', () => {
    it('should update multiple fields at once', () => {
      const store = useTabContentStore.getState();
      const update = {
        chartConfig: { type: 'bar' as const, showGrid: false },
        selectedMeasurements: ['mean', 'median'],
        lastQuery: 'test query',
      };

      store.updateTabContent('tab-1', update);

      const content = store.getTabContent('tab-1');
      expect(content.chartConfig.type).toBe('bar');
      expect(content.selectedMeasurements).toEqual(['mean', 'median']);
      expect(content.lastQuery).toBe('test query');
    });

    it('should reset tab content to defaults', () => {
      const store = useTabContentStore.getState();

      // Add some data
      store.addChatMessage('tab-1', {
        id: 'msg-1',
        role: 'user',
        content: 'test',
        timestamp: new Date(),
      });
      store.setTabChartConfig('tab-1', { type: 'bar' });

      // Reset
      store.resetTabContent('tab-1');

      const content = store.getTabContent('tab-1');
      expect(content.chatMessages).toEqual([]);
      expect(content.chartConfig.type).toBe('line');
    });

    it('should remove tab content', () => {
      const store = useTabContentStore.getState();

      store.addChatMessage('tab-1', {
        id: 'msg-1',
        role: 'user',
        content: 'test',
        timestamp: new Date(),
      });

      expect(store.getTabContent('tab-1').chatMessages).toHaveLength(1);

      store.removeTabContent('tab-1');

      // After removal, should get default content
      expect(store.getTabContent('tab-1').chatMessages).toHaveLength(0);
    });

    it('should clear all tab content', () => {
      const store = useTabContentStore.getState();

      store.addChatMessage('tab-1', {
        id: 'msg-1',
        role: 'user',
        content: 'test',
        timestamp: new Date(),
      });
      store.addChatMessage('tab-2', {
        id: 'msg-2',
        role: 'user',
        content: 'test',
        timestamp: new Date(),
      });

      store.clearAllTabContent();

      expect(store.getTabContent('tab-1').chatMessages).toHaveLength(0);
      expect(store.getTabContent('tab-2').chatMessages).toHaveLength(0);
    });
  });

  describe('state isolation', () => {
    it('should not affect other tabs when updating one', () => {
      const store = useTabContentStore.getState();

      store.setTabChartConfig('tab-1', { type: 'bar' });
      store.setTabChartConfig('tab-2', { type: 'line' });

      expect(store.getTabChartConfig('tab-1').type).toBe('bar');
      expect(store.getTabChartConfig('tab-2').type).toBe('line');

      store.setTabChartConfig('tab-1', { showGrid: false });

      expect(store.getTabChartConfig('tab-1').type).toBe('bar');
      expect(store.getTabChartConfig('tab-1').showGrid).toBe(false);
      expect(store.getTabChartConfig('tab-2').type).toBe('line');
      expect(store.getTabChartConfig('tab-2').showGrid).toBe(true);
    });

    it('should handle many tabs independently', () => {
      const store = useTabContentStore.getState();

      for (let i = 1; i <= 10; i++) {
        const tabId = `tab-${i}`;
        store.setTabChartConfig(tabId, { type: i % 2 === 0 ? 'bar' : 'line' });
        store.setTabTableData(tabId, [{ id: i, value: i * 10 }]);
      }

      for (let i = 1; i <= 10; i++) {
        const tabId = `tab-${i}`;
        const expectedType = i % 2 === 0 ? 'bar' : 'line';
        expect(store.getTabChartConfig(tabId).type).toBe(expectedType);
        expect(store.getTabTableData(tabId)[0].value).toBe(i * 10);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings gracefully', () => {
      const store = useTabContentStore.getState();

      store.setTabLastQuery('tab-1', '');

      expect(store.getTabContent('tab-1').lastQuery).toBe('');
    });

    it('should handle null/undefined data', () => {
      const store = useTabContentStore.getState();

      store.setTabChartData('tab-1', null);

      expect(store.getTabChartData('tab-1')).toBeNull();
    });

    it('should handle removing non-existent file', () => {
      const store = useTabContentStore.getState();

      // Should not throw
      store.removeFile('tab-1', 'non-existent-file');

      expect(store.getTabFiles('tab-1')).toHaveLength(0);
    });

    it('should handle resetting non-existent tab', () => {
      const store = useTabContentStore.getState();

      // Should not throw
      store.resetTabContent('non-existent-tab');

      const content = store.getTabContent('non-existent-tab');
      expect(content.chatMessages).toEqual([]);
    });
  });
});
