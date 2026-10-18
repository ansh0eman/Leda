import { z } from "zod";
import { runGit, validateRepoRelativePath } from "./git-command.js";
import type { Tool } from "./tool.js";

const inputSchema = z.object({
  staged: z.boolean().default(false),
  filePath: z.string().optional(),
});

export const gitDiffTool: Tool<typeof inputSchema> = {
  name: "git_diff",
  description: "Shows unstaged changes by default, or staged changes when staged is true. Can be limited to one repository-relative file path.",
  inputSchema,

  async execute(args): Promise<string> {
    if (args.filePath !== undefined && !validateRepoRelativePath(args.filePath)) {
      throw new Error("filePath must be a repository-relative path without parent-directory segments.");
    }
    const commandArgs = ["diff", "--no-ext-diff", "--no-color"];
    if (args.staged) commandArgs.push("--cached");
    if (args.filePath !== undefined) commandArgs.push("--", `:(literal)${args.filePath}`);
    else commandArgs.push("--");
    const diff = await runGit(commandArgs);
    return diff || "No changes found.";
  },
};
