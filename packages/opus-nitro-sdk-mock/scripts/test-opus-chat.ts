#!/usr/bin/env tsx

import { logger } from "@infinite-bazaar-demo/logs";
import { opusService } from "../src/modules/opus/opus.service";
import type { Message } from "../src/types/message";

// Test configuration
const TEST_ENTITY_ID = "ent_opus";
const TEST_CHAT_ID = "chat_test_123";
const TEST_PROJECT_ID = "infinite-bazaar-demo";

async function testOpusChat() {
  console.log("🚀 Starting Opus Chat Test");

  try {
    // 1. Get Opus info
    console.log("\n📋 Getting Opus agent info...");
    const opusInfo = await opusService.getOpusInfo();
    console.log("Opus Info:", JSON.stringify(opusInfo, null, 2));

    // 2. Test saving a user message
    console.log("\n💬 Saving user message...");
    const userMessage: Message = {
      role: "user",
      content: "Hello Opus! Can you tell me about the InfiniteBazaar protocol?",
      chatId: TEST_CHAT_ID,
      timestamp: Date.now(),
    };

    await opusService.saveMessage(userMessage);
    console.log("✅ User message saved");

    // 3. Generate a response (mock for now)
    console.log("\n🤖 Generating response...");
    const history = await opusService.loadMessages(TEST_CHAT_ID);
    const response = await opusService.generateResponse(userMessage.content as string, history);
    console.log("Generated response:", response);

    // 4. Save the assistant's response
    console.log("\n💾 Saving assistant response...");
    const assistantMessage: Message = {
      role: "assistant",
      content: response,
      chatId: TEST_CHAT_ID,
      timestamp: Date.now(),
    };

    await opusService.saveMessage(assistantMessage);
    console.log("✅ Assistant message saved");

    // 5. Test tool call simulation
    console.log("\n🔧 Testing tool call...");
    const toolCallMessage: Message = {
      role: "assistant",
      content: {
        type: "tool_use",
        name: "create_did",
        id: "tool_123",
        input: { entityId: TEST_ENTITY_ID },
      },
      chatId: TEST_CHAT_ID,
      timestamp: Date.now(),
    };

    await opusService.saveMessage(toolCallMessage);
    console.log("✅ Tool call message saved");

    // 6. Test tool result
    console.log("\n📊 Testing tool result...");
    const toolResultMessage: Message = {
      role: "user",
      content: {
        type: "tool_result",
        tool_use_id: "tool_123",
        data: {
          success: true,
          did: "did:privado:test123",
          message: "DID created successfully",
        },
      },
      chatId: TEST_CHAT_ID,
      timestamp: Date.now(),
    };

    await opusService.saveMessage(toolResultMessage);
    console.log("✅ Tool result message saved");

    // 7. Load all messages and display conversation
    console.log("\n📚 Loading conversation history...");
    const allMessages = await opusService.loadMessages(TEST_CHAT_ID);
    console.log(`Found ${allMessages.length} messages in conversation:`);

    for (const msg of allMessages) {
      const contentPreview = typeof msg.content === 'string'
        ? msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '')
        : JSON.stringify(msg.content).substring(0, 100) + '...';

      console.log(`  [${msg.role}] ${contentPreview}`);
    }

    // 8. Test message preparation for LLM
    console.log("\n🧠 Testing LLM message preparation...");
    const preparedMessages = await opusService.prepareMessages(allMessages, TEST_PROJECT_ID);
    console.log(`Prepared ${preparedMessages.length} messages for LLM`);

    for (const msg of preparedMessages) {
      const contentPreview = typeof msg.content === 'string'
        ? msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '')
        : `[${Array.isArray(msg.content) ? msg.content.length : 1} content blocks]`;

      console.log(`  [${msg.role}] ${contentPreview}`);
    }

    // 9. Test conversation reset
    console.log("\n🗑️  Testing conversation reset...");
    await opusService.resetConversation(TEST_CHAT_ID);

    const messagesAfterReset = await opusService.loadMessages(TEST_CHAT_ID);
    console.log(`Messages after reset: ${messagesAfterReset.length}`);

    console.log("\n✅ All tests completed successfully!");

  } catch (error) {
    console.error("❌ Test failed:", error);
    logger.error({ error }, "Opus chat test failed");
    process.exit(1);
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testOpusChat()
    .then(() => {
      console.log("🎉 Test script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Test script failed:", error);
      process.exit(1);
    });
} 