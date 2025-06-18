#!/usr/bin/env tsx

// Simple API test script for Opus chat endpoint

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3105";
const DEFAULT_MESSAGE = "Hello Opus! Can you tell me about the InfiniteBazaar protocol?";

// Get message from command line argument or use default
const TEST_MESSAGE = process.argv[2] || DEFAULT_MESSAGE;

/**
 * Parse and handle streaming response similar to use-stream-handling.ts
 */
async function parseStreamResponse(
  responseBody: ReadableStream<Uint8Array>,
  options: {
    debug?: boolean;
    onUpdate: (text: string, toolResult?: { tool: string; data: any }) => void;
  }
): Promise<void> {
  const reader = responseBody.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        // Show progress dot for each event
        process.stdout.write('.');

        // Handle Server-Sent Events format: "data: {...}"
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6)); // Remove 'data: ' prefix

            if (data.type === "text" && data.data) {
              options.onUpdate(data.data);
            } else if (data.type === "done") {
              return;
            } else if (data.type === "error") {
              console.log(`\n❌ Stream error: ${data.data}`);
              return;
            } else if (data.type === "tool_result" && data.data) {
              // Handle new tool result format
              options.onUpdate("", { tool: data.data.name || "unknown", data: data.data });
            } else if (data.type === "tool_call" && data.data) {
              // Handle new tool call format
              options.onUpdate("", { tool: data.data.name || "unknown", data: data.data });
            }
            // Keep backward compatibility with old format
            else if (data.tool_result) {
              options.onUpdate("", { tool: data.tool_result.name, data: data.tool_result });
            } else if (data.tool_call) {
              options.onUpdate("", { tool: data.tool_call.name, data: data.tool_call });
            }
          } catch (e) {
            // Skip malformed lines silently
          }
        }
        // Handle format like "0:content" from processLangChainStream.ts - THIS IS THE MAIN FORMAT
        else if (line.includes(':')) {
          const colonIndex = line.indexOf(':');
          const prefix = line.substring(0, colonIndex);
          const content = line.substring(colonIndex + 1);

          if (options.debug) {
            console.log(`\n📦 Stream line: ${prefix}:${content.substring(0, 50)}...`);
          }

          try {
            const parsedContent = JSON.parse(content);

            if (prefix === "0") {
              // Text content - this is the main format we expect
              options.onUpdate(parsedContent);
            } else if (prefix === "2") {
              // Tool call or result
              if (parsedContent.tool_result) {
                options.onUpdate("", { tool: parsedContent.tool_result.name, data: parsedContent.tool_result });
              } else if (parsedContent.tool_call) {
                options.onUpdate("", { tool: parsedContent.tool_call.name, data: parsedContent.tool_call });
              }
            }
          } catch (e) {
            if (options.debug) {
              console.log(`\n⚠️ Failed to parse content: ${e}`);
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function testOpusAPI() {
  console.log("🚀 Testing Opus API with HTTP request");
  console.log(`📍 API Base URL: ${API_BASE_URL}`);

  try {
    console.log("\n💬 Sending message to Opus...");
    console.log(`Message: "${TEST_MESSAGE}"`);

    const response = await fetch(`${API_BASE_URL}/opus/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "message",
        content: {
          role: "user",
          content: TEST_MESSAGE,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log("\n📝 Opus Response:");
    console.log("Status:", response.status);
    console.log("Content-Type:", response.headers.get("content-type"));

    // Check if we have a streaming response
    if (response.body) {
      console.log("\n🔄 Processing streaming response:");

      let fullResponse = "";
      const toolResults: Array<{ tool: string; data: any }> = [];

      await parseStreamResponse(response.body, {
        debug: true, // Enable debug to see what format we're actually receiving
        onUpdate: (text: string, toolResult?: { tool: string; data: any }) => {
          if (toolResult) {
            toolResults.push(toolResult);
          } else if (text) {
            fullResponse += text;
          }
        }
      });

      console.log(`\n\n📝 Full Response:`);
      console.log(fullResponse);

      console.log(`\n📊 Stream Summary:`);
      console.log(`📝 Response length: ${fullResponse.length} characters`);
      console.log(`🔧 Tool results: ${toolResults.length}`);

      if (toolResults.length > 0) {
        console.log("\n🔧 Tool Results:");
        toolResults.forEach((result, index) => {
          console.log(`  ${index + 1}. ${result.tool}:`, result.data);
        });
      }
    } else {
      console.log("❌ No response body received");
    }

    console.log("\n🎉 API test completed successfully!");

  } catch (error) {
    console.error("❌ API test failed:", error);

    if (error instanceof TypeError && error.message.includes("fetch")) {
      console.error("\n💡 Make sure the Opus API server is running:");
      console.error(`   cd packages/opus-nitro-sdk-mock && pnpm dev`);
      console.error(`   Server should be available at ${API_BASE_URL}`);
    }

    process.exit(1);
  }
}

// Equivalent curl command for reference
function showCurlCommand() {
  console.log("\n📋 Equivalent curl command:");
  console.log(`curl -X POST ${API_BASE_URL}/opus/chat \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{`);
  console.log(`    "type": "message",`);
  console.log(`    "content": {`);
  console.log(`      "role": "user",`);
  console.log(`      "content": "${TEST_MESSAGE}"`);
  console.log(`    }`);
  console.log(`  }'`);
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  // Show usage if help is requested
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    const scriptName = process.argv[1]?.split('/').pop() || 'test-opus-chat.ts';
    console.log("📖 Usage:");
    console.log(`  tsx ${scriptName} [message]`);
    console.log("");
    console.log("📝 Examples:");
    console.log(`  tsx ${scriptName}`);
    console.log(`  tsx ${scriptName} "Tell me about DIDs"`);
    console.log(`  tsx ${scriptName} "How does x402 payment work?"`);
    process.exit(0);
  }

  console.log(`💬 Using message: "${TEST_MESSAGE}"`);
  if (TEST_MESSAGE === DEFAULT_MESSAGE) {
    console.log("💡 Tip: You can pass a custom message as an argument");
  }

  showCurlCommand();

  testOpusAPI()
    .then(() => {
      console.log("✨ API test completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 API test failed:", error);
      process.exit(1);
    });
} 