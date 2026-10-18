import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { callTool } from "../src/tools/call-tool.js";

let originalCwd: string;
let projectPath: string;
let outsidePath: string;

before(async () => {
  originalCwd = process.cwd();
  projectPath = await mkdtemp(join(tmpdir(), "leda-edit-file-"));
  outsidePath = await mkdtemp(join(tmpdir(), "leda-edit-outside-"));
  await mkdir(join(projectPath, "src"));
  await writeFile(join(projectPath, "sample.txt"), "before old text after\n");
  await writeFile(join(projectPath, "repeat.txt"), "repeat repeat\n");
  await writeFile(join(projectPath, ".env"), "SECRET=not-for-editing\n");
  await writeFile(join(projectPath, "src", "code.ts"), "export const value = 1;\n");
  await writeFile(join(outsidePath, "outside.txt"), "outside content\n");
  await symlink(join(outsidePath, "outside.txt"), join(projectPath, "linked-file.txt"));
  await symlink(join(projectPath, "src"), join(projectPath, "linked-dir"));
  process.chdir(projectPath);
});

beforeEach(async () => {
  await writeFile(join(projectPath, "sample.txt"), "before old text after\n");
});

after(async () => {
  process.chdir(originalCwd);
  await rm(projectPath, { recursive: true, force: true });
  await rm(outsidePath, { recursive: true, force: true });
});

test("edit_file replaces exactly one occurrence after approval", async () => {
  let approvedProposal: unknown;
  const result = await callTool("edit_file", {
    filePath: "sample.txt",
    oldText: "old text",
    newText: "new text",
  }, {
    async approveEdit(proposal) {
      approvedProposal = proposal;
      return true;
    },
  });

  assert.equal(result.status, "ok");
  assert.deepEqual(approvedProposal, {
    filePath: "sample.txt",
    oldText: "old text",
    newText: "new text",
  });
  assert.equal(await readFile(join(projectPath, "sample.txt"), "utf8"), "before new text after\n");
});

test("edit_file rejects missing and repeated old text", async () => {
  const missing = await callTool("edit_file", {
    filePath: "sample.txt", oldText: "absent", newText: "replacement",
  }, { approveEdit: async () => true });
  const repeated = await callTool("edit_file", {
    filePath: "repeat.txt", oldText: "repeat", newText: "single",
  }, { approveEdit: async () => true });

  assert.equal(missing.status, "execution_error");
  assert.match(missing.content, /not found/);
  assert.equal(repeated.status, "execution_error");
  assert.match(repeated.content, /more than once/);
  assert.equal(await readFile(join(projectPath, "repeat.txt"), "utf8"), "repeat repeat\n");
});

test("edit_file rejects traversal, sensitive files, and symbolic links", async () => {
  for (const filePath of [
    `../${basename(outsidePath)}/outside.txt`,
    ".env",
    "linked-file.txt",
    "linked-dir/code.ts",
  ]) {
    const result = await callTool("edit_file", {
      filePath, oldText: "content", newText: "changed",
    }, { approveEdit: async () => true });
    assert.equal(result.status, "execution_error", `${filePath} should be rejected`);
  }
  assert.equal(await readFile(join(outsidePath, "outside.txt"), "utf8"), "outside content\n");
});

test("edit_file rejects absent approval and explicit rejection", async () => {
  const noApproval = await callTool("edit_file", {
    filePath: "sample.txt", oldText: "old text", newText: "new text",
  });
  const rejected = await callTool("edit_file", {
    filePath: "sample.txt", oldText: "old text", newText: "new text",
  }, { approveEdit: async () => false });

  assert.equal(noApproval.status, "ok");
  assert.match(noApproval.content, /rejected/);
  assert.equal(rejected.status, "ok");
  assert.match(rejected.content, /rejected/);
  assert.equal(await readFile(join(projectPath, "sample.txt"), "utf8"), "before old text after\n");
});

test("edit_file refuses to overwrite changes made after preview", async () => {
  const result = await callTool("edit_file", {
    filePath: "sample.txt", oldText: "old text", newText: "new text",
  }, {
    async approveEdit() {
      await writeFile(join(projectPath, "sample.txt"), "changed after preview\n");
      return true;
    },
  });

  assert.equal(result.status, "execution_error");
  assert.match(result.content, /changed after the preview/);
  assert.equal(await readFile(join(projectPath, "sample.txt"), "utf8"), "changed after preview\n");
});

test("existing filesystem tools continue to work", async () => {
  const read = await callTool("read_file", { filePath: "src/code.ts" });
  const list = await callTool("list_files", { directoryPath: "src" });
  const search = await callTool("search_files", { directoryPath: ".", query: "export const value" });
  assert.equal(read.status, "ok");
  assert.match(read.content, /export const value = 1/);
  assert.equal(list.status, "ok");
  assert.match(list.content, /code\.ts/);
  assert.equal(search.status, "ok");
  assert.match(search.content, /src[\\/]code\.ts:1/);
});
