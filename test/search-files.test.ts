import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { callTool } from "../src/tools/call-tool.js";

let originalCwd: string;
let projectPath: string;

before(async () => {
  originalCwd = process.cwd();
  projectPath = await mkdtemp(join(tmpdir(), "leda-search-files-"));
  for (const directory of [".git", ".venv", "node_modules", "dist", "build", "packages/node_modules"]) {
    await mkdir(join(projectPath, directory), { recursive: true });
    await writeFile(join(projectPath, directory, "ignored.txt"), "needle\n");
  }
  await writeFile(join(projectPath, "visible.txt"), "needle\n");
  await mkdir(join(projectPath, "packages", "src"), { recursive: true });
  await writeFile(join(projectPath, "packages", "src", "visible.txt"), "needle\n");
  process.chdir(projectPath);
});

after(async () => {
  process.chdir(originalCwd);
  await rm(projectPath, { recursive: true, force: true });
});

test("search skips ignored folders during recursive traversal", async () => {
  const result = await callTool("search_files", { directoryPath: ".", query: "needle" });
  assert.equal(result.status, "ok");
  assert.match(result.content, /visible\.txt:1: needle/);
  assert.match(result.content, /packages[\\/]src[\\/]visible\.txt:1: needle/);
  assert.doesNotMatch(result.content, /ignored\.txt/);
});

test("search rejects ignored directories when explicitly requested as the root", async () => {
  for (const directoryPath of [".git", ".venv", "node_modules", "dist", "build", "packages/node_modules"]) {
    const result = await callTool("search_files", { directoryPath, query: "needle" });
    assert.equal(result.status, "execution_error", `${directoryPath} should be rejected`);
    assert.match(result.content, /cannot be searched/i);
  }
});
