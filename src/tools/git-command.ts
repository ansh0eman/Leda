import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const COMMAND_TIMEOUT_MS = 5_000;
const MAX_OUTPUT_BYTES = 1_000_000;

export async function runGit(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: COMMAND_TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
    windowsHide: true,
  });
  return stdout.trimEnd();
}

export function validateRepoRelativePath(filePath: string): boolean {
  if (!filePath || filePath.includes("\0") || filePath.includes("\n") || filePath.includes("\r")) {
    return false;
  }
  if (filePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(filePath)) return false;
  return !filePath.split(/[\\/]/).includes("..");
}
