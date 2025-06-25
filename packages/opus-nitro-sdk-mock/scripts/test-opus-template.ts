#!/usr/bin/env tsx

// Template test script for Opus chat endpoint with cycle interval

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3105";

// Template message with placeholders
const TEMPLATE_MESSAGE = `CYCLE_INTERVAL: {{cycle_interval}}  
CURRENT TIMESTAMP: {{current_timestamp}}

What will you do with this moment of existence?`;

// Get cycle interval from command line argument or use default (1 minute)
const CYCLE_INTERVAL = process.argv[2] || "1 minute";

/**
 * Parse and handle streaming response similar to use-stream-handling.ts
 */
async function parseStreamResponse(
  responseBody: ReadableStream<Uint8Array>,
  options: {
    debug?: boolean;
    onUpdate: (text: string, toolResult?: { tool: string; data: any }) => void;
  },
): Promise<void> {
  const reader = responseBody.getReader();
  const decoder = new TextDecoder();

  console.log("🔍 Starting stream parsing...");

  try {
    let chunkCount = 0;
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log(`\n🏁 Stream ended after ${chunkCount} chunks`);
        break;
      }

      chunkCount++;
      const chunk = decoder.decode(value, { stream: true });

      if (options.debug) {
        console.log(`\n📦 Chunk ${chunkCount} (${chunk.length} bytes):`, JSON.stringify(chunk));
      }

      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.trim()) continue;

        if (options.debug) {
          console.log(`📋 Processing line:`, JSON.stringify(line));
        }

        // Handle Server-Sent Events format: "data: {...}"
        if (line.startsWith("data: ")) {
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
            if (options.debug) {
              console.log(`\n⚠️ Failed to parse SSE data:`, e);
            }
          }
        }
        // Handle format like "0:content" from processLangChainStream.ts - THIS IS THE MAIN FORMAT
        else if (line.includes(":")) {
          const colonIndex = line.indexOf(":");
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
                options.onUpdate("", {
                  tool: parsedContent.tool_result.name,
                  data: parsedContent.tool_result,
                });
              } else if (parsedContent.tool_call) {
                options.onUpdate("", {
                  tool: parsedContent.tool_call.name,
                  data: parsedContent.tool_call,
                });
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

/**
 * Replace template variables in the message
 */
function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"), value);
  }

  return result;
}

async function testOpusTemplate() {
  console.log("🚀 Testing Opus API with template message");
  console.log(`📍 API Base URL: ${API_BASE_URL}`);

  try {
    // Prepare template variables
    const templateVariables = {
      cycle_interval: CYCLE_INTERVAL,
      current_timestamp: new Date().toISOString(),
    };

    // Replace template variables
    const finalMessage = replaceTemplateVariables(TEMPLATE_MESSAGE, templateVariables);

    console.log("\n📝 Template Variables:");
    console.log(`  cycle_interval: ${templateVariables.cycle_interval}`);
    console.log(`  current_timestamp: ${templateVariables.current_timestamp}`);

    console.log("\n💬 Sending template message to Opus...");
    console.log("📋 Final message:");
    console.log("─".repeat(50));
    console.log(finalMessage);
    console.log("─".repeat(50));

    const response = await fetch(`${API_BASE_URL}/opus/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Key": process.env.OPUS_NITRO_AUTH_KEY || "test-key-123",
      },
      body: JSON.stringify({
        type: "message",
        content: {
          role: "user",
          content: finalMessage,
        },
        entityId: "ent_opus",
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
      console.log("📝 Live response:");

      let fullResponse = "";
      const toolResults: Array<{ tool: string; data: any }> = [];

      await parseStreamResponse(response.body, {
        debug: false, // Set to true for detailed debugging
        onUpdate: (text: string, toolResult?: { tool: string; data: any }) => {
          if (toolResult) {
            toolResults.push(toolResult);
          } else if (text) {
            // Output each character immediately without newlines
            process.stdout.write(text);
            fullResponse += text;
          }
        },
      });

      console.log(`\n\n📊 Stream Summary:`);
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

    console.log("\n🎉 Template test completed successfully!");
  } catch (error) {
    console.error("❌ Template test failed:", error);

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
  const templateVariables = {
    cycle_interval: CYCLE_INTERVAL,
    current_timestamp: new Date().toISOString(),
  };
  const finalMessage = replaceTemplateVariables(TEMPLATE_MESSAGE, templateVariables);

  console.log("\n📋 Equivalent curl command:");
  console.log(`curl -X POST ${API_BASE_URL}/opus/chat \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{`);
  console.log(`    "type": "message",`);
  console.log(`    "content": {`);
  console.log(`      "role": "user",`);
  console.log(`      "content": ${JSON.stringify(finalMessage)}`);
  console.log(`    },`);
  console.log(`    "entityId": "ent_opus"`);
  console.log(`  }'`);
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  // Show usage if help is requested
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    const scriptName = process.argv[1]?.split("/").pop() || "test-opus-template.ts";
    console.log("📖 Usage:");
    console.log(`  tsx ${scriptName} [cycle_interval]`);
    console.log("");
    console.log("📝 Examples:");
    console.log(`  tsx ${scriptName}`);
    console.log(`  tsx ${scriptName} "30 seconds"`);
    console.log(`  tsx ${scriptName} "5 minutes"`);
    console.log(`  tsx ${scriptName} "1 hour"`);
    process.exit(0);
  }

  console.log(`⏱️  Using cycle interval: "${CYCLE_INTERVAL}"`);
  console.log("💡 Tip: You can pass a custom cycle interval as an argument");

  showCurlCommand();

  testOpusTemplate()
    .then(() => {
      console.log("✨ Template test completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Template test failed:", error);
      process.exit(1);
    });
}
