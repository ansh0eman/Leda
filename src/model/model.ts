export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type ToolCall = { id: string; name: string; arguments: string };

export type Message =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls: ToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

export type ModelResponse = { content: string | null; toolCalls: ToolCall[] };

export class ModelAdapterError extends Error {
  constructor(
    message: string,
    readonly details?: { status?: number; code?: string; type?: string },
  ) {
    super(message);
    this.name = "ModelAdapterError";
  }
}

export interface ModelAdapter {
  complete(request: {
    messages: readonly Message[];
    tools: readonly ToolDefinition[];
    toolChoice: "auto" | "none";
  }): Promise<ModelResponse>;
}
