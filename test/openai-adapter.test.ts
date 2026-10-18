import assert from "node:assert/strict";
import { test } from "node:test";
import type OpenAI from "openai";
import { OpenAIAdapter } from "../src/model/openai-adapter.js";

test("OpenAI adapter preserves model config, call IDs, and raw argument strings", async () => {
  let sent: Record<string, unknown> | undefined;
  const client = {
    chat: { completions: { async create(request: Record<string, unknown>) {
      sent = request;
      return { choices: [{ message: {
        content: null,
        tool_calls: [{ id: "call-1", type: "function", function: { name: "read_file", arguments: '{ "filePath": "README.md" }' } }],
      } }] };
    } } },
  } as unknown as OpenAI;
  const adapter = new OpenAIAdapter(client, "test-model");
  const tools = [{ name: "read_file", description: "read", parameters: { type: "object" } }];
  const first = await adapter.complete({ messages: [{ role: "user", content: "Read it" }], tools, toolChoice: "auto" });
  assert.equal(sent?.model, "test-model");
  assert.equal(sent?.parallel_tool_calls, false);
  assert.deepEqual(first.toolCalls, [{ id: "call-1", name: "read_file", arguments: '{ "filePath": "README.md" }' }]);
  await adapter.complete({ messages: [
    { role: "user", content: "Read it" },
    { role: "assistant", content: null, toolCalls: first.toolCalls },
    { role: "tool", toolCallId: "call-1", content: "data" },
  ], tools, toolChoice: "none" });
  const messages = sent?.messages as Record<string, unknown>[];
  assert.deepEqual((messages[1].tool_calls as Record<string, unknown>[])[0], {
    id: "call-1", type: "function", function: { name: "read_file", arguments: '{ "filePath": "README.md" }' },
  });
  assert.deepEqual(messages[2], { role: "tool", tool_call_id: "call-1", content: "data" });
  assert.equal(sent?.tool_choice, "none");
});
