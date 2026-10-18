import { z } from "zod";
import { runGit } from "./git-command.js";
import type { Tool } from "./tool.js";

const inputSchema = z.object({});

export const gitStatusTool: Tool<typeof inputSchema> = {
  name: "git_status",
  description: "Reports the current branch and staged, unstaged, and untracked repository changes.",
  inputSchema,

  async execute(): Promise<string> {
    const [branch, output] = await Promise.all([
      runGit(["branch", "--show-current"]),
      runGit(["status", "--short", "--no-renames"]),
    ]);
    const changeLines = output ? output.split("\n") : [];
    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];

    for (const line of changeLines) {
      if (line.length < 3) continue;
      const indexStatus = line[0];
      const worktreeStatus = line[1];
      const filePath = line.slice(3);
      if (indexStatus === "?" && worktreeStatus === "?") {
        untracked.push(filePath);
        continue;
      }
      if (indexStatus !== " ") staged.push(`${indexStatus} ${filePath}`);
      if (worktreeStatus !== " ") unstaged.push(`${worktreeStatus} ${filePath}`);
    }

    const format = (title: string, entries: string[]) =>
      `${title}:\n${entries.length ? entries.map((entry) => `  ${entry}`).join("\n") : "  none"}`;
    return [
      `Branch: ${branch || "(detached HEAD)"}`,
      format("Staged changes", staged),
      format("Unstaged changes", unstaged),
      format("Untracked files", untracked),
    ].join("\n");
  },
};
