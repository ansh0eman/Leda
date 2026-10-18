import OpenAI from "openai";
import { ModelAdapterError } from "./model.js";
import type { Message, ModelAdapter, ToolDefinition } from "./model.js";

export const DEFAULT_MODEL = "gpt-6-luna";

function toOpenAIMessage(message: Message): OpenAI.ChatCompletionMessageParam {
  switch (message.role) {
    case "system":
    case "user":
      return { role: message.role, content: message.content };
    case "tool":
      return { role: "tool", tool_call_id: message.toolCallId, content: message.content };
    case "assistant":
      return {
        role: "assistant",
        content: message.content,
        ...(message.toolCalls.length > 0 && {
          tool_calls: message.toolCalls.map((call) => ({
            id: call.id,
            type: "function" as const,
            function: { name: call.name, arguments: call.arguments },
          })),
        }),
      };
  }
}

export class OpenAIAdapter implements ModelAdapter {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string = DEFAULT_MODEL,
    private readonly apiKey: string = "",
  ) {}

  async complete(request: {
    messages: readonly Message[];
    tools: readonly ToolDefinition[];
    toolChoice: "auto" | "none";
  }) {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        reasoning_effort: "none",
        messages: request.messages.map(toOpenAIMessage),
        tools: request.tools.map((definition) => ({
          type: "function" as const,
          function: definition,
        })),
        tool_choice: request.toolChoice,
        parallel_tool_calls: false,
      });

      const message = response.choices[0]?.message;
      if (!message) throw new ModelAdapterError("No assistant message returned.");

      return {
        content: message.content,
        toolCalls: (message.tool_calls ?? []).map((call) => {
          if (call.type !== "function") {
            throw new ModelAdapterError(`Unsupported tool call type: ${call.type}`);
          }
          return { id: call.id, name: call.function.name, arguments: call.function.arguments };
        }),
      };
    } catch (error) {
      if (error instanceof ModelAdapterError) throw error;
      if (error instanceof OpenAI.APIError) {
        const safeMessage = this.apiKey
          ? error.message.replaceAll(this.apiKey, "[REDACTED]")
          : error.message;
        throw new ModelAdapterError(safeMessage, {
          status: error.status,
          code: error.code ?? undefined,
          type: error.type ?? undefined,
        });
      }
      throw new ModelAdapterError("OpenAI request failed before receiving an API response.");
    }
  }
}
