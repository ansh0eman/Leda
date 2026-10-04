import { z } from "zod";
import { ToolsRegistry } from "./registry.js";

export function getToolDefinitions() {
  return Object.values(ToolsRegistry).map((tool) => {
    return {
      name: tool.name,
      description: tool.description,
      parameters: z.toJSONSchema(tool.inputSchema),
    };
  });
}
