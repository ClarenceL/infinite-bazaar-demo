/**
 * Message types for the Lyra agent
 */

// Tool call from assistant
export type AnthropicToolUse = {
  type: "tool_use";
  id: string; // Assistant generated ID or our tool_use_id
  name: string; // Name of the tool to call
  input: Record<string, any>; // Required by Anthropic, empty obj is valid
};

// Tool result from user
export type AnthropicToolResult = {
  type: "tool_result";
  tool_use_id: string; // Must match the ID from the tool_use
  content: string; // Result as string (can be JSON)
};

// Text content block for system messages
export type AnthropicTextBlock = {
  type: "text";
  content: string;
  cache_control?: { type: string };
};

// Union type for all Anthropic content block types
export type AnthropicTool = AnthropicToolUse | AnthropicToolResult | AnthropicTextBlock;

// Anthropic API compatible message format
export type AnthropicMessage = {
  role: string;
  content: string | AnthropicTool[];
};

export type AnthropicMessageCached = {
  role: string;
  content: string | AnthropicTool[];
  cache_control?: { type: "ephemeral" };
};

// Define Message type locally since it's not exported from message.ts anymore
export type Message = {
  role: "user" | "assistant" | "system";
  content: string | ToolCall | ToolCallResult;
  timestamp?: number;
};

export type StreamChunkData = {
  type: string;
  delta?: {
    text?: string;
  };
  content_block?: {
    type: string;
    id?: string;
    name?: string;
    input?: Record<string, any>;
  };
};

// Tool call types
export interface ToolCall {
  type: "tool_use";
  name: string;
  input: Record<string, any>; // Must be an object, empty object {} is valid for tools without parameters
  tool_use_id?: string; // Track the ID for matching with tool_result
  id?: string; // Claude 3.7 tool use ID
}

// Helper to validate ToolCall input is always an object
export function validateToolCallInput(input: unknown): Record<string, any> {
  if (typeof input === "object" && input !== null) {
    return input as Record<string, any>;
  }
  return {}; // Return empty object for non-object inputs
}

// Helper functions to convert our internal types to Anthropic format
export function createAnthropicToolUse(toolCall: ToolCall): AnthropicToolUse {
  // For outgoing tool calls, we need either a tool_use_id or id to be present
  const id = toolCall.tool_use_id || toolCall.id;

  if (!id) {
    throw new Error(
      "Tool call must have either tool_use_id or id - these are required for tool result matching",
    );
  }

  return {
    type: "tool_use",
    id,
    name: toolCall.name,
    input: validateToolCallInput(toolCall.input),
  };
}

export function createAnthropicToolResult(toolResult: ToolCallResult): AnthropicToolResult {
  if (!toolResult.tool_use_id) {
    throw new Error("Tool result must have a tool_use_id that matches the original tool call's id");
  }

  return {
    type: "tool_result",
    tool_use_id: toolResult.tool_use_id,
    content:
      typeof toolResult.data === "string" ? toolResult.data : JSON.stringify(toolResult.data || {}),
  };
}

export function createAnthropicTextBlock(text: string, ephemeral = true): AnthropicTextBlock {
  return {
    type: "text",
    content: text,
    ...(ephemeral ? { cache_control: { type: "ephemeral" } } : {}),
  };
}

export interface ToolCallResult {
  data: Record<string, any> | null;
  tool_use_id?: string; // Reference to the original tool_use id
}

// Tool response from the model
export interface ToolResponse {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, any>;
}

// Use the updated mixed type definition
export type LLMMessages = Array<AnthropicMessage | AnthropicMessageCached>;
