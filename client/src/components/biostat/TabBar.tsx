import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useTabStore } from '@/stores/tabStore';
import { cn } from '@/lib/utils';

/**
 * TabBar Component
 * Chrome-style tab bar for multi-tab workspace
 * 
 * Features:
 * - Horizontal tab list with active highlighting
 * - Tab title display (truncated if too long)
 * - Close button (×) on each tab
 * - Add new tab button (+)
 * - Keyboard support (Ctrl+W to close, Ctrl+T to add)
 */
export const TabBar: React.FC = () => {
  const { tabs, activeTabId, setActiveTab, addTab, closeTab, renameTab } = useTabStore();
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+W or Cmd+W to close active tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (activeTabId) {
          closeTab(activeTabId);
        }
      }
      // Ctrl+T or Cmd+T to add new tab
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        addTab();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, addTab, closeTab]);

  /**
   * Start editing tab title
   */
  const startEditingTab = (tabId: string, currentTitle: string) => {
    setEditingTabId(tabId);
    setEditingTitle(currentTitle);
  };

  /**
   * Save edited tab title
   */
  const saveTabTitle = (tabId: string) => {
    if (editingTitle.trim()) {
      renameTab(tabId, editingTitle.trim());
    }
    setEditingTabId(null);
    setEditingTitle('');
  };

  /**
   * Cancel editing
   */
  const cancelEditing = () => {
    setEditingTabId(null);
    setEditingTitle('');
  };

  /**
   * Handle double-click to edit tab title
   */
  const handleTabDoubleClick = (tabId: string, title: string) => {
    startEditingTab(tabId, title);
  };

  /**
   * Handle Enter key in edit mode
   */
  const handleEditKeyDown = (e: React.KeyboardEvent, tabId: string) => {
    if (e.key === 'Enter') {
      saveTabTitle(tabId);
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  return (
    <div className="flex items-center h-12 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-2 gap-1 overflow-x-auto">
      {/* Tab List */}
      <div className="flex items-center gap-1 flex-1 min-w-0">
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const isEditing = tab.id === editingTabId;

          return (
            <div
              key={tab.id}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-t-lg border border-b-0 transition-colors min-w-max max-w-xs',
                isActive
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-300 dark:hover:bg-slate-600'
              )}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={isActive}
              aria-label={`Tab: ${tab.title}`}
            >
              {/* Tab Title (Editable) */}
              {isEditing ? (
                <input
                  autoFocus
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={(e) => handleEditKeyDown(e, tab.id)}
                  onBlur={() => saveTabTitle(tab.id)}
                  className="bg-transparent outline-none text-sm font-medium px-1 w-32"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="text-sm font-medium truncate cursor-text hover:opacity-75"
                  onDoubleClick={() => handleTabDoubleClick(tab.id, tab.title)}
                  title={tab.title}
                >
                  {tab.title}
                </span>
              )}

              {/* Close Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className={cn(
                  'p-0.5 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors',
                  isActive
                    ? 'text-slate-600 dark:text-slate-400'
                    : 'text-slate-600 dark:text-slate-400'
                )}
                aria-label={`Close ${tab.title}`}
                title="Close tab (Ctrl+W)"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add Tab Button */}
      <button
        onClick={() => addTab()}
        className={cn(
          'flex items-center justify-center p-2 rounded-lg transition-colors',
          'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
          'hover:bg-slate-300 dark:hover:bg-slate-600',
          'focus:outline-none focus:ring-2 focus:ring-blue-500'
        )}
        aria-label="Add new tab"
        title="Add new tab (Ctrl+T)"
      >
        <Plus size={18} />
      </button>
    </div>
  );
};

export default TabBar;
