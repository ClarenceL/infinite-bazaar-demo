"use client";

import { useEffect, useRef, useState } from "react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  completedAt?: number | null; // timestamp when complete, null when streaming
  entityId: string;
  entityName?: string;
  contextType: "MESSAGE" | "TOOL_USE" | "TOOL_RESULT";
  toolName?: string;
  toolResultData?: any;
}

interface ChatResponse {
  success: boolean;
  messages: ChatMessage[];
  count: number;
  timestamp: number;
  streamingOnly?: boolean;
  entityId?: string | null;
  excludeUserMessages?: boolean;
}

// Color theme pool with good contrast ratios
const COLOR_THEMES = [
  {
    bg: "bg-purple-900/30",
    border: "border-purple-700/50",
    text: "text-purple-100",
    accent: "text-purple-300",
  },
  {
    bg: "bg-blue-900/30",
    border: "border-blue-700/50",
    text: "text-blue-100",
    accent: "text-blue-300",
  },
  {
    bg: "bg-emerald-900/30",
    border: "border-emerald-700/50",
    text: "text-emerald-100",
    accent: "text-emerald-300",
  },
  {
    bg: "bg-amber-900/30",
    border: "border-amber-700/50",
    text: "text-amber-100",
    accent: "text-amber-300",
  },
  {
    bg: "bg-rose-900/30",
    border: "border-rose-700/50",
    text: "text-rose-100",
    accent: "text-rose-300",
  },
  {
    bg: "bg-cyan-900/30",
    border: "border-cyan-700/50",
    text: "text-cyan-100",
    accent: "text-cyan-300",
  },
  {
    bg: "bg-indigo-900/30",
    border: "border-indigo-700/50",
    text: "text-indigo-100",
    accent: "text-indigo-300",
  },
  {
    bg: "bg-teal-900/30",
    border: "border-teal-700/50",
    text: "text-teal-100",
    accent: "text-teal-300",
  },
  {
    bg: "bg-orange-900/30",
    border: "border-orange-700/50",
    text: "text-orange-100",
    accent: "text-orange-300",
  },
  {
    bg: "bg-pink-900/30",
    border: "border-pink-700/50",
    text: "text-pink-100",
    accent: "text-pink-300",
  },
];

// Tool result theme (special case)
const TOOL_RESULT_THEME = {
  bg: "bg-blue-900/20",
  border: "border-blue-700/50",
  text: "text-blue-100",
  accent: "text-blue-400",
};

export function ChatContainer() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Keep track of completed message IDs to avoid unnecessary updates
  const completedMessageIds = useRef<Set<string>>(new Set());

  // Track message count to detect new messages
  const previousMessageCount = useRef<number>(0);

  // Entity theme assignment - maps username to theme index
  const entityThemes = useRef<Map<string, number>>(new Map());

  // Get theme for an entity username
  const getEntityTheme = (username: string) => {
    if (!entityThemes.current.has(username)) {
      // Assign next available theme index (rotating through the pool)
      const themeIndex = entityThemes.current.size % COLOR_THEMES.length;
      entityThemes.current.set(username, themeIndex);
    }
    const themeIndex = entityThemes.current.get(username) ?? 0;
    // Ensure the index is within bounds and return the theme
    const validIndex = Math.max(0, Math.min(themeIndex, COLOR_THEMES.length - 1));
    return COLOR_THEMES[validIndex]!; // Non-null assertion since we know COLOR_THEMES is not empty
  };

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Only scroll when there are actually new messages
  useEffect(() => {
    if (messages.length > previousMessageCount.current) {
      scrollToBottom();
      previousMessageCount.current = messages.length;
    }
  }, [messages]);

  // Fetch messages from API
  const fetchMessages = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_INFINITE_BAZAAR_API_URL || "http://localhost:3104"}/api/chat/messages?excludeUserMessages=true`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ChatResponse = await response.json();

      if (data.success) {
        // Efficiently update messages by only processing changes
        setMessages((prevMessages) => {
          const newMessages = [...data.messages];
          const messageMap = new Map(prevMessages.map((msg) => [msg.id, msg]));

          // Process each message from the API
          const updatedMessages = newMessages.map((apiMessage) => {
            const existingMessage = messageMap.get(apiMessage.id);

            // If message is completed (has completedAt timestamp), check if it's recent
            if (apiMessage.completedAt !== null && apiMessage.completedAt !== undefined) {
              const now = Date.now();
              const completedTime = apiMessage.completedAt;
              const bufferTime = 30000; // 30 second buffer

              // If completed more than 30 seconds ago, treat as stable
              if (now - completedTime > bufferTime) {
                completedMessageIds.current.add(apiMessage.id);

                // If we already have this completed message, keep the existing one
                if (existingMessage && completedMessageIds.current.has(apiMessage.id)) {
                  return existingMessage;
                }
              }

              // For recently completed messages or first time seeing, use API version
              return apiMessage;
            }

            // If message is still streaming (completedAt is null), always use the latest content
            if (apiMessage.completedAt === null) {
              // Remove from completed set if it was there (shouldn't happen, but safety)
              completedMessageIds.current.delete(apiMessage.id);
              return apiMessage;
            }

            // Fallback: use API message
            return apiMessage;
          });

          return updatedMessages;
        });

        setError(null);
      } else {
        setError("Failed to fetch messages");
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch only streaming messages for efficient polling
  const fetchStreamingMessages = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_INFINITE_BAZAAR_API_URL || "http://localhost:3104"}/api/chat/messages?streaming=true&excludeUserMessages=true`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ChatResponse = await response.json();

      if (data.success && data.messages.length > 0) {
        // Update only the streaming messages in our existing message list
        setMessages((prevMessages) => {
          const messageMap = new Map(prevMessages.map((msg) => [msg.id, msg]));

          // Update streaming messages with latest content
          data.messages.forEach((streamingMessage) => {
            if (streamingMessage.completedAt === null) {
              messageMap.set(streamingMessage.id, streamingMessage);
            }
          });

          // Convert back to array, maintaining order
          return Array.from(messageMap.values()).sort((a, b) => a.timestamp - b.timestamp);
        });
      }
    } catch (err) {
      console.error("Error fetching streaming messages:", err);
      // Don't set error state for streaming polls to avoid disrupting UX
    }
  };

  // Two-phase polling: initial load + streaming updates
  useEffect(() => {
    // Initial fetch of all messages
    fetchMessages();

    // Set up polling for streaming messages only (more efficient)
    const streamingInterval = setInterval(fetchStreamingMessages, 1000);

    // Periodic full refresh to catch new messages (every 10 seconds)
    const fullRefreshInterval = setInterval(fetchMessages, 10000);

    return () => {
      clearInterval(streamingInterval);
      clearInterval(fullRefreshInterval);
    };
  }, []);

  // Helper function to parse markdown for headings and bold text (simplified version from reference)
  const parseMarkdown = (text: string) => {
    if (!text) return "";

    // Parse heading tags (# Heading 1, ## Heading 2, etc.)
    let parsedText = text.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, content) => {
      const level = hashes.length as 1 | 2 | 3 | 4 | 5 | 6;
      const fontSize =
        {
          1: "text-2xl font-bold",
          2: "text-xl font-bold",
          3: "text-lg font-bold",
          4: "text-base font-bold",
          5: "text-sm font-bold",
          6: "text-xs font-bold",
        }[level] || "text-base font-bold";

      return `<div class="${fontSize} my-2">${content}</div>`;
    });

    // Parse bold text (**bold**)
    parsedText = parsedText.replace(/\*\*(.*?)\*\*/g, '<span class="font-bold">$1</span>');

    // Parse italic text (*italic*)
    parsedText = parsedText.replace(
      /(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g,
      '<span class="italic">$1</span>',
    );

    return parsedText;
  };

  // Render individual message bubble with improved styling
  const renderMessage = (message: ChatMessage) => {
    // Don't render empty content
    if (!message.content || message.content.trim() === "") {
      return null;
    }

    // Extract username from entityName or entityId
    const username =
      message.entityName ||
      (message.entityId.startsWith("ent_") ? message.entityId.slice(4) : message.entityId);

    // Handle tool result messages with special UI
    if (message.contextType === "TOOL_RESULT" && message.toolName) {
      const theme = TOOL_RESULT_THEME;

      return (
        <div key={message.id} className="group mb-4 flex flex-col gap-2">
          {/* Tool result header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${theme.accent} text-base`}>
                @tool-results/{message.toolName}
              </span>
              <div className={`h-1.5 w-1.5 rounded-full ${theme.accent.replace("text-", "bg-")}`} />
            </div>
            {message.completedAt === null ? (
              <span className="font-medium text-xs text-yellow-400">streaming...</span>
            ) : message.completedAt && Date.now() - message.completedAt < 30000 ? (
              <span className="font-medium text-green-400 text-xs">just completed</span>
            ) : null}
          </div>

          {/* Tool result content */}
          <div className={`rounded-xl ${theme.bg} ${theme.border} p-4 shadow-lg backdrop-blur-sm`}>
            <div className={`${theme.text} text-sm`}>
              {message.toolResultData ? (
                <pre className="whitespace-pre-wrap font-mono text-xs">
                  {JSON.stringify(message.toolResultData, null, 2)}
                </pre>
              ) : (
                <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Get theme for this entity
    const theme = getEntityTheme(username);

    // Regular message rendering
    const parsedContent = parseMarkdown(message.content);

    return (
      <div key={message.id} className="group mb-4 flex flex-col gap-2">
        {/* Username header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`font-semibold ${theme.accent} text-base capitalize`}>{username}</span>
            <div className={`h-1.5 w-1.5 rounded-full ${theme.accent.replace("text-", "bg-")}`} />
          </div>
          {message.completedAt === null ? (
            <span className="font-medium text-xs text-yellow-400">streaming...</span>
          ) : message.completedAt && Date.now() - message.completedAt < 30000 ? (
            <span className="font-medium text-green-400 text-xs">just completed</span>
          ) : null}
        </div>

        {/* Message content */}
        <div className={`rounded-xl ${theme.bg} ${theme.border} p-4 shadow-lg backdrop-blur-sm`}>
          {parsedContent.includes("<") ? (
            <div
              className={`whitespace-pre-wrap ${theme.text} text-sm leading-relaxed`}
              dangerouslySetInnerHTML={{ __html: parsedContent }}
            />
          ) : (
            <div className={`whitespace-pre-wrap ${theme.text} text-sm leading-relaxed`}>
              {parsedContent}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-white/10 border-b bg-black/20 p-4 backdrop-blur-sm">
          <h3 className="font-semibold text-lg text-white">Live Agent Chat</h3>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="text-center">
            <div className="text-red-400 text-sm">Error: {error}</div>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setIsLoading(true);
                fetchMessages();
              }}
              className="mt-2 rounded bg-purple-600 px-2 py-1 text-white text-xs hover:bg-purple-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-white/10 border-b bg-black/20 p-4 backdrop-blur-sm">
        <h3 className="font-semibold text-base text-white">Live Agent Chat</h3>
        <p className="text-slate-400 text-xs">
          {isLoading ? "Loading..." : `${messages.length} assistant messages from all entities`}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-slate-400 text-sm">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-slate-400">
              <div className="text-sm">No messages yet</div>
              <div className="text-xs">Waiting for agent activity...</div>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map(renderMessage)}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-white/10 border-t bg-black/20 p-4 backdrop-blur-sm">
        <div className="text-center text-slate-400 text-xs">
          Streaming updates every 1s • Full refresh every 10s • 30s completion buffer
        </div>
      </div>
    </div>
  );
}
