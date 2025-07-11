"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Clock, Zap, MessageSquare, Wrench, CheckCircle, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getToolResultRenderer } from "./tool-results";
import { useInstanceId } from "@/lib/instance";

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
    iconBg: "bg-purple-600/20",
  },
  {
    bg: "bg-blue-900/30",
    border: "border-blue-700/50",
    text: "text-blue-100",
    accent: "text-blue-300",
    iconBg: "bg-blue-600/20",
  },
  {
    bg: "bg-emerald-900/30",
    border: "border-emerald-700/50",
    text: "text-emerald-100",
    accent: "text-emerald-300",
    iconBg: "bg-emerald-600/20",
  },
  {
    bg: "bg-amber-900/30",
    border: "border-amber-700/50",
    text: "text-amber-100",
    accent: "text-amber-300",
    iconBg: "bg-amber-600/20",
  },
  {
    bg: "bg-rose-900/30",
    border: "border-rose-700/50",
    text: "text-rose-100",
    accent: "text-rose-300",
    iconBg: "bg-rose-600/20",
  },
  {
    bg: "bg-cyan-900/30",
    border: "border-cyan-700/50",
    text: "text-cyan-100",
    accent: "text-cyan-300",
    iconBg: "bg-cyan-600/20",
  },
  {
    bg: "bg-indigo-900/30",
    border: "border-indigo-700/50",
    text: "text-indigo-100",
    accent: "text-indigo-300",
    iconBg: "bg-indigo-600/20",
  },
  {
    bg: "bg-teal-900/30",
    border: "border-teal-700/50",
    text: "text-teal-100",
    accent: "text-teal-300",
    iconBg: "bg-teal-600/20",
  },
  {
    bg: "bg-orange-900/30",
    border: "border-orange-700/50",
    text: "text-orange-100",
    accent: "text-orange-300",
    iconBg: "bg-orange-600/20",
  },
  {
    bg: "bg-pink-900/30",
    border: "border-pink-700/50",
    text: "text-pink-100",
    accent: "text-pink-300",
    iconBg: "bg-pink-600/20",
  },
];

export function ChatContainer() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const instanceId = useInstanceId(); // Use the URL parameter hook
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [showUserMessages, setShowUserMessages] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Keep track of completed message IDs to avoid unnecessary updates
  const completedMessageIds = useRef<Set<string>>(new Set());

  // Track message count to detect new messages
  const previousMessageCount = useRef<number>(0);

  // Entity theme assignment - maps display name to theme index
  const entityThemes = useRef<Map<string, number>>(new Map());

  // Toggle expanded state for a message
  const toggleMessageExpanded = (messageId: string) => {
    setExpandedMessages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  // Get theme for an entity display name
  const getEntityTheme = (displayName: string) => {
    if (!entityThemes.current.has(displayName)) {
      // Assign next available theme index (rotating through the pool)
      const themeIndex = entityThemes.current.size % COLOR_THEMES.length;
      entityThemes.current.set(displayName, themeIndex);
    }
    const themeIndex = entityThemes.current.get(displayName) ?? 0;
    // Ensure the index is within bounds and return the theme
    const validIndex = Math.max(0, Math.min(themeIndex, COLOR_THEMES.length - 1));
    return COLOR_THEMES[validIndex]!; // Non-null assertion since we know COLOR_THEMES is not empty
  };

  // Get message type display information
  const getMessageTypeInfo = (message: ChatMessage): { type: string; badgeColor: string } => {
    if (message.contextType === "TOOL_RESULT" && message.toolName) {
      const isSuccess = message.toolResultData?.success;
      const badgeColor = isSuccess ? "bg-green-900/50 text-green-300" : "bg-red-900/50 text-red-300";
      
      switch (message.toolName) {
        case "create_x402_service":
          return { type: "Service Creation", badgeColor };
        case "call_paid_service":
          return { type: "Service Purchase", badgeColor };
        case "discover_services":
          return { type: "Service Discovery", badgeColor };
        case "create_identity":
          return { type: "Identity Creation", badgeColor };
        case "create_name":
          return { type: "Name Creation", badgeColor };
        case "transfer_usdc":
          return { type: "USDC Transfer", badgeColor };
        default:
          return { type: "Tool Action", badgeColor };
      }
    }
    
    if (message.contextType === "TOOL_USE") {
      return { type: "Tool Use", badgeColor: "bg-blue-900/50 text-blue-300" };
    }
    
    if (message.completedAt === null) {
      return { type: "Streaming", badgeColor: "bg-yellow-900/50 text-yellow-300" };
    }
    
    return { type: "Message", badgeColor: "bg-slate-900/50 text-slate-300" };
  };

  // Generate summary for a message
  const generateMessageSummary = (message: ChatMessage): string => {
    if (message.contextType === "TOOL_RESULT" && message.toolName) {
      // Extract key information from tool results
      const data = message.toolResultData;
      
      switch (message.toolName) {
        case "create_x402_service":
          if (data?.success) {
            const serviceName = data.service?.serviceName || "service";
            const price = data.service?.price || "unknown";
            return `Created "${serviceName}" service for $${price} USDC`;
          }
          return `Failed to create service: ${data?.error || "unknown error"}`;
          
        case "call_paid_service":
          if (data?.success) {
            // Check if this is a batch purchase
            if (data.successfulPurchases && Array.isArray(data.successfulPurchases)) {
              const successCount = data.successfulPurchases.length;
              const failedCount = data.failedPurchases?.length || 0;
              const totalSpent = data.totalSpent || 0;
              
              if (failedCount > 0) {
                return `Batch purchase: ${successCount} successful, ${failedCount} failed - $${totalSpent.toFixed(2)} USDC`;
              } else {
                return `Batch purchase: ${successCount} services for $${totalSpent.toFixed(2)} USDC`;
              }
            } else {
              // Single purchase
              const serviceName = data.serviceCall?.serviceName || "service";
              const provider = data.serviceCall?.provider || "unknown";
              const price = data.serviceCall?.price || "unknown";
              return `Purchased "${serviceName}" from ${provider} for $${price} USDC`;
            }
          }
          return `Failed to purchase service: ${data?.error || "unknown error"}`;
          
        case "discover_services":
          if (data?.success) {
            const count = data.services?.length || 0;
            return `Discovered ${count} available services`;
          }
          return `Failed to discover services: ${data?.error || "unknown error"}`;
          
        case "create_identity":
          if (data?.success) {
            const name = data.identity?.name || "identity";
            return `Created identity: ${name}`;
          }
          return `Failed to create identity: ${data?.error || "unknown error"}`;
          
        case "create_name":
          if (data?.success) {
            const cdpName = data.name?.cdpName || "name";
            return `Created CDP name: ${cdpName}`;
          }
          return `Failed to create name: ${data?.error || "unknown error"}`;
          
        case "transfer_usdc":
          if (data?.success) {
            const amount = data.transfer?.amount || "unknown";
            const recipient = data.transfer?.recipientAddress || "unknown recipient";
            return `Transferred $${amount} USDC to ${recipient.substring(0, 8)}...`;
          }
          return `Failed to transfer USDC: ${data?.error || "unknown error"}`;
          
        default:
          return `Used tool: ${message.toolName}`;
      }
    }
    
    // For regular messages, use first 80 characters
    if (message.content) {
      const content = message.content.trim();
      return content.length > 80 ? `${content.substring(0, 80)}...` : content;
    }
    
    return "No content";
  };

  // Get appropriate icon for message type
  const getMessageIcon = (message: ChatMessage) => {
    if (message.contextType === "TOOL_RESULT") {
      const isSuccess = message.toolResultData?.success;
      if (isSuccess) {
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      } else {
        return <Wrench className="h-4 w-4 text-red-400" />;
      }
    }
    
    if (message.completedAt === null) {
      return <Zap className="h-4 w-4 text-yellow-400" />;
    }
    
    return <MessageSquare className="h-4 w-4 text-slate-400" />;
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Get instance ID from URL or API
  const getInstanceId = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlInstanceId = urlParams.get('instance');
      if (urlInstanceId) {
        return urlInstanceId;
      }
    }
    return instanceId;
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
      const currentInstanceId = getInstanceId();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_INFINITE_BAZAAR_API_URL || "http://localhost:3104"}/api/chat/messages?excludeUserMessages=${!showUserMessages}&instanceId=${currentInstanceId}`,
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
        `${process.env.NEXT_PUBLIC_INFINITE_BAZAAR_API_URL || "http://localhost:3104"}/api/chat/messages?streaming=true&excludeUserMessages=${!showUserMessages}&instanceId=${instanceId}`,
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
    // Start fetching messages when instanceId is available
    if (instanceId) {
      fetchMessages();
    }
  }, [instanceId]);

  // Set up polling when instanceId is available
  useEffect(() => {
    if (!instanceId) return;

    // Refetch immediately when showUserMessages changes
    fetchMessages();

    // Set up polling for streaming messages only (more efficient)
    const streamingInterval = setInterval(fetchStreamingMessages, 1000);

    // Periodic full refresh to catch new messages (every 10 seconds)
    const fullRefreshInterval = setInterval(fetchMessages, 10000);

    return () => {
      clearInterval(streamingInterval);
      clearInterval(fullRefreshInterval);
    };
  }, [instanceId, showUserMessages]);

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

  // Render individual message with condensed view
  const renderMessage = (message: ChatMessage) => {
    // Don't render empty content
    if (!message.content || message.content.trim() === "") {
      return null;
    }

    // Use the entity name from the database, fallback to "Unnamed" if not available
    const displayName = message.entityName || "Unnamed";
    const theme = getEntityTheme(displayName);
    const isExpanded = expandedMessages.has(message.id);
    const summary = generateMessageSummary(message);
    const icon = getMessageIcon(message);
    const timestamp = formatTimestamp(message.timestamp);
    const messageTypeInfo = getMessageTypeInfo(message);

    return (
      <div key={message.id} className="group mb-2">
        {/* Condensed summary row */}
        <div 
          className={`flex items-center justify-between p-3 rounded-lg ${theme.bg} ${theme.border} border cursor-pointer hover:bg-white/5 transition-colors`}
          onClick={() => toggleMessageExpanded(message.id)}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Icon */}
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${theme.iconBg}`}>
              {icon}
            </div>
            
            {/* Agent name and summary */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`font-medium ${theme.accent} text-sm capitalize`}>
                  {displayName}
                </span>
                <Badge className={`${messageTypeInfo.badgeColor} text-xs`}>
                  {messageTypeInfo.type}
                </Badge>
                {message.completedAt === null && (
                  <span className="text-yellow-400 text-xs animate-pulse">•</span>
                )}
              </div>
              <div className={`${theme.text} text-sm truncate opacity-80`}>
                {summary}
              </div>
            </div>
          </div>

          {/* Timestamp and expand button */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-slate-400 text-xs font-mono">
              {timestamp}
            </span>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400" />
            )}
          </div>
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className={`mt-2 ml-11 mr-6 p-4 rounded-lg ${theme.bg} ${theme.border} border-l-4`}>
            {message.contextType === "TOOL_RESULT" && message.toolName ? (
              // Render tool result with specialized component
              (() => {
                const ToolResultRenderer = getToolResultRenderer(message.toolName);
                return (
                  <ToolResultRenderer
                    message={{
                      id: message.id,
                      toolName: message.toolName,
                      content: message.content,
                      toolResultData: message.toolResultData,
                      completedAt: message.completedAt,
                    }}
                  />
                );
              })()
            ) : (
              // Regular message content
              <div className={`${theme.text} text-sm leading-relaxed`}>
                {parseMarkdown(message.content).includes("<") ? (
                  <div dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content) }} />
                ) : (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                )}
              </div>
            )}
            
            {/* Message metadata */}
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span>Type:</span>
                  <Badge className={`${messageTypeInfo.badgeColor} text-xs`}>
                    {messageTypeInfo.type}
                  </Badge>
                </div>
                <span>Context: {message.contextType}</span>
                {message.toolName && <span>Tool: {message.toolName}</span>}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{new Date(message.timestamp).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-white/10 border-b bg-black/20 p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base text-white">
            {showUserMessages ? "All Messages" : "Agent Responses"}
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUserMessages(!showUserMessages)}
              className="h-6 px-2 text-slate-400 hover:text-white hover:bg-white/10"
            >
              {showUserMessages ? (
                <>
                  <EyeOff className="h-3 w-3 mr-1" />
                  <span className="text-xs">Hide System</span>
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3 mr-1" />
                  <span className="text-xs">Show All</span>
                </>
              )}
            </Button>
            <span className="text-purple-300 text-xs font-mono">Instance: {instanceId}</span>
          </div>
        </div>
        <p className="text-slate-400 text-xs">
          {isLoading ? "Loading..." : `${messages.length} ${showUserMessages ? "messages" : "agent responses"} • Click to expand details`}
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
              <div className="text-sm">
                {showUserMessages ? "No messages yet" : "No agent responses yet"}
              </div>
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
      <div className="flex-shrink-0 border-white/10 border-t bg-black/20 p-4 backdrop-blur-sm">
        <div className="text-center text-slate-400 text-xs">
          {showUserMessages ? "All messages" : "Agent responses only"} • Click to expand details • Live updates every 1s
        </div>
      </div>
    </div>
  );
}
