import { ModelAdapterError } from "../model/model.js";
import type { Message, ModelAdapter, ToolDefinition, ToolCall } from "../model/model.js";
import type { ToolOutcome } from "../tools/call-tool.js";

export const MAX_TURNS = 10;
export const MAX_TOOL_CALLS = 6;

export const SYSTEM_PROMPT =
  "You are a coding assistant. Use the fewest tool calls needed for local project facts. For a project overview, read package.json, then the CLI entrypoint named by its ask script; inspect the tool registry only if needed. Those files are usually enough for a useful overview, so answer once you have read them. Do not read every file or inspect generated/vendor folders such as node_modules. State what you did not inspect instead of continuing to browse.";

export type AgentEvent =
  | { type: "turn"; turn: number }
  | { type: "tool"; call: ToolCall; outcome: ToolOutcome };

type AgentState = { turns: number; toolCalls: number; messages: Message[] };
export type AgentResult = AgentState & (
  | { status: "completed"; answer: string }
  | { status: "stopped"; reason: "turn_limit" | "tool_limit"; message: string }
  | { status: "error"; reason: "model_error" | "invalid_response"; message: string; details?: ModelAdapterError["details"] }
);

export async function runAgent(options: {
  prompt: string;
  model: ModelAdapter;
  tools: readonly ToolDefinition[];
  executeTool: (name: string, args: unknown) => Promise<ToolOutcome>;
  onEvent?: (event: AgentEvent) => void;
  limits?: { turns: number; toolCalls: number };
}): Promise<AgentResult> {
  const maxTurns = Math.max(1, Math.min(MAX_TURNS, options.limits?.turns ?? MAX_TURNS));
  const maxToolCalls = Math.max(1, Math.min(MAX_TOOL_CALLS, options.limits?.toolCalls ?? MAX_TOOL_CALLS));
  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: options.prompt },
  ];
  let turns = 0;
  let toolCalls = 0;
  const state = () => ({ turns, toolCalls, messages });

  while (turns < maxTurns) {
    turns += 1;
    options.onEvent?.({ type: "turn", turn: turns });
    let response;
    try {
      response = await options.model.complete({
        messages,
        tools: options.tools,
        toolChoice: toolCalls >= maxToolCalls ? "none" : "auto",
      });
    } catch (error) {
      return {
        ...state(), status: "error", reason: "model_error",
        message: error instanceof Error ? error.message : "Model request failed.",
        details: error instanceof ModelAdapterError ? error.details : undefined,
      };
    }

    if (!response || (typeof response.content !== "string" && response.content !== null) ||
        !Array.isArray(response.toolCalls) || response.toolCalls.some((call) =>
          !call || typeof call.id !== "string" || !call.id ||
          typeof call.name !== "string" || !call.name ||
          typeof call.arguments !== "string") ||
        new Set(response.toolCalls.map((call) => call.id)).size !== response.toolCalls.length) {
      return { ...state(), status: "error", reason: "invalid_response", message: "Model returned an invalid assistant response." };
    }

    messages.push({ role: "assistant", content: response.content, toolCalls: response.toolCalls });
    if (response.toolCalls.length === 0) {
      return { ...state(), status: "completed", answer: response.content ?? "" };
    }

    let hitToolLimit = false;
    for (const call of response.toolCalls) {
      let outcome: ToolOutcome;
      if (toolCalls >= maxToolCalls) {
        hitToolLimit = true;
        outcome = { status: "limit_error", content: "Tool call limit reached; this tool was not executed." };
      } else {
        toolCalls += 1;
        try {
          const parsedArgs: unknown = JSON.parse(call.arguments);
          try {
            outcome = await options.executeTool(call.name, parsedArgs);
          } catch (error) {
            outcome = { status: "execution_error", content: `Tool "${call.name}" failed: ${error instanceof Error ? error.message : "unknown error"}` };
          }
        } catch (error) {
          outcome = { status: "json_error", content: "Tool arguments were not valid JSON." };
        }
      }
      messages.push({ role: "tool", toolCallId: call.id, content: outcome.content });
      options.onEvent?.({ type: "tool", call, outcome });
    }
    if (hitToolLimit) {
      return { ...state(), status: "stopped", reason: "tool_limit", message: `Stopped after reaching the ${maxToolCalls}-tool-call safety limit.` };
    }
  }

  return { ...state(), status: "stopped", reason: "turn_limit", message: `Stopped after reaching the ${maxTurns}-turn safety limit.` };
}
