import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from 'react-beautiful-dnd';
import { useTabStore } from '@/stores/tabStore';
import { cn } from '@/lib/utils';

/**
 * TabBar Component with Drag-and-Drop
 * Chrome-style tab bar with draggable/reorderable tabs.
 *
 * The "+" button lives immediately after the last tab in the same
 * scrollable row — not at the far right edge — matching Chrome's layout.
 * When tabs overflow, the entire row (tabs + "+") scrolls together.
 *
 * To keep "+" always visible on very long tab lists, position it
 * absolutely (right-0) inside a relative wrapper instead.
 */
export const TabBarDraggable: React.FC = () => {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    addTab,
    closeTab,
    renameTab,
    reorderTabs,
  } = useTabStore();
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (activeTabId) closeTab(activeTabId);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        addTab();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, addTab, closeTab]);

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    reorderTabs(source.index, destination.index);
  };

  const startEditingTab = (tabId: string, currentTitle: string) => {
    setEditingTabId(tabId);
    setEditingTitle(currentTitle);
  };

  const saveTabTitle = (tabId: string) => {
    if (editingTitle.trim()) renameTab(tabId, editingTitle.trim());
    setEditingTabId(null);
    setEditingTitle('');
  };

  const cancelEditing = () => {
    setEditingTabId(null);
    setEditingTitle('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, tabId: string) => {
    if (e.key === 'Enter') saveTabTitle(tabId);
    else if (e.key === 'Escape') cancelEditing();
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      {/*
       * Outer: full-width, single-row strip.
       * overflow-x-auto + scrollbar-hide makes it scroll when tabs overflow.
       * The "+" button scrolls WITH the tabs (Chrome behaviour).
       *
       * If you need "+" always visible even when tabs overflow, change the
       * outer div to `relative overflow-hidden` and position "+" with
       * `absolute right-2 top-1/2 -translate-y-1/2`.
       */}
      <div
        className="flex items-center h-12 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Inner flex row: tabs + "+" — no flex-1 so "+" hugs the last tab */}
        <div className="flex items-center px-2 py-1.5 gap-1 min-w-max">
          <Droppable
            droppableId="tabs"
            direction="horizontal"
            isDropDisabled={false}
            isCombineEnabled={false}
            ignoreContainerClipping={false}
          >
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn(
                  'flex items-center gap-1',
                  snapshot.isDraggingOver && 'bg-slate-200/60 dark:bg-slate-700/60 rounded'
                )}
              >
                {tabs.map((tab, index) => {
                  const isActive = tab.id === activeTabId;
                  const isEditing = tab.id === editingTabId;

                  return (
                    <Draggable key={tab.id} draggableId={tab.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-t-lg border border-b-0 transition-all min-w-max max-w-[180px]',
                            isActive
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700 shadow-sm'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-300 dark:hover:bg-slate-600',
                            snapshot.isDragging && 'shadow-lg opacity-90 scale-105'
                          )}
                          onClick={() => setActiveTab(tab.id)}
                          role="tab"
                          aria-selected={isActive}
                          aria-label={`Tab: ${tab.title}`}
                        >
                          {/* Tab title (double-click to edit) */}
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
                              className="text-sm font-medium truncate cursor-text hover:opacity-75 max-w-[140px]"
                              onDoubleClick={() => startEditingTab(tab.id, tab.title)}
                              title={tab.title}
                            >
                              {tab.title}
                            </span>
                          )}

                          {/* Close button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              closeTab(tab.id);
                            }}
                            className={cn(
                              'p-0.5 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex-shrink-0',
                              isActive
                                ? 'text-slate-500 dark:text-slate-400'
                                : 'text-slate-500 dark:text-slate-400 opacity-0 group-hover:opacity-100'
                            )}
                            aria-label={`Close ${tab.title}`}
                            title="Close tab (Ctrl+W)"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {/* "+" button — sits immediately after the last tab, ~4 px gap */}
          <button
            onClick={() => addTab()}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-lg transition-colors flex-shrink-0 ml-1',
              'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
              'hover:bg-slate-300 dark:hover:bg-slate-600',
              'focus:outline-none focus:ring-2 focus:ring-blue-500'
            )}
            aria-label="Add new tab"
            title="Add new tab (Ctrl+T)"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </DragDropContext>
  );
};

export default TabBarDraggable;
