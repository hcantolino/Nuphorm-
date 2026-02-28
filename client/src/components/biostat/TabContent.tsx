import React from 'react';
import { useTabStore } from '@/stores/tabStore';

/**
 * TabContent Component
 * Wraps the biostatistics page content and only renders for the active tab
 * 
 * This component ensures that:
 * - Each tab has its own independent AI chat, chart, table, and settings
 * - Switching tabs instantly loads that tab's state
 * - Tab state is preserved when switching away and back
 * 
 * Usage:
 * <TabContent tabId="tab-1">
 *   <YourPageContent />
 * </TabContent>
 */
interface TabContentProps {
  tabId: string;
  children: React.ReactNode;
}

export const TabContent: React.FC<TabContentProps> = ({ tabId, children }) => {
  const activeTabId = useTabStore((state) => state.activeTabId);
  const isActive = tabId === activeTabId;

  // Only render if this tab is active
  // This ensures each tab maintains its own state independently
  if (!isActive) {
    return null;
  }

  return (
    <div
      key={tabId}
      className="flex-1 flex flex-col min-h-0"
      role="tabpanel"
      aria-labelledby={`tab-${tabId}`}
    >
      {children}
    </div>
  );
};

export default TabContent;
