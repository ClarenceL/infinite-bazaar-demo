import { logger } from "@infinite-bazaar-demo/logs";
import { streamingDBSync } from "../../services/streaming-db-sync.js";
import type { Message, ToolCall, ToolCallResult } from "../../types/message.js";
import { processToolCall } from "../tools/handlers/index.js";

/**
 * Process LangChain stream following Lyra MCP server pattern
 */
export async function processLangChainStream({
  stream,
  writer,
  encoder,
  generateToolUseId,
  clearToolUseId,
  saveMessages,
  state,
  streamingContextId,
  entityId,
}: {
  stream: AsyncIterable<any>;
  writer: WritableStreamDefaultWriter;
  encoder: TextEncoder;
  generateToolUseId: () => Promise<string>;
  clearToolUseId: () => Promise<void>;
  saveMessages: (message: Message) => Promise<void>;
  state: any;
  streamingContextId?: string; // For real-time DB sync
  entityId?: string; // For passing to tool calls
}): Promise<string> {
  // Track text content
  let currentTextContent = ""; // Accumulate text content

  // Tool call tracking
  let currentToolCall: ToolCall | null = null;
  let accumulatedJsonInput = "";
  let toolUseId: string | null = null;

  try {
    // Wait for writer to be ready before proceeding
    if (writer.ready) {
      await writer.ready;
    }

    // Process the stream
    for await (const chunk of stream) {
      // Check for stream completion of a tool call
      if (
        currentToolCall &&
        chunk.additional_kwargs?.stop_reason === "tool_use" &&
        Array.isArray(chunk.content) &&
        chunk.content.length === 0
      ) {
        console.log("Tool call JSON input complete, parsing:", accumulatedJsonInput);

        try {
          // Parse the accumulated JSON if not empty, otherwise use empty object
          const parsedInput = accumulatedJsonInput.trim() ? JSON.parse(accumulatedJsonInput) : {};

          // Update the tool call with the parsed input
          currentToolCall.input = parsedInput;

          console.log(
            `Processing complete tool call: ${currentToolCall.name} with input:`,
            parsedInput,
          );

          // Store the tool call as the assistant's response
          try {
            await saveMessages({
              role: "assistant",
              content: currentToolCall,
              timestamp: Date.now(),
            });
          } catch (saveError) {
            console.error("Error saving tool call message:", saveError);
            throw saveError;
          }

          // Send tool call to client, but client should suppress it (it's informational only)
          try {
            await writer.write(
              encoder.encode(`2:${JSON.stringify({ tool_call: currentToolCall })}\n\n`),
            );
          } catch (writeError) {
            console.error("Error writing tool call to stream:", writeError);
            throw writeError;
          }

          // Process the tool call
          console.log(
            `Processing tool call: ${currentToolCall.name} with input:`,
            currentToolCall.input,
          );

          let result: ToolCallResult;
          try {
            result = await processToolCall(currentToolCall.name, currentToolCall.input, entityId);
          } catch (toolCallError) {
            console.error("Error processing tool call:", toolCallError);
            throw toolCallError;
          }

          // Add the tool_use_id to connect this result to the tool call
          if (toolUseId) {
            result.tool_use_id = toolUseId;
          }

          // Add the tool result to message history
          try {
            await saveMessages({
              role: "user",
              content: result,
              timestamp: Date.now(),
            });
          } catch (saveResultError) {
            console.error("Error saving tool result message:", saveResultError);
            throw saveResultError;
          }

          // Clear the tool use ID since it's been consumed
          try {
            await clearToolUseId();
          } catch (clearError) {
            console.error("Error clearing tool use ID:", clearError);
            throw clearError;
          }

          // Send the tool result back to the client with a special format
          console.log("Sending tool result to client:", result);

          // Add name field from the tool call to ensure proper mapping on client side
          const enhancedResult = {
            ...result,
            name: currentToolCall.name,
          };

          try {
            await writer.write(
              encoder.encode(`2:${JSON.stringify({ tool_result: enhancedResult })}\n\n`),
            );
          } catch (writeResultError) {
            console.error("Error writing tool result to stream:", writeResultError);
            throw writeResultError;
          }

          // Reset tool call tracking
          currentToolCall = null;
          accumulatedJsonInput = "";
          toolUseId = null;
        } catch (e) {
          console.error("Error parsing tool call JSON input:", e);
          currentToolCall = null;
          accumulatedJsonInput = "";
          toolUseId = null;
        }

        continue;
      }

      // chunk.content is an array of content blocks
      if (Array.isArray(chunk.content) && chunk.content.length > 0) {
        for (const block of chunk.content) {
          if (block.type === "text") {
            // Text block
            const content = block.text;

            await writer.write(encoder.encode(`0:${JSON.stringify(content)}\n\n`));
            currentTextContent += content;

            // Queue real-time DB sync update (non-blocking, after core processing)
            if (streamingContextId) {
              try {
                streamingDBSync.queueChunkUpdate(streamingContextId, content);
              } catch (dbSyncError) {
                console.error("Error in DB sync queue update:", dbSyncError);
                // Don't throw - this is non-blocking
              }
            }
          } else if (block.type === "tool_use") {
            console.log("Starting tool use stream for:", block.name);

            // Create a new ToolCall object with the required properties
            currentToolCall = {
              type: block.type,
              name: block.name,
              id: block.id,
              input: {}, // Initialize with empty object, will be populated by JSON deltas
            } as ToolCall;

            // Generate a tool use ID and save it
            try {
              toolUseId = await generateToolUseId();
            } catch (toolIdError) {
              console.error("Error generating tool use ID:", toolIdError);
              throw toolIdError;
            }

            // Add the tool use ID to the tool call for persistence
            if (currentToolCall) {
              currentToolCall.tool_use_id = toolUseId;
            }

            // Reset JSON accumulation
            accumulatedJsonInput = "";

            console.log(`Started tracking tool call input stream for: ${currentToolCall?.name}`);
          } else if (block.type === "input_json_delta" && currentToolCall) {
            // Accumulate JSON delta for current tool call
            accumulatedJsonInput += block.input;
          }
        }
      }
    }

    console.log("Stream processing complete");

    // Mark streaming record as complete (blocking to ensure completion before return)
    if (streamingContextId) {
      try {
        await streamingDBSync.queueCompletion(streamingContextId);
      } catch (dbCompletionError) {
        console.error("Error in DB sync completion:", dbCompletionError);
        // Don't throw - this is non-blocking but we log the error
      }
    }

    return currentTextContent;
  } catch (error) {
    // Enhanced error logging to capture undefined errors
    const errorInfo = {
      error,
      errorType: typeof error,
      errorConstructor: error?.constructor?.name,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      isUndefined: error === undefined,
      isNull: error === null,
      currentTextLength: currentTextContent.length,
      hasCurrentToolCall: !!currentToolCall,
      toolCallName: currentToolCall?.name,
      streamingContextId,
    };

    console.error("Error processing LangChain stream:", errorInfo);

    const errorMessage =
      error instanceof Error
        ? error.message
        : error === undefined
          ? "Undefined error occurred"
          : error === null
            ? "Null error occurred"
            : String(error);

    // Check if it's an overloaded error from Anthropic
    const isOverloadedError =
      (error instanceof Error &&
        (errorMessage.includes("overloaded") || errorMessage.includes("Overloaded"))) ||
      (error instanceof Error &&
        "cause" in error &&
        error.cause instanceof Error &&
        ((error.cause as Error).message.includes("overloaded") ||
          (error.cause as Error).message.includes("Overloaded")));

    // Create a more user-friendly message for overload errors
    const userErrorMessage = isOverloadedError
      ? "The AI service is currently overloaded. Please try again in a few moments."
      : `Error: ${errorMessage}`;

    try {
      // Format the error message according to the expected stream format (0: for text content)
      await writer.write(encoder.encode(`0:${JSON.stringify(userErrorMessage)}\n\n`));
    } catch (writeError) {
      console.error("Failed to write error message to stream:", writeError);
    }

    return currentTextContent;
  }
}
