import { logger } from "@infinite-bazaar-demo/logs";
import type { Message, ToolCall, ToolCallResult } from "../../../types/message";

// Mock tool processing function - in real implementation this would call actual tools
async function processToolCall(
  toolName: string,
  input: Record<string, any>,
  projectId: string,
  userId: string,
  state?: any,
  authToken?: string,
): Promise<ToolCallResult> {
  logger.info({ toolName, projectId, userId }, "Processing tool call");

  // Mock tool results based on tool name
  const mockResults: Record<string, any> = {
    create_did: {
      success: true,
      did: `did:privado:${Math.random().toString(36).substring(2)}`,
      message: "DID created successfully for Opus agent",
    },
    sign_state_hash: {
      success: true,
      signature: `0x${Math.random().toString(16).substring(2)}`,
      hash: `0x${Math.random().toString(16).substring(2)}`,
      message: "State hash signed in secure enclave",
    },
    commit_memory: {
      success: true,
      ipfs_cid: `Qm${Math.random().toString(36).substring(2)}`,
      blockchain_tx: `0x${Math.random().toString(16).substring(2)}`,
      message: "Memory committed to IPFS and Base Sepolia",
    },
    x402_payment: {
      success: true,
      transaction_hash: `0x${Math.random().toString(16).substring(2)}`,
      amount: input.amount || "1.00",
      currency: "USDC",
      message: "x402 payment processed successfully",
    },
  };

  const result = mockResults[toolName] || {
    success: false,
    message: `Unknown tool: ${toolName}`,
  };

  return {
    type: "tool_result",
    tool_use_id: "", // Will be set by caller
    data: result,
    name: toolName,
  };
}

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
  projectId,
  userId,
  state,
  authToken,
}: {
  stream: AsyncIterable<any>;
  writer: WritableStreamDefaultWriter;
  encoder: TextEncoder;
  generateToolUseId: () => Promise<string>;
  clearToolUseId: () => Promise<void>;
  saveMessages: (message: Message) => Promise<void>;
  projectId: string;
  userId: string;
  state: any;
  authToken?: string;
}): Promise<string> {
  // Track text content
  let currentTextContent = ""; // Accumulate text content

  // Tool call tracking
  let currentToolCall: ToolCall | null = null;
  let accumulatedJsonInput = "";
  let toolUseId: string | null = null;

  try {
    // Process the stream
    for await (const chunk of stream) {
      // Log accessible properties of the chunk object for debugging
      logger.debug({ chunkKeys: Object.getOwnPropertyNames(chunk) }, "Processing stream chunk");

      // Check for stream completion of a tool call
      if (
        currentToolCall &&
        chunk.additional_kwargs?.stop_reason === "tool_use" &&
        Array.isArray(chunk.content) &&
        chunk.content.length === 0
      ) {
        logger.info({ accumulatedJsonInput }, "Tool call JSON input complete, parsing");

        try {
          // Parse the accumulated JSON if not empty, otherwise use empty object
          const parsedInput = accumulatedJsonInput.trim() ? JSON.parse(accumulatedJsonInput) : {};

          // Remove authToken if it exists in parsedInput
          if ("authToken" in parsedInput) {
            const { authToken: _, ...cleanedInput } = parsedInput;
            currentToolCall.input = cleanedInput;
          } else {
            // Update the tool call with the parsed input
            currentToolCall.input = parsedInput;
          }

          logger.info(
            { toolName: currentToolCall.name, input: parsedInput },
            "Processing complete tool call",
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
            { toolName: currentToolCall.name, input: currentToolCall.input },
            "Processing tool call",
          );
          const result = await processToolCall(
            currentToolCall.name,
            currentToolCall.input,
            projectId,
            userId,
            state,
            authToken,
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
          logger.info({ result }, "Sending tool result to client");

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
        } catch (e) {
          logger.error({ error: e }, "Error parsing tool call JSON input");
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
          } else if (block.type === "tool_use") {
            logger.info({ toolName: block.name }, "Starting tool use stream");

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
              { toolName: currentToolCall?.name },
              "Started tracking tool call input stream",
            );
          } else if (block.type === "input_json_delta" && currentToolCall) {
            // Accumulate JSON delta for current tool call
            logger.debug({ jsonDelta: block.input }, "JSON delta for tool call");
            accumulatedJsonInput += block.input;
          }
        }
      }
    }

    logger.info("Stream processing complete");
    return currentTextContent;
  } catch (error) {
    logger.error({ error }, "Error processing LangChain stream");
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

    // Format the error message according to the expected stream format (0: for text content)
    await writer.write(encoder.encode(`0:${JSON.stringify(userErrorMessage)}\n\n`));

    return currentTextContent;
  }
} 