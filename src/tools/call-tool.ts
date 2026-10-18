import { z } from "zod";
import { ToolsRegistry } from "./registry.js";
import type { ToolName } from "./registry.js";
import type { Tool } from "./tool.js";

export type ToolOutcome = {
  status: "ok" | "unknown_tool" | "validation_error" | "execution_error" | "json_error" | "limit_error";
  content: string;
};

function isToolName(toolName: string): toolName is ToolName {
  return Object.hasOwn(ToolsRegistry, toolName);
}

export async function callTool(toolName: string, args: unknown): Promise<ToolOutcome> {
  if (!isToolName(toolName)) {
    return { status: "unknown_tool", content: `Tool "${toolName}" was not found.` };
  }

  // The name arrives at runtime, so this is a tool with an unknown Zod schema.
  const tool = ToolsRegistry[toolName] as Tool<z.ZodType>;

  const parsed = tool.inputSchema.safeParse(args);
  if (!parsed.success) {
    return { status: "validation_error", content: `Tool "${toolName}" failed: ${parsed.error.message}` };
  }

  try {
    return { status: "ok", content: await tool.execute(parsed.data) };
  } catch (error) {
    if (error instanceof Error) {
      return { status: "execution_error", content: `Tool "${toolName}" failed: ${error.message}` };
    }

    return { status: "execution_error", content: `Tool "${toolName}" failed: unknown error` };
  }
}
