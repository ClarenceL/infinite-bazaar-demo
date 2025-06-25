import { logger } from "@infinite-bazaar-demo/logs";
import { Hono } from "hono";
import { errorHandler } from "../../pkg/middleware/error.js";
import { agentService } from "./agent.service.js";

// Create the agent router
export const agentRoutes = new Hono()
  .use("*", errorHandler())

  // Get agent information
  .get("/info", async (c) => {
    try {
      const info = await agentService.getAgentInfo();
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
      const systemPrompt = agentService.getSystemPrompt();
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
      // 1. { message: "text", chatId?: "id", entityId: "required" } (simple format)
      // 2. { type: "message", content: { role: "user", content: "text" }, entityId: "required" } (MCP format)
      let message: string;
      let chatId: string | undefined;
      let entityId: string;

      if (body.type === "message" && body.content) {
        // MCP format
        message = body.content.content;
        chatId = body.chatId;
        entityId = body.entityId;
      } else {
        // Simple format
        message = body.message;
        chatId = body.chatId;
        entityId = body.entityId;
      }

      if (!message || typeof message !== "string") {
        return c.json({ error: "Message is required and must be a string" }, 400);
      }

      if (!entityId || typeof entityId !== "string") {
        return c.json({ error: "entityId is required and must be a string" }, 400);
      }

      logger.info(
        { message: message.substring(0, 100), chatId, entityId },
        "Chat request received",
      );

      // Load message history
      const messages = await agentService.loadMessages(chatId, entityId);

      // Save the incoming user message
      await agentService.saveMessage(
        {
          role: "user",
          content: message,
          chatId,
        },
        entityId,
      );

      // Set up Server-Sent Events stream following the reference pattern
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Start the streaming response generation in the background
      (async () => {
        try {
          logger.info("Starting streaming AI response generation");

          // Use the streaming AI response that writes directly to the stream
          await agentService.generateStreamingAIResponse(
            [...messages, { role: "user", content: message, chatId }],
            writer,
            encoder,
            entityId,
          );

          logger.info("Streaming response completed successfully");

          // Note: The complete response is already saved by generateStreamingAIResponse
          // No need to save again here to avoid duplicates
        } catch (error) {
          logger.error(
            error,
            `Error in streaming route - this should not happen if fallback works: ${error instanceof Error ? error.message : "Unknown error"}`,
          );

          const errorMessage = error instanceof Error ? error.message : String(error);
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({ type: "error", data: errorMessage })}\n\n`),
          );
        } finally {
          // Only close the writer if it's still writable
          try {
            if (writer.desiredSize !== null) {
              await writer.close();
            }
          } catch (closeError) {
            // Writer was already closed or errored, which is fine
            logger.debug({ closeError }, "Writer was already closed");
          }
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
      const entityId = c.req.query("entityId");

      if (!entityId || typeof entityId !== "string") {
        return c.json({ error: "entityId query parameter is required" }, 400);
      }

      const messages = await agentService.loadMessages(chatId || undefined, entityId);

      return c.json({
        success: true,
        messages,
        count: messages.length,
        entityId,
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
      const { chatId, entityId } = body as { chatId?: string; entityId: string };

      if (!entityId || typeof entityId !== "string") {
        return c.json({ error: "entityId is required and must be a string" }, 400);
      }

      await agentService.resetConversation(chatId, entityId);

      return c.json({
        success: true,
        message: "Conversation history reset successfully",
        entityId,
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
      const info = await agentService.getAgentInfo();
      return c.json({
        // @ts-ignore
        status: "healthy",
        agent: "agent",
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
