import assert from "node:assert/strict";
import { test } from "node:test";
import { runAgent, MAX_TOOL_CALLS, MAX_TURNS } from "../src/agent/orchestrator.js";
import type { Message, ModelAdapter, ModelResponse } from "../src/model/model.js";
import type { ToolOutcome } from "../src/tools/call-tool.js";
import { callTool } from "../src/tools/call-tool.js";

const answer = (content = "Done") => ({ content, toolCalls: [] });
const call = (id: string, name = "read_file", args = "{}") => ({ id, name, arguments: args });

function fakeModel(responses: ModelResponse[]) {
  const requests: { messages: readonly Message[]; toolChoice: string }[] = [];
  const model: ModelAdapter = {
    async complete(request) {
      requests.push({ messages: structuredClone(request.messages), toolChoice: request.toolChoice });
      const response = responses.shift();
      if (!response) throw new Error("Fake model exhausted");
      return response;
    },
  };
  return { model, requests };
}

const ok = async (): Promise<ToolOutcome> => ({ status: "ok", content: "file contents" });
const run = (model: ModelAdapter, executeTool: (name: string, args: unknown) => Promise<ToolOutcome> = ok, limits?: { turns: number; toolCalls: number }) =>
  runAgent({ prompt: "Question", model, tools: [], executeTool, limits });

test("answers without using a tool", async () => {
  const { model } = fakeModel([answer("Hello")]);
  const result = await run(model);
  assert.equal(result.status, "completed");
  if (result.status === "completed") assert.equal(result.answer, "Hello");
  assert.equal(result.turns, 1);
  assert.equal(result.toolCalls, 0);
});

test("executes a tool, pairs its ID, then answers", async () => {
  const { model, requests } = fakeModel([{ content: null, toolCalls: [call("abc", "read_file", '{"filePath":"README.md"}')] }, answer("Read it")]);
  const executed: unknown[] = [];
  const result = await run(model, async (_name, args) => { executed.push(args); return ok(); });
  assert.equal(result.status, "completed");
  assert.deepEqual(executed, [{ filePath: "README.md" }]);
  assert.deepEqual(requests[1].messages.slice(-2), [
    { role: "assistant", content: null, toolCalls: [call("abc", "read_file", '{"filePath":"README.md"}')] },
    { role: "tool", toolCallId: "abc", content: "file contents" },
  ]);
});

test("invalid JSON is distinct from execution failure", async () => {
  const { model, requests } = fakeModel([{ content: null, toolCalls: [call("bad", "read_file", "{" )] }, answer()]);
  let executed = false;
  const result = await run(model, async () => { executed = true; return ok(); });
  assert.equal(result.status, "completed");
  assert.equal(executed, false);
  assert.equal((requests[1].messages.at(-1) as Extract<Message, {role:"tool"}>).content, "Tool arguments were not valid JSON.");
});

test("unknown tools produce a paired observation", async () => {
  const { model, requests } = fakeModel([{ content: null, toolCalls: [call("missing", "unknown")] }, answer()]);
  const result = await run(model, callTool);
  assert.equal(result.status, "completed");
  assert.equal((requests[1].messages.at(-1) as Extract<Message, {role:"tool"}>).toolCallId, "missing");
  assert.match((requests[1].messages.at(-1) as Extract<Message, {role:"tool"}>).content, /not found/);
});

test("the registered tool executor validates arguments with Zod", async () => {
  const result = await callTool("read_file", { filePath: 42 });
  assert.equal(result.status, "validation_error");
});

test("the registered tool executor distinguishes runtime failure", async () => {
  const result = await callTool("read_file", { filePath: "definitely-missing-test-file.txt" });
  assert.equal(result.status, "execution_error");
  assert.match(result.content, /Failed to read file/);
});

test("tool failures are returned to the model", async () => {
  const { model, requests } = fakeModel([{ content: null, toolCalls: [call("failure")] }, answer()]);
  const result = await run(model, async () => { throw new Error("disk unavailable"); });
  assert.equal(result.status, "completed");
  assert.match((requests[1].messages.at(-1) as Extract<Message, {role:"tool"}>).content, /disk unavailable/);
});

test("invalid adapter responses produce a structured error", async () => {
  const model: ModelAdapter = { async complete() { return undefined as unknown as ModelResponse; } };
  const result = await run(model);
  assert.equal(result.status, "error");
  if (result.status === "error") assert.equal(result.reason, "invalid_response");
});

test("stops at the model turn limit", async () => {
  const { model } = fakeModel(Array.from({ length: 3 }, (_, i) => ({ content: null, toolCalls: [call(`id-${i}`)] })));
  const result = await run(model, ok, { turns: 3, toolCalls: MAX_TOOL_CALLS });
  assert.equal(result.status, "stopped");
  if (result.status === "stopped") assert.equal(result.reason, "turn_limit");
  assert.equal(result.turns, 3);
  assert.equal(MAX_TURNS, 10);
});

test("stops when a response requests a tool beyond the call limit", async () => {
  const responses = Array.from({ length: MAX_TOOL_CALLS }, (_, i) => ({ content: null, toolCalls: [call(`id-${i}`)] }));
  responses.push({ content: null, toolCalls: [call("extra")] });
  const { model, requests } = fakeModel(responses);
  const result = await run(model);
  assert.equal(result.status, "stopped");
  if (result.status === "stopped") assert.equal(result.reason, "tool_limit");
  assert.equal(result.toolCalls, MAX_TOOL_CALLS);
  assert.equal(requests.at(-1)?.toolChoice, "none");
  assert.equal((result.messages.at(-1) as Extract<Message, {role:"tool"}>).toolCallId, "extra");
});

test("multiple calls near the limit run sequentially, reject excess, and preserve every ID", async () => {
  const responses = Array.from({ length: MAX_TOOL_CALLS - 1 }, (_, i) => ({ content: null, toolCalls: [call(`earlier-${i}`)] }));
  responses.push({ content: null, toolCalls: [call("last"), call("excess-1"), call("excess-2")] });
  const { model } = fakeModel(responses);
  let active = 0;
  let maxActive = 0;
  const result = await run(model, async () => {
    active++;
    maxActive = Math.max(maxActive, active);
    await Promise.resolve();
    active--;
    return ok();
  });
  assert.equal(result.status, "stopped");
  assert.equal(result.toolCalls, MAX_TOOL_CALLS);
  assert.equal(maxActive, 1);
  assert.deepEqual(result.messages.slice(-3).map((message) => message.role === "tool" ? message.toolCallId : null), ["last", "excess-1", "excess-2"]);
  assert.match((result.messages.at(-1) as Extract<Message, {role:"tool"}>).content, /not executed/);
});
