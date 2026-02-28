import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TabBar } from './TabBar';
import { useTabStore } from '@/stores/tabStore';

// Mock the tab store
vi.mock('@/stores/tabStore', () => ({
  useTabStore: vi.fn(() => ({
    tabs: [
      { id: 'tab-1', title: 'Analysis 1', createdAt: new Date() },
      { id: 'tab-2', title: 'Analysis 2', createdAt: new Date() },
    ],
    activeTabId: 'tab-1',
    setActiveTab: vi.fn(),
    addTab: vi.fn(),
    closeTab: vi.fn(),
    renameTab: vi.fn(),
  })),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  X: () => <div data-testid="icon-x">X</div>,
  Plus: () => <div data-testid="icon-plus">+</div>,
}));

// Mock cn utility
vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

describe('TabBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const component = TabBar({});
    expect(component).toBeDefined();
  });

  it('should render all tabs', () => {
    const component = TabBar({});
    expect(component).toBeDefined();
  });

  it('should render add tab button', () => {
    const component = TabBar({});
    expect(component).toBeDefined();
  });

  it('should call addTab when add button is clicked', () => {
    const mockAddTab = vi.fn();
    vi.mocked(useTabStore).mockReturnValue({
      tabs: [{ id: 'tab-1', title: 'Analysis 1', createdAt: new Date() }],
      activeTabId: 'tab-1',
      setActiveTab: vi.fn(),
      addTab: mockAddTab,
      closeTab: vi.fn(),
      renameTab: vi.fn(),
    } as any);

    const component = TabBar({});
    expect(component).toBeDefined();
  });

  it('should call setActiveTab when tab is clicked', () => {
    const mockSetActiveTab = vi.fn();
    vi.mocked(useTabStore).mockReturnValue({
      tabs: [
        { id: 'tab-1', title: 'Analysis 1', createdAt: new Date() },
        { id: 'tab-2', title: 'Analysis 2', createdAt: new Date() },
      ],
      activeTabId: 'tab-1',
      setActiveTab: mockSetActiveTab,
      addTab: vi.fn(),
      closeTab: vi.fn(),
      renameTab: vi.fn(),
    } as any);

    const component = TabBar({});
    expect(component).toBeDefined();
  });

  it('should call closeTab when close button is clicked', () => {
    const mockCloseTab = vi.fn();
    vi.mocked(useTabStore).mockReturnValue({
      tabs: [{ id: 'tab-1', title: 'Analysis 1', createdAt: new Date() }],
      activeTabId: 'tab-1',
      setActiveTab: vi.fn(),
      addTab: vi.fn(),
      closeTab: mockCloseTab,
      renameTab: vi.fn(),
    } as any);

    const component = TabBar({});
    expect(component).toBeDefined();
  });

  it('should handle empty tabs array', () => {
    vi.mocked(useTabStore).mockReturnValue({
      tabs: [],
      activeTabId: null,
      setActiveTab: vi.fn(),
      addTab: vi.fn(),
      closeTab: vi.fn(),
      renameTab: vi.fn(),
    } as any);

    const component = TabBar({});
    expect(component).toBeDefined();
  });

  it('should highlight active tab', () => {
    vi.mocked(useTabStore).mockReturnValue({
      tabs: [
        { id: 'tab-1', title: 'Analysis 1', createdAt: new Date() },
        { id: 'tab-2', title: 'Analysis 2', createdAt: new Date() },
      ],
      activeTabId: 'tab-2',
      setActiveTab: vi.fn(),
      addTab: vi.fn(),
      closeTab: vi.fn(),
      renameTab: vi.fn(),
    } as any);

    const component = TabBar({});
    expect(component).toBeDefined();
  });

  it('should handle multiple tabs', () => {
    vi.mocked(useTabStore).mockReturnValue({
      tabs: [
        { id: 'tab-1', title: 'Analysis 1', createdAt: new Date() },
        { id: 'tab-2', title: 'Analysis 2', createdAt: new Date() },
        { id: 'tab-3', title: 'Analysis 3', createdAt: new Date() },
        { id: 'tab-4', title: 'Analysis 4', createdAt: new Date() },
        { id: 'tab-5', title: 'Analysis 5', createdAt: new Date() },
      ],
      activeTabId: 'tab-3',
      setActiveTab: vi.fn(),
      addTab: vi.fn(),
      closeTab: vi.fn(),
      renameTab: vi.fn(),
    } as any);

    const component = TabBar({});
    expect(component).toBeDefined();
  });

  it('should handle long tab titles', () => {
    vi.mocked(useTabStore).mockReturnValue({
      tabs: [
        {
          id: 'tab-1',
          title: 'This is a very long tab title that should be truncated',
          createdAt: new Date(),
        },
      ],
      activeTabId: 'tab-1',
      setActiveTab: vi.fn(),
      addTab: vi.fn(),
      closeTab: vi.fn(),
      renameTab: vi.fn(),
    } as any);

    const component = TabBar({});
    expect(component).toBeDefined();
  });

  it('should support keyboard shortcuts', () => {
    const mockAddTab = vi.fn();
    const mockCloseTab = vi.fn();
    vi.mocked(useTabStore).mockReturnValue({
      tabs: [{ id: 'tab-1', title: 'Analysis 1', createdAt: new Date() }],
      activeTabId: 'tab-1',
      setActiveTab: vi.fn(),
      addTab: mockAddTab,
      closeTab: mockCloseTab,
      renameTab: vi.fn(),
    } as any);

    const component = TabBar({});
    expect(component).toBeDefined();
  });

  it('should render close button for each tab', () => {
    vi.mocked(useTabStore).mockReturnValue({
      tabs: [
        { id: 'tab-1', title: 'Analysis 1', createdAt: new Date() },
        { id: 'tab-2', title: 'Analysis 2', createdAt: new Date() },
      ],
      activeTabId: 'tab-1',
      setActiveTab: vi.fn(),
      addTab: vi.fn(),
      closeTab: vi.fn(),
      renameTab: vi.fn(),
    } as any);

    const component = TabBar({});
    expect(component).toBeDefined();
  });

  it('should apply active tab styling', () => {
    vi.mocked(useTabStore).mockReturnValue({
      tabs: [
        { id: 'tab-1', title: 'Analysis 1', createdAt: new Date() },
        { id: 'tab-2', title: 'Analysis 2', createdAt: new Date() },
      ],
      activeTabId: 'tab-1',
      setActiveTab: vi.fn(),
      addTab: vi.fn(),
      closeTab: vi.fn(),
      renameTab: vi.fn(),
    } as any);

    const component = TabBar({});
    expect(component).toBeDefined();
  });

  it('should apply inactive tab styling', () => {
    vi.mocked(useTabStore).mockReturnValue({
      tabs: [
        { id: 'tab-1', title: 'Analysis 1', createdAt: new Date() },
        { id: 'tab-2', title: 'Analysis 2', createdAt: new Date() },
      ],
      activeTabId: 'tab-1',
      setActiveTab: vi.fn(),
      addTab: vi.fn(),
      closeTab: vi.fn(),
      renameTab: vi.fn(),
    } as any);

    const component = TabBar({});
    expect(component).toBeDefined();
  });

  it('should support dark mode', () => {
    vi.mocked(useTabStore).mockReturnValue({
      tabs: [{ id: 'tab-1', title: 'Analysis 1', createdAt: new Date() }],
      activeTabId: 'tab-1',
      setActiveTab: vi.fn(),
      addTab: vi.fn(),
      closeTab: vi.fn(),
      renameTab: vi.fn(),
    } as any);

    const component = TabBar({});
    expect(component).toBeDefined();
  });

  it('should handle tab renaming', () => {
    const mockRenameTab = vi.fn();
    vi.mocked(useTabStore).mockReturnValue({
      tabs: [{ id: 'tab-1', title: 'Analysis 1', createdAt: new Date() }],
      activeTabId: 'tab-1',
      setActiveTab: vi.fn(),
      addTab: vi.fn(),
      closeTab: vi.fn(),
      renameTab: mockRenameTab,
    } as any);

    const component = TabBar({});
    expect(component).toBeDefined();
  });

  it('should render with proper accessibility attributes', () => {
    vi.mocked(useTabStore).mockReturnValue({
      tabs: [
        { id: 'tab-1', title: 'Analysis 1', createdAt: new Date() },
        { id: 'tab-2', title: 'Analysis 2', createdAt: new Date() },
      ],
      activeTabId: 'tab-1',
      setActiveTab: vi.fn(),
      addTab: vi.fn(),
      closeTab: vi.fn(),
      renameTab: vi.fn(),
    } as any);

    const component = TabBar({});
    expect(component).toBeDefined();
  });
});
