import { useCallback } from 'react';
import { useTabStore } from '@/stores/tabStore';
import { useTabContentStore } from '@/stores/tabContentStore';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date | number; // Accept both Date objects and millisecond timestamps
  metadata?: {
    query?: string;
    analysisType?: string;
    dataSource?: string;
    llmUnavailable?: boolean;  // true when AI interpretation failed and fallback was used
    llmError?: string;         // raw error message for debugging
    retryQuery?: string;       // original user query to replay on retry
  };
}

/**
 * Custom hook to manage chat messages for the active tab
 * Each tab maintains its own independent conversation history
 */
export const useTabChat = () => {
  const { activeTabId } = useTabStore();
  const { getTabContent, updateTabContent } = useTabContentStore();

  // Get chat messages for the active tab
  const getChatMessages = useCallback((): ChatMessage[] => {
    if (!activeTabId) return [];
    const tabContent = getTabContent(activeTabId);
    return tabContent?.chatMessages || [];
  }, [activeTabId, getTabContent]);

  // Add a new message to the active tab's chat
  const addChatMessage = useCallback(
    (message: ChatMessage) => {
      if (!activeTabId) return;
      const currentMessages = getChatMessages();
      const newMessages = [
        ...currentMessages,
        {
          ...message,
          timestamp: message.timestamp || Date.now(),
        },
      ];
      updateTabContent(activeTabId, { chatMessages: newMessages });
    },
    [activeTabId, getChatMessages, updateTabContent]
  );

  // Clear chat history for the active tab
  const clearChatHistory = useCallback(() => {
    if (!activeTabId) return;
    updateTabContent(activeTabId, { chatMessages: [] });
  }, [activeTabId, updateTabContent]);

  // Update a specific message in the active tab's chat
  const updateChatMessage = useCallback(
    (index: number, updatedMessage: Partial<ChatMessage>) => {
      if (!activeTabId) return;
      const currentMessages = getChatMessages();
      if (index < 0 || index >= currentMessages.length) return;

      const newMessages = currentMessages.map((msg, i) =>
        i === index ? { ...msg, ...updatedMessage } : msg
      );
      updateTabContent(activeTabId, { chatMessages: newMessages });
    },
    [activeTabId, getChatMessages, updateTabContent]
  );

  // Remove a specific message from the active tab's chat
  const removeChatMessage = useCallback(
    (index: number) => {
      if (!activeTabId) return;
      const currentMessages = getChatMessages();
      if (index < 0 || index >= currentMessages.length) return;

      const newMessages = currentMessages.filter((_, i) => i !== index);
      updateTabContent(activeTabId, { chatMessages: newMessages });
    },
    [activeTabId, getChatMessages, updateTabContent]
  );

  return {
    chatMessages: getChatMessages(),
    addChatMessage,
    clearChatHistory,
    updateChatMessage,
    removeChatMessage,
    activeTabId,
  };
};
