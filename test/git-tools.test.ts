import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { getToolDefinitions } from "../src/tools/get-tool-definitions.js";
import { callTool } from "../src/tools/call-tool.js";

let originalCwd: string;
let repositoryPath: string;

function git(args: string[]) {
  execFileSync("git", args, { cwd: repositoryPath, stdio: "ignore" });
}

before(async () => {
  originalCwd = process.cwd();
  repositoryPath = await mkdtemp(join(tmpdir(), "leda-git-tools-"));
  git(["init", "-b", "main"]);
  git(["config", "user.name", "LEDA Test"]);
  git(["config", "user.email", "leda-test@example.invalid"]);
  await writeFile(join(repositoryPath, "tracked.txt"), "base\n");
  git(["add", "tracked.txt"]);
  git(["commit", "-m", "initial commit"]);
  await writeFile(join(repositoryPath, "tracked.txt"), "second commit\n");
  git(["commit", "-am", "second commit"]);
  git(["branch", "feature/test"]);
  await writeFile(join(repositoryPath, "tracked.txt"), "second commit\nstaged line\n");
  git(["add", "tracked.txt"]);
  await writeFile(join(repositoryPath, "tracked.txt"), "second commit\nstaged line\nunstaged line\n");
  await writeFile(join(repositoryPath, "untracked.txt"), "new file\n");
  process.chdir(repositoryPath);
});

after(async () => {
  process.chdir(originalCwd);
  await rm(repositoryPath, { recursive: true, force: true });
});

test("Git tools are present in the model tool definitions", () => {
  const names = getToolDefinitions().map((definition) => definition.name);
  for (const name of ["git_status", "git_diff", "git_log", "git_branch"]) {
    assert.ok(names.includes(name), `${name} should be registered`);
  }
});

test("git_status separates staged, unstaged, and untracked changes", async () => {
  const result = await callTool("git_status", {});
  assert.equal(result.status, "ok");
  assert.match(result.content, /Branch: main/);
  assert.match(result.content, /Staged changes:[\s\S]*M tracked\.txt/);
  assert.match(result.content, /Unstaged changes:[\s\S]*M tracked\.txt/);
  assert.match(result.content, /Untracked files:[\s\S]*untracked\.txt/);
});

test("git_diff selects staged or unstaged changes and filters a literal file path", async () => {
  const staged = await callTool("git_diff", { staged: true });
  const unstaged = await callTool("git_diff", {});
  const filtered = await callTool("git_diff", { staged: true, filePath: "tracked.txt" });
  assert.equal(staged.status, "ok");
  assert.equal(unstaged.status, "ok");
  assert.equal(filtered.status, "ok");
  assert.match(staged.content, /^\+staged line$/m);
  assert.doesNotMatch(staged.content, /^\+unstaged line$/m);
  assert.match(unstaged.content, /^\+unstaged line$/m);
  assert.doesNotMatch(unstaged.content, /^\+staged line$/m);
  assert.match(filtered.content, /tracked\.txt/);
  const invalidPath = await callTool("git_diff", { filePath: "../outside.txt" });
  assert.equal(invalidPath.status, "execution_error");
});

test("git_log bounds the number of commits and git_branch reports local branches", async () => {
  const log = await callTool("git_log", { count: 1 });
  assert.equal(log.status, "ok");
  assert.match(log.content, /second commit/);
  assert.doesNotMatch(log.content, /initial commit/);
  const branch = await callTool("git_branch", {});
  assert.equal(branch.status, "ok");
  assert.match(branch.content, /Current branch: main/);
  assert.match(branch.content, /feature\/test/);
});

test("Git tools return execution errors outside a repository", async () => {
  const outsideRepository = await mkdtemp(join(tmpdir(), "leda-outside-git-"));
  process.chdir(outsideRepository);
  try {
    const result = await callTool("git_status", {});
    assert.equal(result.status, "execution_error");
    assert.match(result.content, /not a git repository/i);
  } finally {
    process.chdir(repositoryPath);
    await rm(outsideRepository, { recursive: true, force: true });
  }
});
