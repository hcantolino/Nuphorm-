import { create } from "zustand";

interface MeasurementTriggerState {
  pendingMessage: string | null;
  pendingAutoSend: boolean;
  setPendingMessage: (message: string | null, autoSend?: boolean) => void;
}

/**
 * Store for managing measurement quick-trigger messages.
 * When user selects measurements or clicks a Clean Data action, it sets a
 * pending message. The AI chat component reads this and inserts the message
 * into the input field. When autoSend is true, the chat also fires immediately.
 */
export const useMeasurementTriggerStore = create<MeasurementTriggerState>((set) => ({
  pendingMessage: null,
  pendingAutoSend: false,
  setPendingMessage: (message, autoSend = false) =>
    set({ pendingMessage: message, pendingAutoSend: autoSend }),
}));
