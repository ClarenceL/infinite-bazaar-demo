import { logger } from "@infinite-bazaar-demo/logs";
import { streamingDBSync } from "../../../services/streaming-db-sync.js";
import type { Message, ToolCall, ToolCallResult } from "../../../types/message.js";
import { processToolCall } from "../../tools/handlers/index.js";

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

  logger.info(
    {
      hasStream: !!stream,
      hasWriter: !!writer,
      hasEncoder: !!encoder,
      streamingContextId,
    },
    "🔄 Starting processLangChainStream with parameters",
  );

  try {
    let chunkCount = 0;

    // Process the stream
    for await (const chunk of stream) {
      chunkCount++;

      logger.debug(
        {
          chunkNumber: chunkCount,
          chunkType: typeof chunk,
          hasContent: !!chunk?.content,
          contentType: typeof chunk?.content,
          contentLength: Array.isArray(chunk?.content)
            ? chunk.content.length
            : typeof chunk?.content === "string"
              ? chunk.content.length
              : "unknown",
          hasAdditionalKwargs: !!chunk?.additional_kwargs,
          stopReason: chunk?.additional_kwargs?.stop_reason,
          currentToolCallActive: !!currentToolCall,
        },
        "📦 Processing stream chunk",
      );

      try {
        // Check for stream completion of a tool call
        if (
          currentToolCall &&
          chunk.additional_kwargs?.stop_reason === "tool_use" &&
          Array.isArray(chunk.content) &&
          chunk.content.length === 0
        ) {
          logger.info(
            {
              accumulatedJsonInput,
              toolName: currentToolCall.name,
              toolId: currentToolCall.id,
              toolUseId,
            },
            "🔧 Tool call JSON input complete, parsing",
          );

          try {
            // Parse the accumulated JSON if not empty, otherwise use empty object
            const parsedInput = accumulatedJsonInput.trim() ? JSON.parse(accumulatedJsonInput) : {};

            // Update the tool call with the parsed input
            currentToolCall.input = parsedInput;

            logger.info(
              {
                toolName: currentToolCall.name,
                input: parsedInput,
                inputKeys: Object.keys(parsedInput),
              },
              "🔧 Processing complete tool call",
            );

            // Store the tool call as the assistant's response
            await saveMessages({
              role: "assistant",
              content: currentToolCall,
              timestamp: Date.now(),
            });

            // Send tool call to client, but client should suppress it (it's informational only)
            await writer.write(
              encoder.encode(`2:${JSON.stringify({ tool_call: currentToolCall })}\n\n`),
            );

            // Process the tool call
            logger.info(
              {
                toolName: currentToolCall.name,
                input: currentToolCall.input,
                toolUseId,
              },
              "🔧 Executing tool call handler",
            );

            const result = await processToolCall(
              currentToolCall.name,
              currentToolCall.input,
              entityId,
            );

            logger.info(
              {
                toolName: currentToolCall.name,
                resultType: typeof result,
                resultSuccess: result?.data?.success,
                resultError: result?.data?.error,
              },
              "🔧 Tool call handler completed",
            );

            // Add the tool_use_id to connect this result to the tool call
            if (toolUseId) {
              result.tool_use_id = toolUseId;
            }

            // Add the tool result to message history
            await saveMessages({
              role: "user",
              content: result,
              timestamp: Date.now(),
            });

            // Clear the tool use ID since it's been consumed
            await clearToolUseId();

            // Send the tool result back to the client with a special format
            logger.info(
              {
                resultData: result?.data,
                toolName: currentToolCall.name,
              },
              "🔧 Sending tool result to client",
            );

            // Add name field from the tool call to ensure proper mapping on client side
            const enhancedResult = {
              ...result,
              name: currentToolCall.name,
            };

            await writer.write(
              encoder.encode(`2:${JSON.stringify({ tool_result: enhancedResult })}\n\n`),
            );

            // Reset tool call tracking
            currentToolCall = null;
            accumulatedJsonInput = "";
            toolUseId = null;

            logger.debug("🔧 Tool call processing complete, state reset");
          } catch (toolError) {
            logger.error(
              {
                error: toolError,
                errorMessage: toolError instanceof Error ? toolError.message : "Unknown tool error",
                errorStack: toolError instanceof Error ? toolError.stack : undefined,
                toolName: currentToolCall?.name,
                accumulatedJsonInput,
              },
              "❌ Error parsing tool call JSON input or processing tool",
            );

            // Reset tool call tracking on error
            currentToolCall = null;
            accumulatedJsonInput = "";
            toolUseId = null;
          }

          continue;
        }

        // Handle direct string content (LangChain format)
        if (typeof chunk.content === "string" && chunk.content) {
          const content = chunk.content;

          logger.debug(
            {
              contentLength: content.length,
              contentPreview: content.substring(0, 100),
            },
            "📝 Processing string content",
          );

          await writer.write(encoder.encode(`0:${JSON.stringify(content)}\n\n`));
          currentTextContent += content;

          // Queue real-time DB sync update (non-blocking)
          if (streamingContextId) {
            streamingDBSync.queueChunkUpdate(streamingContextId, content);
          }

          continue;
        }

        // chunk.content is an array of content blocks (alternative format)
        if (Array.isArray(chunk.content) && chunk.content.length > 0) {
          logger.debug(
            {
              blockCount: chunk.content.length,
              blockTypes: chunk.content.map((block: any) => block?.type || "unknown"),
            },
            "📝 Processing content blocks array",
          );

          for (const block of chunk.content as any[]) {
            try {
              if (block.type === "text") {
                // Text block
                const content = block.text;

                logger.debug(
                  {
                    textLength: content?.length || 0,
                    textPreview: content?.substring(0, 100) || "",
                  },
                  "📝 Processing text block",
                );

                await writer.write(encoder.encode(`0:${JSON.stringify(content)}\n\n`));
                currentTextContent += content;

                // Queue real-time DB sync update (non-blocking)
                if (streamingContextId) {
                  streamingDBSync.queueChunkUpdate(streamingContextId, content);
                }
              } else if (block.type === "tool_use") {
                logger.info(
                  {
                    toolName: block.name,
                    toolId: block.id,
                    hasInput: !!block.input,
                  },
                  "🔧 Starting tool use stream",
                );

                // Create a new ToolCall object with the required properties
                currentToolCall = {
                  type: block.type,
                  name: block.name,
                  id: block.id,
                  input: {}, // Initialize with empty object, will be populated by JSON deltas
                } as ToolCall;

                // Generate a tool use ID and save it
                toolUseId = await generateToolUseId();

                // Add the tool use ID to the tool call for persistence
                if (currentToolCall) {
                  currentToolCall.tool_use_id = toolUseId;
                }

                // Reset JSON accumulation
                accumulatedJsonInput = "";

                logger.info(
                  {
                    toolName: currentToolCall?.name,
                    toolUseId,
                  },
                  "🔧 Started tracking tool call input stream",
                );
              } else if (block.type === "input_json_delta" && currentToolCall) {
                // Accumulate JSON delta for current tool call
                logger.debug(
                  {
                    jsonDelta: block.input,
                    deltaLength: block.input?.length || 0,
                    accumulatedLength: accumulatedJsonInput.length,
                    toolName: currentToolCall.name,
                  },
                  "🔧 JSON delta for tool call",
                );
                accumulatedJsonInput += block.input;
              } else {
                logger.warn(
                  {
                    blockType: block.type,
                    blockKeys: Object.keys(block || {}),
                    hasCurrentToolCall: !!currentToolCall,
                  },
                  "⚠️ Unknown or unhandled block type",
                );
              }
            } catch (blockError) {
              logger.error(
                {
                  error: blockError,
                  errorMessage:
                    blockError instanceof Error ? blockError.message : "Unknown block error",
                  blockType: block?.type,
                  blockKeys: Object.keys(block || {}),
                },
                "❌ Error processing content block",
              );
            }
          }
        } else if (chunk.content === undefined || chunk.content === null) {
          logger.debug(
            {
              chunkKeys: Object.keys(chunk || {}),
              hasAdditionalKwargs: !!chunk?.additional_kwargs,
            },
            "📦 Chunk with no content (likely metadata)",
          );
        } else {
          logger.warn(
            {
              contentType: typeof chunk.content,
              contentValue: chunk.content,
              chunkKeys: Object.keys(chunk || {}),
            },
            "⚠️ Unhandled chunk content format",
          );
        }
      } catch (chunkError) {
        logger.error(
          {
            error: chunkError,
            errorMessage: chunkError instanceof Error ? chunkError.message : "Unknown chunk error",
            errorStack: chunkError instanceof Error ? chunkError.stack : undefined,
            chunkNumber: chunkCount,
            chunkKeys: Object.keys(chunk || {}),
          },
          "❌ Error processing individual chunk",
        );
      }
    }

    logger.info(
      {
        textLength: currentTextContent.length,
        totalChunks: chunkCount,
        streamingContextId,
      },
      "✅ Stream processing complete",
    );

    // Mark streaming record as complete (non-blocking)
    if (streamingContextId) {
      streamingDBSync.queueCompletion(streamingContextId);
    }

    // Send done signal to indicate stream completion
    await writer.write(encoder.encode(`data: {"type":"done"}\n\n`));

    return currentTextContent;
  } catch (error) {
    logger.error(
      {
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : undefined,
        errorName: error instanceof Error ? error.name : undefined,
        errorCause: error instanceof Error && "cause" in error ? error.cause : undefined,
        currentTextLength: currentTextContent.length,
        hasCurrentToolCall: !!currentToolCall,
        currentToolCallName: currentToolCall?.name,
        streamingContextId,
      },
      "❌ Error processing LangChain stream",
    );

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

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

    logger.info(
      {
        isOverloadedError,
        userErrorMessage,
        originalError: errorMessage,
      },
      "📤 Sending error message to client",
    );

    try {
      // Format the error message according to the expected stream format (0: for text content)
      await writer.write(encoder.encode(`0:${JSON.stringify(userErrorMessage)}\n\n`));
    } catch (writeError) {
      logger.error(
        {
          writeError,
          writeErrorMessage:
            writeError instanceof Error ? writeError.message : "Unknown write error",
        },
        "❌ Failed to write error message to stream",
      );
    }

    return currentTextContent;
  }
}
