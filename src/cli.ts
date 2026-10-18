import OpenAI from "openai";
import { runAgent, MAX_TURNS } from "./agent/orchestrator.js";
import { DEFAULT_MODEL, OpenAIAdapter } from "./model/openai-adapter.js";
import { callTool } from "./tools/call-tool.js";
import { getToolDefinitions } from "./tools/get-tool-definitions.js";

async function main() {
  const prompt = process.argv.slice(2).join(" ") || "What does package.json contain?";
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is missing from .env; request not sent.");
    process.exitCode = 1;
    return;
  }

  const model = new OpenAIAdapter(new OpenAI({ apiKey }), process.env.OPENAI_MODEL || DEFAULT_MODEL, apiKey);
  const result = await runAgent({
    prompt,
    model,
    tools: getToolDefinitions(),
    executeTool: callTool,
    onEvent(event) {
      if (event.type === "turn") {
        console.log(`\nAgent turn ${event.turn}/${MAX_TURNS}`);
      } else {
        console.log("\nTool name:", event.call.name);
        console.log("Raw arguments:", event.call.arguments);
        console.log("Tool result:");
        console.log(event.outcome.content);
      }
    },
  });

  if (result.status === "completed") {
    console.log("\nFinal assistant answer:");
    console.log(result.answer);
    return;
  }

  console.error(result.message);
  if (result.status === "error" && result.details) {
    console.error("HTTP status:", result.details.status ?? "unknown");
    console.error("Error code:", result.details.code ?? "unknown");
    console.error("Error type:", result.details.type ?? "unknown");
  }
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error("Agent could not start:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
