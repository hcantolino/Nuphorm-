import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

interface AIChatInputProps {
  onSendMessage: (message: string) => void;
  placeholder?: string;
  isLoading?: boolean;
}

export default function AIChatInput({
  onSendMessage,
  placeholder = "Ask NuPhorm AI for insights...",
  isLoading = false,
}: AIChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [message]);

  const handleSend = () => {
    if (message.trim() && !isLoading) {
      onSendMessage(message);
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
    // Don't send on just Enter (allow multiline)
  };

  return (
    <div className="w-full">
      {/* Chat Input Container */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg hover:border-blue-300 transition-all duration-200 focus-within:border-blue-500 focus-within:shadow-xl">
        <div className="flex items-end gap-3 p-4">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            rows={1}
            className="flex-1 bg-transparent text-gray-900 placeholder-gray-500 resize-none outline-none font-medium text-sm max-h-[120px] overflow-y-auto"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "#d1d5db #f3f4f6",
            }}
          />

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!message.trim() || isLoading}
            className={`
              flex-shrink-0 p-2.5 rounded-xl font-semibold transition-all duration-200
              flex items-center justify-center
              ${
                message.trim() && !isLoading
                  ? "bg-gradient-to-r from-[#0693e3] to-[#0574c1] text-white hover:shadow-lg hover:scale-105 active:scale-95"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }
            `}
            aria-label="Send message"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Helper Text */}
        <div className="px-4 pb-3 text-xs text-gray-500 flex items-center justify-between">
          <span>Cmd + Enter to send</span>
          <span className="text-gray-400">{message.length}/1000</span>
        </div>
      </div>

      {/* AI Indicator */}
      <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
        <div className="w-2 h-2 rounded-full bg-gradient-to-r from-[#0693e3] to-[#0574c1] animate-pulse" />
        <span>Powered by NuPhorm AI</span>
      </div>
    </div>
  );
}
