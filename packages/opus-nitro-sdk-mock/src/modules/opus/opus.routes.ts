import { logger } from "@infinite-bazaar-demo/logs";
import { Hono } from "hono";
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
        entityId: "ent_opus",
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

      if (!message || typeof message !== "string") {
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

      // Set up Server-Sent Events stream following the reference pattern
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Start the streaming response generation in the background
      (async () => {
        try {
          logger.info("Starting streaming AI response generation");

          // Use the streaming AI response that writes directly to the stream
          const response = await opusService.generateStreamingAIResponse(
            [...messages, { role: "user", content: message, chatId }],
            writer,
            encoder,
          );

          logger.info(
            { responseLength: response.length, responsePreview: response.substring(0, 100) },
            "Streaming response completed successfully",
          );

          // Note: The complete response is already saved by generateStreamingAIResponse
          // No need to save again here to avoid duplicates
        } catch (error) {
          logger.error(
            { error },
            "Error in streaming route - this should not happen if fallback works",
          );

          const errorMessage = error instanceof Error ? error.message : String(error);
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({ type: "error", data: errorMessage })}\n\n`),
          );
        } finally {
          // Always close the writer
          await writer.close();
        }
      })();

      // Return the readable stream with proper headers
      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
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
        count: messages.length,
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
        message: "Conversation history reset successfully",
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
        ...info,
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
