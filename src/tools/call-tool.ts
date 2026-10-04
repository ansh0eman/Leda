import { z } from "zod";
import { ToolsRegistry } from "./registry.js";
import type { ToolName } from "./registry.js";
import type { Tool } from "./tool.js";

function isToolName(toolName: string): toolName is ToolName {
  return Object.hasOwn(ToolsRegistry, toolName);
}

export async function callTool(toolName: string, args: unknown): Promise<string> {
  if (!isToolName(toolName)) {
    return `Tool "${toolName}" was not found.`;
  }

  // The name arrives at runtime, so this is a tool with an unknown Zod schema.
  const tool = ToolsRegistry[toolName] as Tool<z.ZodType>;

  try {
    const parsedArgs = tool.inputSchema.parse(args);
    return await tool.execute(parsedArgs);
  } catch (error) {
    if (error instanceof Error) {
      return `Tool "${toolName}" failed: ${error.message}`;
    }

    return `Tool "${toolName}" failed: unknown error`;
  }
}
