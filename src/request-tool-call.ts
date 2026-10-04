import OpenAI from "openai";
import { callTool } from "./tools/call-tool.js";
import { getToolDefinitions } from "./tools/get-tool-definitions.js";

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is missing from .env; request not sent.");
    process.exitCode = 1;
    return;
  }

  const openai = new OpenAI();
  const prompt =
    process.argv.slice(2).join(" ") || "What does package.json contain?";

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You are a coding assistant. For questions about local project files, use the provided tool instead of guessing.",
    },
    {
      role: "user",
      content: prompt,
    },
  ];

  const tools = getToolDefinitions().map((definition) => ({
    type: "function" as const,
    function: definition,
  }));

  const MAX_TURNS = 10;
  let turn = 0;

  while (turn < MAX_TURNS) {
    turn += 1;
    console.log(`\nAgent turn ${turn}/${MAX_TURNS}`);

    const response = await openai.chat.completions.create({
      model: "gpt-6-luna",
      reasoning_effort: "none",
      messages,
      tools,
      tool_choice: "auto",
      parallel_tool_calls: false,
    });

    const assistantMessage = response.choices[0]?.message;

    if (!assistantMessage) {
      throw new Error("No assistant message returned.");
    }

    // Keep the assistant message, including any tool-call requests, in history.
    messages.push(assistantMessage);

    const toolCalls = assistantMessage.tool_calls ?? [];

    if (toolCalls.length === 0) {
      console.log("\nFinal assistant answer:");
      console.log(assistantMessage.content ?? "");
      return;
    }

    for (const toolCall of toolCalls) {
      if (toolCall.type !== "function") {
        throw new Error(`Unsupported tool call type: ${toolCall.type}`);
      }

      console.log("\nTool name:", toolCall.function.name);
      console.log("Raw arguments:", toolCall.function.arguments);

      let toolResult: string;

      try {
        const parsedArgs: unknown = JSON.parse(toolCall.function.arguments);
        toolResult = await callTool(toolCall.function.name, parsedArgs);
      } catch {
        toolResult = "Tool arguments were not valid JSON.";
      }

      console.log("Tool result:");
      console.log(toolResult);

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: toolResult,
      });
    }
  }

  console.error(`Stopped after reaching the ${MAX_TURNS}-turn safety limit.`);
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  if (error instanceof OpenAI.APIError) {
    console.error("OpenAI request failed:");
    console.error("HTTP status:", error.status ?? "unknown");
    console.error("Error code:", error.code ?? "unknown");
    console.error("Error type:", error.type ?? "unknown");
    console.error("Error message:", error.message);
  } else {
    console.error("OpenAI request failed before receiving an API response.");
  }

  process.exitCode = 1;
});
