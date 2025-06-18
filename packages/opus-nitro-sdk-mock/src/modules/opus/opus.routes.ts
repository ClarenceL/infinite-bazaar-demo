import { logger } from "@infinite-bazaar-demo/logs";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { errorHandler } from "../../pkg/middleware/error.js";
import { opusService } from "./opus.service.js";

// Create the opus router
export const opusRoutes = new Hono()
  .use("*", errorHandler())

  // Get Opus agent information
  .get("/info", async (c) => {
    try {
      const info = await opusService.getOpusInfo();
      return c.json(info);
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  })

  // Get system prompt
  .get("/prompt", async (c) => {
    try {
      const systemPrompt = opusService.getSystemPrompt();
      return c.json({
        success: true,
        systemPrompt,
        entityId: "ent_opus"
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  })

  // Chat endpoint with Server-Sent Events streaming
  .post("/chat", async (c) => {
    try {
      const body = await c.req.json();

      // Handle both message formats:
      // 1. { message: "text", chatId?: "id" } (simple format)
      // 2. { type: "message", content: { role: "user", content: "text" } } (MCP format)
      let message: string;
      let chatId: string | undefined;

      if (body.type === "message" && body.content) {
        // MCP format
        message = body.content.content;
        chatId = body.chatId;
      } else {
        // Simple format
        message = body.message;
        chatId = body.chatId;
      }

      if (!message || typeof message !== 'string') {
        return c.json({ error: "Message is required and must be a string" }, 400);
      }

      logger.info({ message: message.substring(0, 100), chatId }, "Chat request received");

      // Load message history
      const messages = await opusService.loadMessages(chatId);

      // Save the incoming user message
      await opusService.saveMessage({
        role: "user",
        content: message,
        chatId,
      });

      // Set up Server-Sent Events stream
      return stream(c, async (stream) => {
        try {
          // Create a writer that formats output for SSE
          const writer = {
            write: async (chunk: Uint8Array) => {
              // The chunk comes in the format "0:content\n\n" or "2:tool_data\n\n"
              // We need to forward this directly to the SSE stream
              await stream.write(chunk);
            },
            close: async () => {
              // No-op for SSE
            },
          };

          const encoder = new TextEncoder();

          // Use the streaming AI response that writes directly to our writer
          const response = await opusService.generateStreamingAIResponse(
            [...messages, { role: "user", content: message, chatId }],
            writer as any,
            encoder
          );

          logger.info({ responseLength: response.length, responsePreview: response.substring(0, 100) }, "Streaming response completed");

          // Save the assistant response
          await opusService.saveMessage({
            role: "assistant",
            content: response,
            chatId,
          });

          // Send completion signal
          await stream.write(new TextEncoder().encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));

        } catch (error) {
          logger.error({ error }, "Error processing chat request");

          const errorMessage = error instanceof Error ? error.message : String(error);
          await stream.write(new TextEncoder().encode(`data: ${JSON.stringify({ type: "error", data: errorMessage })}\n\n`));
        }
      });

    } catch (error) {
      logger.error({ error }, "Chat endpoint error");
      return c.json({ error: "Internal server error" }, 500);
    }
  })

  // Get message history
  .get("/messages", async (c) => {
    try {
      const chatId = c.req.query("chatId");
      const messages = await opusService.loadMessages(chatId || undefined);

      return c.json({
        success: true,
        messages,
        count: messages.length
      });
    } catch (error) {
      logger.error({ error }, "Error fetching messages");
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  })

  // Reset conversation
  .post("/reset", async (c) => {
    try {
      const body = await c.req.json();
      const { chatId } = body as { chatId?: string };

      await opusService.resetConversation(chatId);

      return c.json({
        success: true,
        message: "Conversation history reset successfully"
      });
    } catch (error) {
      logger.error({ error }, "Error resetting conversation");
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  })

  // Health check endpoint
  .get("/health", async (c) => {
    try {
      const info = await opusService.getOpusInfo();
      return c.json({
        // @ts-ignore
        status: "healthy",
        agent: "opus",
        ...info
      });
    } catch (error) {
      return c.json(
        {
          status: "unhealthy",
          error: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  }); 