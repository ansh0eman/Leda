import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { basename, isAbsolute, join, relative, sep } from "node:path";
import { z } from "zod";
import { getSafeProjectPath, isSensitiveFileName } from "./file-safety.js";
import type { EditProposal, Tool, ToolExecutionContext } from "./tool.js";

const inputSchema = z.object({
  filePath: z.string().min(1),
  oldText: z.string().min(1),
  newText: z.string(),
});

function isOutsideProject(root: string, target: string): boolean {
  const relativePath = relative(root, target);
  return relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath);
}

async function assertSafeTarget(filePath: string): Promise<string> {
  const projectRoot = process.cwd();
  const targetPath = getSafeProjectPath(filePath);
  if (!targetPath || isSensitiveFileName(basename(targetPath))) {
    throw new Error("This file cannot be edited.");
  }

  const relativePath = relative(projectRoot, targetPath);
  if (!relativePath || isOutsideProject(projectRoot, targetPath)) {
    throw new Error("The target must be a file inside the project.");
  }

  const pathParts = relativePath.split(sep);
  if (pathParts.some(isSensitiveFileName)) {
    throw new Error("Sensitive file paths cannot be edited.");
  }

  let currentPath = projectRoot;
  for (const [index, part] of pathParts.entries()) {
    currentPath = join(currentPath, part);
    const stats = await lstat(currentPath);
    if (stats.isSymbolicLink()) {
      throw new Error("Symbolic links cannot be edited.");
    }
    if (index < pathParts.length - 1 && !stats.isDirectory()) {
      throw new Error("A parent path is not a directory.");
    }
    if (index === pathParts.length - 1 && !stats.isFile()) {
      throw new Error("The target must be an existing regular file.");
    }
  }

  const [resolvedRoot, resolvedTarget] = await Promise.all([
    realpath(projectRoot),
    realpath(targetPath),
  ]);
  if (isOutsideProject(resolvedRoot, resolvedTarget)) {
    throw new Error("The target resolves outside the project.");
  }
  return targetPath;
}

async function openSafeFile(filePath: string, writable: boolean) {
  const targetPath = await assertSafeTarget(filePath);
  const flags = (writable ? constants.O_RDWR : constants.O_RDONLY) | constants.O_NOFOLLOW;
  const file = await open(targetPath, flags);
  try {
    const [openedStats, pathStats, verifiedPath] = await Promise.all([
      file.stat(),
      lstat(targetPath),
      assertSafeTarget(filePath),
    ]);
    const resolvedTarget = await realpath(targetPath);
    if (
      verifiedPath !== targetPath ||
      pathStats.isSymbolicLink() ||
      !openedStats.isFile() ||
      openedStats.dev !== pathStats.dev ||
      openedStats.ino !== pathStats.ino ||
      isOutsideProject(await realpath(process.cwd()), resolvedTarget)
    ) {
      throw new Error("The target changed while it was being opened.");
    }
    return file;
  } catch (error) {
    await file.close();
    throw error;
  }
}

async function readUtf8(filePath: string): Promise<Buffer> {
  const file = await openSafeFile(filePath, false);
  try {
    const contents = await file.readFile();
    if (!Buffer.from(contents.toString("utf8"), "utf8").equals(contents)) {
      throw new Error("Only valid UTF-8 text files can be edited.");
    }
    return contents;
  } finally {
    await file.close();
  }
}

async function writeUtf8IfUnchanged(filePath: string, original: Buffer, replacement: string): Promise<void> {
  const file = await openSafeFile(filePath, true);
  try {
    const current = await file.readFile();
    if (!current.equals(original)) {
      throw new Error("The file changed after the preview. No edit was applied.");
    }

    const contents = Buffer.from(replacement, "utf8");
    let offset = 0;
    while (offset < contents.length) {
      const { bytesWritten } = await file.write(contents, offset, contents.length - offset, offset);
      if (bytesWritten === 0) throw new Error("The file could not be fully written.");
      offset += bytesWritten;
    }
    await file.truncate(contents.length);
  } finally {
    await file.close();
  }
}

export const editFileTool: Tool<typeof inputSchema> = {
  name: "edit_file",
  description: "Replaces one exact occurrence of text in an existing project file after explicit user approval.",
  inputSchema,

  async execute(args, context?: ToolExecutionContext): Promise<string> {
    const original = await readUtf8(args.filePath);
    const originalText = original.toString("utf8");
    const matchIndex = originalText.indexOf(args.oldText);
    if (matchIndex === -1) throw new Error("The oldText was not found; no edit was applied.");
    if (originalText.indexOf(args.oldText, matchIndex + 1) !== -1) {
      throw new Error("The oldText occurs more than once; no edit was applied.");
    }

    const updatedText =
      originalText.slice(0, matchIndex) + args.newText + originalText.slice(matchIndex + args.oldText.length);
    const proposal: EditProposal = {
      filePath: relative(process.cwd(), await assertSafeTarget(args.filePath)),
      oldText: args.oldText,
      newText: args.newText,
    };

    if (!context?.approveEdit || !(await context.approveEdit(proposal))) {
      return "Edit rejected; the file was not changed.";
    }

    await writeUtf8IfUnchanged(args.filePath, original, updatedText);
    return `Updated ${proposal.filePath}.`;
  },
};
